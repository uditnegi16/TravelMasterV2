import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Mail,
  BarChart3,
  Activity,
  Cpu,
} from "lucide-react";

import { cn } from "../../../lib/cn";

const navItems = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Contact", to: "/admin/contact", icon: Mail },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Monitoring", to: "/admin/monitoring", icon: Activity },
  { label: "MLOps", to: "/admin/mlops", icon: Cpu },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1280px] gap-8 px-6 py-8 lg:px-8">
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-24">
          <p className="px-3 pb-3 font-display text-lg font-semibold text-ink">
            Admin
          </p>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-muted transition-all hover:bg-brand-soft hover:text-brand",
                    isActive && "bg-brand-soft text-brand"
                  )
                }
              >
                <item.icon className="h-4 w-4" strokeWidth={2.25} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
