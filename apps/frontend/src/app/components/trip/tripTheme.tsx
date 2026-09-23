/**
 * Color logic for trip package tiers and flight/hotel/place categories.
 *
 * Deliberately reuses the three accent tokens that already exist in
 * tailwind.config.js (accent-teal, accent-amber, brand) rather than
 * introducing new colors — this is a values change, not a new palette.
 */

export type TierTheme = {
  /** small header banner behind the tier name (stand-in for a destination photo) */
  banner: string;
  badgeBg: string;
  badgeText: string;
  costText: string;
  button: string;
  label: string;
};

const TIERS: Record<string, TierTheme> = {
  budget: {
    banner: "bg-gradient-to-br from-accent-teal to-[#0b6d61]",
    badgeBg: "bg-accent-tealSoft",
    badgeText: "text-accent-teal",
    costText: "text-accent-teal",
    button: "bg-accent-teal hover:brightness-110",
    label: "Budget friendly",
  },
  luxury: {
    banner: "bg-gradient-to-br from-accent-amber to-[#8a5c06]",
    badgeBg: "bg-accent-amberSoft",
    badgeText: "text-accent-amber",
    costText: "text-accent-amber",
    button: "bg-accent-amber hover:brightness-110",
    label: "Premium pick",
  },
  value: {
    // Fixed hexes like the other two tiers: brand/brand-active are
    // theme tokens that LIGHTEN in dark mode, which turned this banner
    // pale and washed out the white "AI Recommended" pill on top of it.
    banner: "bg-gradient-to-br from-[#2454e0] to-[#17399e]",
    badgeBg: "bg-brand-soft",
    badgeText: "text-brand-text",
    costText: "text-brand-text",
    // Fixed hex for the same reason as the banner above: bg-brand
    // lightens in dark mode, leaving white button text unreadable.
    button: "bg-[#2454e0] hover:bg-[#1d46c4]",
    label: "Best value",
  },
};

const FALLBACK_ORDER = [TIERS.budget, TIERS.luxury, TIERS.value];

/**
 * Picks a tier theme from the package's profile name (e.g. "Budget Saver",
 * "Luxury", "Best Value"). Falls back to cycling through the three themes
 * by card position so an unrecognized profile name still looks intentional
 * instead of defaulting to plain brand blue every time.
 */
export function getTierTheme(profile: string | undefined, index: number): TierTheme {
  const key = (profile ?? "").toLowerCase();

  if (key.includes("budget")) return TIERS.budget;
  if (key.includes("luxury") || key.includes("premium")) return TIERS.luxury;
  if (key.includes("value")) return TIERS.value;

  return FALLBACK_ORDER[index % FALLBACK_ORDER.length];
}

export type CategoryTheme = {
  badgeBg: string;
  badgeText: string;
  dot: string;
};

// One consistent color per data category, used everywhere that category
// appears — hero chips, trip cards, and (later) the itinerary timeline —
// so a user learns the color once and it holds across the whole product.
export const CATEGORY: Record<"flight" | "hotel" | "place" | "weather", CategoryTheme> = {
  flight: {
    badgeBg: "bg-brand-soft",
    badgeText: "text-brand-text",
    dot: "bg-brand",
  },
  hotel: {
    badgeBg: "bg-accent-amberSoft",
    badgeText: "text-accent-amber",
    dot: "bg-accent-amber",
  },
  place: {
    badgeBg: "bg-accent-tealSoft",
    badgeText: "text-accent-teal",
    dot: "bg-accent-teal",
  },
  weather: {
    badgeBg: "bg-surface-sunken",
    badgeText: "text-ink-muted",
    dot: "bg-ink-faint",
  },
};