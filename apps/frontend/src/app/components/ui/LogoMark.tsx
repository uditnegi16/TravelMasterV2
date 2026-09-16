type Props = {
  className?: string;
  /** Accepted and ignored. The call sites inherited this from the lucide
   *  icon this replaced; the weights here are part of the drawing. */
  strokeWidth?: number;
};

/**
 * The TravelMaster mark.
 *
 * Replaces a stock lucide `Compass` glyph, which was the same icon any
 * icon library hands out and was used identically in four files. This is
 * drawn for this project: a compass needle whose two halves also read as
 * a route between two points, which is what the product actually does.
 *
 * Deliberately simple. It has to survive being rendered at 16px in a
 * browser tab, so there is no interior detail, no gradient, and the
 * counters stay open at small sizes. Uses currentColor so it inherits
 * from whatever it sits in rather than hardcoding brand blue twice.
 */
export function LogoMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Outer ring, left open at the top-right so the needle reads as
          breaking out of it rather than sitting inside a circle. */}
      <path
        d="M20.5 9.2A9 9 0 1 1 14.8 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Needle: the filled half points where you're going, the open half
          where you came from. */}
      <path d="M17 7 11.4 12.6 12.8 14 18.4 8.4Z" fill="currentColor" />
      <path
        d="M11.4 12.6 5.6 17 10.2 11.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
