export function RoutePathDecoration() {
  return (
    <svg
      viewBox="0 0 1200 500"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.5]"
    >
      <path
        d="M40 380 C 260 100, 480 480, 700 180 S 1100 60, 1160 120"
        stroke="#D2D6E2"
        strokeWidth="1.5"
        strokeDasharray="1 9"
        strokeLinecap="round"
      />
      <g className="animate-drift" style={{ transformOrigin: "700px 180px" }}>
        <circle cx="700" cy="180" r="3.5" fill="#2454E0" />
        <circle cx="700" cy="180" r="9" fill="#2454E0" opacity="0.12" />
      </g>
      <circle cx="40" cy="380" r="3" fill="#9599A6" />
      <circle cx="1160" cy="120" r="3" fill="#9599A6" />
    </svg>
  );
}
