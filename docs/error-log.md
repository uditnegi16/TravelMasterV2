# Error Log

## Purpose

Tracks implementation errors, debugging steps, root causes, and final resolutions.

---

## Phase 0

No errors recorded.

---

## Real user review (2026-08-19) -- AI conversation quality + mobile layout

A friend's review surfaced two categories of real, live problems, both traced to actual root causes in the code, not assumed.

### 1. "Asked where I can visit, only got hotels" -- two compounding, separate bugs

**Symptom:** budget + "where can I visit" -> got a destination suggestion; asking again specifically "where can I visit" only surfaced hotel info; had to explicitly ask for "points of interest" to get real places data; asking for hotels near those points of interest got "there are many hotels" with no actual list; a recommended PG turned out not to be in the destination at all.

**Hypothesis (initial):** RAG retrieval or the tool pipeline was broken.

**What the code actually showed, two separate things:**
1. `composer_node.py` builds its narrative prompt from structured trip data only -- `grep -n "user_query" composer_node.py` returned zero matches. It never sees what the user actually asked, so it always writes the same kind of "here's your trip" summary regardless of the specific question, and its own instructions heavily weight budget/hotel framing.
2. `itinerary_qa_node.py` (the FOLLOW_UP handler) has no tool-calling capability at all -- confirmed by reading the full node: only `previous_trip`, a RAG lookup, and general LLM knowledge. Any specific claim beyond what's already in the existing trip data (like "there are many hotels," or the wrong-location PG) is ungrounded LLM output, not real search data.

**A real false alarm caught mid-investigation, worth recording honestly:** `parallel_tools_node.py`'s `futures` dict only submits `places_tool` and `weather_tool` -- at first glance this looked like flights/hotels were never being fetched at all for a real trip plan, a much bigger bug. Checking `build_graph.py` fully resolved it: `flight_tool` and `hotel_tool` run as separate, earlier sequential graph nodes (`tool_router -> flight_tool -> hotel_tool -> parallel_tools -> composer`), not inside that specific parallel batch. Working correctly. Recorded here specifically because almost reporting this as a confirmed bug without checking the full graph first would have been a real mistake.

**Fix:** `composer_node.py` now receives the user's actual question and is instructed to lead with whatever it's specifically about. A new `INFO_REQUEST` conversation type (see Decision 004) handles follow-ups that need genuinely new, real data -- calling exactly one real tool, never improvising results that don't exist.

**Verification:** 12 new tests (`test_info_request_node.py`), including one asserting the node gives an honest "couldn't find that" answer rather than inventing hotel/place details when a real search returns empty -- directly targeting the PG-hallucination symptom.

### 2. Goa recommended for everything, regardless of destination asked about

**Symptom:** the chatbot appeared biased toward recommending Goa content no matter what destination was actually being discussed.

**Hypothesis (initial):** a retrieval-ranking bug favoring one destination.

**What the code and data actually showed:** `wc -w knowledge_base/destinations/*.md` -- `dubai.md` and `japan.md` are completely empty (0 bytes). A full repo scan (`find knowledge_base -name "*.md" -size +0c`) found only 2 of 27 total knowledge-base files have any real content at all: the README and `goa.md`. Compounding this, `retrieval/reranker.py`'s `rerank()` was a pure no-op (`return documents`, unchanged) -- zero relevance filtering anywhere in the retrieval path. A query about any other destination still got Goa's chunks back as "the closest available match" via unfiltered semantic similarity search, regardless of true relevance.

**Fix:** added a real similarity-score threshold to the reranker (`MIN_RELEVANCE_SIMILARITY = 0.35`, using the `similarity` field `match_travel_knowledge` already returns -- no new model, no dependency, respects the documented reason the old cross-encoder model was removed in the first place: it broke Lambda cold starts). Below-threshold results are now dropped instead of always returned.

**Explicitly NOT fixed, and can't be from code alone:** the actual content gap. This is a data-population task -- writing real knowledge-base content for Dubai, Japan, and the other 23 empty files -- not something fabricatable as part of a code fix.

**Verification:** 5 new tests (`test_reranker_threshold.py`), confirming low-similarity results are filtered while genuinely relevant ones survive, plus an explicit test that the threshold constant is a real positive number (guards against someone silently setting it back to 0 later and re-disabling the fix without noticing).

### 3. Mobile sidebar left a visible sliver of chat content

**Symptom:** on a phone, opening the sidebar left part of the chat pane visible in a gap on the right.

**What the code showed:** `ChatSidebar.tsx` had zero mobile-specific handling at all -- no overlay, no backdrop, no responsive breakpoint classes anywhere in the file. It was a permanent desktop flex-row sibling (`w-72`), rendered directly alongside the chat pane (confirmed in `ChatPage.tsx`). On a narrow viewport, the chat pane's `flex-1` sibling never fully disappears when the sidebar "opens" -- it just shrinks to whatever width is left over, which is exactly the reported "slit."

**Fix:** real fixed-position overlay + tap-to-close backdrop on mobile only (`md:hidden`/`md:relative md:z-auto` pairs), desktop's existing side-by-side layout left completely unchanged.

**Verification:** real `npm run build` (2325 modules, clean) and lint/type-check, confirming the change compiles correctly -- no dedicated component test written for this one (a visual/layout bug, lower value from a snapshot-style test than from an actual device check, which is still pending).

---

## feat/voice-agent (2026-08-11) -- ElevenLabs voice sidecar

Three real errors while building the sidecar, in the order they actually happened.

### 1. Accidental JS-comment syntax in a Python file

Writing `voice/config.py`, one comment line came out as `// a graceful "still working on it" string` instead of `# a graceful...` -- muscle memory from writing the TypeScript side of the same feature minutes earlier. `//` is not a comment in Python; it's floor division, and `// a graceful...` on its own line is a syntax error.

**Hypothesis:** typo, nothing subtle.
**What the logs actually showed:** `python3 -m py_compile` failed immediately with a `SyntaxError` pointing at the exact line.
**Fix:** changed `//` to `#`. Re-ran `py_compile`, clean.
**Held:** yes -- confirmed by every subsequent successful import of `voice.config` across ~20 later test runs.

### 2. FastAPI route inspection used the wrong attribute

Trying to empirically confirm the `VOICE_ENABLED` flag actually removes the router (not just disables it), the first inspection attempt was:
```python
routes = [r.path for r in app.routes if 'voice/tools' in r.path]
```

**Hypothesis:** every FastAPI route object exposes `.path`.
**What the logs actually showed:** `AttributeError: '_IncludedRouter' object has no attribute 'path'` -- this FastAPI version's `app.routes` contains a mix of route types, and the included-router wrapper objects don't expose `.path` directly the way a plain `APIRoute` does.
**Fix:** switched to inspecting `app.openapi()["paths"]` instead -- the generated OpenAPI schema's path list, which is stable across route-object internals. Re-ran with `VOICE_ENABLED` unset and then `=true`; got `NONE (correct)` and `['/voice/tools/search_destinations', '/voice/tools/get_itinerary']` respectively.
**Held:** yes -- this became the actual verification method used, not a one-off workaround.

### 3. TypeScript JSX namespace augmentation, wrong twice before it worked

Declaring the custom `<elevenlabs-convai>` HTML element for TypeScript's JSX checker (needed so `<elevenlabs-convai agent-id={agentId} />` type-checks) took two wrong attempts.

**First attempt:** `declare global { namespace JSX { interface IntrinsicElements {...} } } }`.
**What broke:** two separate errors -- ESLint's `@typescript-eslint/no-namespace` rule fired (this codebase disallows `namespace` blocks generally), AND `tsc` still reported `Property 'elevenlabs-convai' does not exist on type 'JSX.IntrinsicElements'` even after that, meaning the augmentation target itself was wrong, not just the lint complaint.

**Hypothesis (wrong):** assumed a bare global `JSX` namespace, the older React <=18 pattern.
**What the logs actually showed:** grepping this project's actual installed `@types/react/index.d.ts` directly (not assuming from memory) showed `namespace JSX` declared *nested inside* `namespace React` at line 4132 -- meaning the real augmentation target in this React 19 setup is `React.JSX.IntrinsicElements`, reached via `declare module "react" { namespace JSX {...} }`, not a bare `declare global`.

**Fix:** changed to `declare module "react" { namespace JSX { interface IntrinsicElements {...} } } }`, plus a single targeted `// eslint-disable-next-line @typescript-eslint/no-namespace` with a comment explaining this is one of the few cases where `namespace` syntax is genuinely required by TypeScript's declaration-merging mechanism, not a style choice to relax.
**Held:** yes -- `npm run lint`, `tsc -b --noEmit`, and `npm run build` all passed clean afterward, confirmed by re-running all three, not assumed from the first pass.

---