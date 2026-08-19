import { useEffect } from "react";

/**
 * ElevenLabs conversational voice widget, injected via their own
 * documented embed pattern (elevenlabs.io/docs -- confirmed against
 * the real docs and the official elevenlabs/skills repo's React
 * example, 2026-08-11): a dynamically-injected <script> tag that
 * registers the <elevenlabs-convai> custom element, plus that
 * element itself in JSX.
 *
 * Deliberately does NOT import an ElevenLabs npm package -- the
 * script-tag approach keeps this genuinely removable with zero
 * lockfile residue (no new dependency to later notice and remove).
 *
 * Talks to ElevenLabs' own voice infrastructure directly, entirely
 * separate from this app's backend -- the ElevenLabs AGENT is what
 * calls this app's voice/tools/* webhooks server-side (see
 * apps/backend/agent_service/voice/router.py). This component has no
 * knowledge of that at all; it only renders ElevenLabs' own widget UI.
 */
export default function VoiceAgentWidget() {
  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined;

  useEffect(() => {
    if (!agentId) return;

    const existing = document.querySelector(
      'script[src*="convai-widget-embed"]',
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    script.async = true;
    script.type = "text/javascript";
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [agentId]);

  if (!agentId) {
    // Flag was on but the agent isn't configured -- fail quietly,
    // never break the page a real user is looking at.
    return null;
  }

  return <elevenlabs-convai agent-id={agentId} />;
}

// Registers the custom element's props with TypeScript's JSX checker
// -- without this, <elevenlabs-convai> above is a type error. Module
// augmentation of React.JSX.IntrinsicElements genuinely requires
// `namespace` syntax (TypeScript's declaration-merging mechanism for
// this specific case) -- not a style violation to work around, one of
// the few real exceptions to the project's no-namespace rule.
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { "agent-id": string },
        HTMLElement
      >;
    }
  }
}
