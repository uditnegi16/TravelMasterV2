# Decision Log

## Purpose

This document records every important architectural and technical decision made during the development of TravelMaster V2.

---

## Decision 001

**Title**

Repository Workflow

**Decision**

Development follows an SDLC-based phase approach. Each phase is completed before starting the next.

**Reason**

- Easier maintenance
- Better documentation
- Easier interview preparation

---

## Decision 002

**Title**

Documentation Inside Repository

**Decision**

Maintain project documentation alongside the codebase.

**Reason**

- Version controlled
- Easier collaboration
- Tracks engineering decisions

---

## Decision 003

**Title**

Dependency Documentation

**Decision**

Every external package, SDK, or service must have documented reasoning before or immediately after introduction.

**Reason**

Supports maintainability and interview preparation.

---

## Decision 004

**Title**

New INFO_REQUEST conversation type, instead of routing to MODIFY_TRIP

**Context**

Real user report (via a friend's review, 2026-08-19): asking "where can I visit" after an initial trip suggestion only returned hotel information; asking about hotels near a point of interest got a vague "there are many hotels" with no actual list; a recommended PG turned out not to be in the destination at all. Traced to two compounding root causes: `composer_node.py` never saw the user's actual question text for a fresh trip plan, and follow-up questions (`itinerary_qa_node`) have zero ability to search anything live -- only the LLM's general knowledge plus whatever's already in the existing trip data.

**Options considered**

1. Give the follow-up chat node real tool-calling access.
2. Reclassify these questions as `MODIFY_TRIP`, reusing the existing full tool-invoking pipeline.
3. A new, separate conversation type calling exactly one real tool.

**Decision**

Option 3. Option 1 was a bigger, riskier change to an intentionally lightweight node. Option 2 was rejected on two grounds, raised directly during review: `MODIFY_TRIP` means "change my existing plan," a semantically different thing than "show me more information," and reusing it would run the full 4-tool pipeline (real external API calls, multiple LLM calls) for what might just be a single informational question -- disproportionate cost for the actual ask.

**Reason**

Keeps real API/token cost proportional to what the user actually asked for, keeps `MODIFY_TRIP`'s semantics honest, and reuses existing, already-tested individual tool functions (`search_places`, `search_hotels`) rather than building new infrastructure.