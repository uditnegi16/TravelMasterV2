type BlobProps = {
  className?: string;
};

/**
 * Soft out-of-focus colour washes for flat marketing sections.
 *
 * Every page except the landing hero was a single flat fill, which is
 * what read as undesigned. These use the existing palette tokens rather
 * than new image assets, sit behind content with pointer-events-none,
 * and are blurred far enough that they never compete with text.
 *
 * Deliberately not used on Chat or Trip Results -- dense data screens
 * should stay quiet.
 */
export function SoftBlobs({ className }: BlobProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      <div className="absolute -left-24 top-[-10%] h-72 w-72 rounded-full bg-brand-soft opacity-70 blur-3xl" />
      <div className="absolute -right-20 top-[30%] h-64 w-64 rounded-full bg-accent-tealSoft opacity-60 blur-3xl" />
      <div className="absolute bottom-[-15%] left-[35%] h-56 w-56 rounded-full bg-accent-amberSoft opacity-50 blur-3xl" />
    </div>
  );
}

/**
 * A faint line-art world map, used as a watermark behind a single
 * section. Kept at very low opacity so it reads as texture, not
 * illustration, and drawn as simplified landmass outlines rather than an
 * accurate projection -- at 6% opacity nobody is checking Greenland.
 */
export function WorldMapWatermark({ className }: BlobProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 400"
      fill="none"
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-[0.06] ${className ?? ""}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <g stroke="currentColor" strokeWidth="1.5" className="text-ink">
        {/* North America */}
        <path d="M95 70 L150 58 L205 74 L222 112 L196 150 L168 188 L140 168 L124 128 L96 104 Z" />
        {/* South America */}
        <path d="M196 206 L228 196 L244 232 L232 288 L208 330 L188 294 L186 246 Z" />
        {/* Europe */}
        <path d="M368 72 L420 62 L446 84 L432 112 L396 122 L372 104 Z" />
        {/* Africa */}
        <path d="M386 138 L448 130 L470 172 L456 232 L424 288 L396 254 L378 196 Z" />
        {/* Asia */}
        <path d="M462 62 L580 52 L672 78 L700 122 L648 158 L560 150 L492 128 L464 96 Z" />
        {/* South and South-East Asia */}
        <path d="M556 164 L596 158 L612 196 L580 214 L558 190 Z" />
        {/* Australia */}
        <path d="M624 244 L692 238 L712 274 L678 302 L634 288 Z" />
      </g>
    </svg>
  );
}
