import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Bookmark, Bell, Menu, X, Compass } from "lucide-react";

import { Button } from "../components/ui/Button";
import { IconButton } from "../components/ui/IconButton";
import { cn } from "../../lib/cn";

const navItems = [
  { label: "Plan a trip", to: "/plan" },
  { label: "Pricing", to: "/pricing" },
  { label: "Help", to: "/help" },
  { label: "About", to: "/about" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1220px] items-center justify-between px-4 md:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white">
            <Compass className="h-4 w-4" strokeWidth={2.25} />
          </span>

          <span className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
            TravelMaster
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink",
                  isActive && "text-ink"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <IconButton aria-label="Saved trips" variant="subtle" size="sm">
            <Bookmark />
          </IconButton>

          <IconButton
            aria-label="Notifications"
            variant="subtle"
            size="sm"
          >
            <Bell />
          </IconButton>

          <div className="mx-1.5 h-6 w-px bg-border" />

          <Button variant="ghost" size="sm">
            Sign in
          </Button>

          <Button variant="primary" size="sm">
            Sign up
          </Button>
        </div>

        <button
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-surface-subtle md:hidden"
        >
          {open ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {open && (
        <div className="animate-fadeIn border-t border-border bg-white px-4 pb-5 pt-2 md:hidden">
          <nav className="flex flex-col">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-[0.95rem] font-medium text-ink-muted hover:bg-surface-subtle hover:text-ink"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-3 flex items-center gap-2 border-t border-border pt-4">
            <Button variant="outline" size="md" fullWidth>
              Sign in
            </Button>

            <Button variant="primary" size="md" fullWidth>
              Sign up
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}