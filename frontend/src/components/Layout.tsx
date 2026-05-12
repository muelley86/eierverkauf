import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Diamond,
  LayoutDashboard,
  ListOrdered,
  Package,
  Upload,
} from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

// Reihenfolge & Beschriftungen exakt wie im Mockup („Übersicht" statt
// „Dashboard"; keine Nummerierung).
const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Übersicht", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/kunden", label: "Kunden", icon: <Diamond className="h-4 w-4" /> },
  { to: "/artikel", label: "Artikel", icon: <Package className="h-4 w-4" /> },
  { to: "/ranking", label: "Ranking", icon: <ListOrdered className="h-4 w-4" /> },
  { to: "/jahresvergleich", label: "Jahresvergleich", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/import", label: "Import", icon: <Upload className="h-4 w-4" /> },
];

/** Logo-Mark: kleiner Yolk-Kreis mit Highlight (Mockup-Stil). */
function YolkDot({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#D69826" />
      <ellipse cx="9" cy="9" rx="2.5" ry="3" fill="#F4ECD7" opacity="0.55" />
    </svg>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-rule">
        <div className="flex items-center gap-3 px-6 pt-8 pb-10">
          <YolkDot className="h-6 w-6" />
          <div className="leading-tight">
            <div className="font-display italic text-2xl text-ink">Kerba</div>
            <div className="eyebrow">Bio-Ei GbR</div>
          </div>
        </div>

        <nav className="px-3 pb-6 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 rounded-md px-4 py-2.5 text-sm transition",
                  isActive
                    ? "bg-yolk/10 text-ink font-medium"
                    : "text-muted-foreground hover:bg-yolk/5 hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-sm bg-yolk" />
                  )}
                  <span className="shrink-0">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main — kein globaler Top-Header; jede Seite startet mit <PageHeader>. */}
      <main className="flex-1 px-6 md:px-10 py-8 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
