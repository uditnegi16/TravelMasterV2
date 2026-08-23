/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["'Bricolage Grotesque'", "sans-serif"],
        sans: ["Manrope", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      fontSize: {
        micro: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
        xs: ["0.75rem", { lineHeight: "1.1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.9375rem", { lineHeight: "1.55rem" }],
        md: ["1.0625rem", { lineHeight: "1.65rem" }],
        lg: ["1.25rem", { lineHeight: "1.7rem" }],
        xl: ["1.5rem", { lineHeight: "1.9rem" }],
        "2xl": ["1.875rem", { lineHeight: "2.2rem" }],
        "3xl": ["2.5rem", { lineHeight: "2.7rem" }],
        "4xl": ["3.25rem", { lineHeight: "3.35rem", letterSpacing: "-0.02em" }],
        "5xl": ["4.375rem", { lineHeight: "4.35rem", letterSpacing: "-0.025em" }],
      },
      colors: {
        // Semantic tokens resolve through CSS variables so a single
        // `dark` class on <html> re-themes every existing utility
        // (bg-surface, text-ink, border-border) with no component edits.
        // Values live in styles/globals.css as "R G B" triplets.
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
          inverse: "rgb(var(--ink-inverse) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          subtle: "rgb(var(--surface-subtle) / <alpha-value>)",
          sunken: "rgb(var(--surface-sunken) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          strong: "rgb(var(--border-strong) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          hover: "rgb(var(--brand-hover) / <alpha-value>)",
          active: "rgb(var(--brand-active) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
          softer: "rgb(var(--brand-softer) / <alpha-value>)",
          text: "rgb(var(--brand-text) / <alpha-value>)",
        },
        accent: {
          teal: "#0E9F8E",
          tealSoft: "rgb(var(--accent-teal-soft) / <alpha-value>)",
          amber: "#C9820A",
          amberSoft: "rgb(var(--accent-amber-soft) / <alpha-value>)",
          green: "#178A4C",
          greenSoft: "rgb(var(--accent-green-soft) / <alpha-value>)",
          red: "#D6432F",
          redSoft: "rgb(var(--accent-red-soft) / <alpha-value>)",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(18,20,28,0.04), 0 1px 1px rgba(18,20,28,0.03)",
        card: "0 1px 3px rgba(18,20,28,0.05), 0 8px 24px -12px rgba(18,20,28,0.10)",
        raised: "0 4px 16px -4px rgba(18,20,28,0.12), 0 2px 6px -2px rgba(18,20,28,0.06)",
        focus: "0 0 0 4px rgba(36,84,224,0.14)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        drift: {
          "0%": { transform: "translateX(0) translateY(0)" },
          "50%": { transform: "translateX(6px) translateY(-4px)" },
          "100%": { transform: "translateX(0) translateY(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both",
        fadeIn: "fadeIn 0.4s ease both",
        pulseSoft: "pulseSoft 2s ease-in-out infinite",
        drift: "drift 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
