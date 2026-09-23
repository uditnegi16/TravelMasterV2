/**
 * Illustrated backdrop for the landing hero.
 *
 * Deliberately flat/vector rather than a photograph: it ships as inline SVG
 * (zero asset weight, crisp at any size, no CLS while an image loads) and
 * needs no CDN or image pipeline. Swap the <g id="hills"> layer for a real
 * destination photo later if the brand wants photography instead — the
 * scrim and text-color choices in HeroSection were built to work either way.
 */
export function HeroScene() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0c1a30]">
      <svg
        viewBox="0 0 1400 600"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c1a30" />
            <stop offset="100%" stopColor="#12335c" />
          </linearGradient>
          <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#173a68" />
            <stop offset="100%" stopColor="#0e2a4d" />
          </linearGradient>
        </defs>

        <rect width="1400" height="600" fill="url(#sky)" />

        {/* sun / moon glow */}
        <circle cx="1080" cy="150" r="150" fill="#C9820A" opacity="0.10" />
        <circle cx="1080" cy="150" r="46" fill="#E8A23D" opacity="0.9" />

        {/* stars, subtle */}
        <g fill="#ffffff" opacity="0.35">
          <circle cx="180" cy="90" r="1.6" />
          <circle cx="320" cy="150" r="1.2" />
          <circle cx="460" cy="70" r="1.6" />
          <circle cx="720" cy="110" r="1.2" />
          <circle cx="880" cy="60" r="1.6" />
          <circle cx="140" cy="220" r="1.2" />
        </g>

        {/* layered hills */}
        <path
          d="M0,420 C 180,340 340,380 520,410 C 700,440 860,360 1040,390 C 1180,412 1300,380 1400,400 L1400,600 L0,600 Z"
          fill="url(#hillFar)"
        />
        <path
          d="M0,480 C 220,410 380,470 600,450 C 800,432 920,500 1120,470 C 1240,452 1320,470 1400,460 L1400,600 L0,600 Z"
          fill="#0e2444"
        />
        <path
          d="M0,540 C 260,500 460,560 700,530 C 900,506 1080,560 1400,520 L1400,600 L0,600 Z"
          fill="#091a34"
        />
      </svg>

      {/* scrim: keeps hero copy legible regardless of where the SVG detail sits */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c1a30]/70 via-[#0c1a30]/55 to-[#0c1a30]/85" />
    </div>
  );
}