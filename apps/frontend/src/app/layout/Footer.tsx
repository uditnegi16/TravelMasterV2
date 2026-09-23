import { LogoMark } from "../components/ui/LogoMark";
import { Link } from "react-router-dom";
import { Globe, Mail, Phone } from "lucide-react";
const columns = [
  {
    title: "Product",
    links: [
      { label: "Plan a trip", to: "/plan" },
      { label: "Pricing", to: "/pricing" },
      { label: "How it works", to: "/about" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Careers", to: "/careers" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help center", to: "/help" },
      { label: "Travel guides", to: "/guides" },
      { label: "API status", to: "/status" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", to: "/privacy" },
      { label: "Terms of service", to: "/terms" },
      { label: "Cookie settings", to: "/cookies" },
    ],
  },
];

export default function Footer() {
  return (
    // Dark navy to bookend the page against the new hero (HeroSection.tsx)
    // rather than the flat light-grey it used before.
    <footer className="border-t border-white/10 bg-[#0c1a30]">
      <div className="mx-auto max-w-[1280px] px-4 py-14 md:px-8 md:py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2 md:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-amber shadow-soft text-white">
                <LogoMark className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span className="font-display text-xl font-semibold tracking-[-0.02em] text-white">
                TravelMaster
              </span>
            </Link>
            <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-white/60">
              Describe a trip in plain language. Get real flights, real
              hotels, and a plan you can actually book.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="col-span-1 md:col-span-1">
              <h4 className="text-sm font-semibold text-white">{col.title}</h4>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-white/60 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col-reverse items-center justify-between gap-6 border-t border-white/10 pt-8 md:flex-row">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} TravelMaster. All rights reserved.
          </p>

          <div className="flex items-center gap-5">
            <a aria-label="Website" href="#" className="text-white/60 hover:text-white">
              <Globe className="h-[18px] w-[18px]" />
            </a>
            <a aria-label="Email" href="#" className="text-white/60 hover:text-white">
              <Mail className="h-[18px] w-[18px]" />
            </a>
            <a aria-label="Phone" href="#" className="text-white/60 hover:text-white">
              <Phone className="h-[18px] w-[18px]" />
            </a>
          </div>

          {/* Was rendering as a bare dot with no label -- the text was
              missing entirely, not just visually hidden. */}
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-[0.7rem] font-medium text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
            Built with the TravelMaster AI Agent
          </span>
        </div>
      </div>
    </footer>
  );
}