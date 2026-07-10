import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Bookmark, Bell, Menu, X, Compass } from "lucide-react";

import { Button } from "../components/ui/Button";
import { IconButton } from "../components/ui/IconButton";
import { cn } from "../../lib/cn";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/clerk-react";
const navItems = [
  { label: "Chat", to: "/chat" },
  { label: "Pricing", to: "/pricing" },
  { label: "Help", to: "/help" },
  { label: "About", to: "/about" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand shadow-soft text-white">
            <Compass className="h-4 w-4" strokeWidth={2.25} />
          </span>

          <span className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">
            TravelMaster
          </span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-2 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-muted transition-all hover:bg-brand-soft hover:text-brand",
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

          <div className="mx-2 h-7 w-px bg-border" />

          <SignedOut>
          <SignInButton mode="modal">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </SignInButton>

          <SignUpButton mode="modal">
            <Button variant="primary" size="sm">
              Sign up
            </Button>
          </SignUpButton>
        </SignedOut>

        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
        </div>

        <button
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-surface-subtle md:hidden"
        >
          {open ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {open && (
        <div className="animate-fadeIn border-t border-border bg-white shadow-card px-4 pb-5 pt-2 md:hidden">
          <nav className="flex flex-col">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-[0.95rem] font-medium text-ink-muted hover:bg-surface-subtle hover:text-ink"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-3 flex items-center gap-2 border-t border-border pt-4">
           <SignedOut>
            <SignInButton mode="modal">
              <Button variant="outline" size="md" fullWidth>
                Sign in
              </Button>
            </SignInButton>

            <SignUpButton mode="modal">
              <Button variant="primary" size="md" fullWidth>
                Sign up
              </Button>
            </SignUpButton>
          </SignedOut>

          <SignedIn>
            <div className="flex w-full justify-center">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          </div>
        </div>
      )}
    </header>
  );
}