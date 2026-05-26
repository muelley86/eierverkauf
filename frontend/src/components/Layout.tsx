import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Diamond,
  LayoutDashboard,
  ListOrdered,
  Menu,
  MoreHorizontal,
  Package,
  Receipt,
  Settings,
  Upload,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Übersicht", icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: "/kunden", label: "Kunden", icon: <Diamond className="h-5 w-5" /> },
  { to: "/artikel", label: "Artikel", icon: <Package className="h-5 w-5" /> },
  { to: "/ranking", label: "Ranking", icon: <ListOrdered className="h-5 w-5" /> },
  { to: "/belege", label: "Belege", icon: <Receipt className="h-5 w-5" /> },
  { to: "/jahresvergleich", label: "Jahresvergleich", icon: <BarChart3 className="h-5 w-5" /> },
  { to: "/import", label: "Import", icon: <Upload className="h-5 w-5" /> },
  { to: "/konfiguration", label: "Konfiguration", icon: <Settings className="h-5 w-5" /> },
];

// Auf <md zeigt die Bottom-Nav die ersten 4 + "Mehr"-Sheet (mit dem Rest).
const PRIMARY_MOBILE = NAV_ITEMS.slice(0, 4);
const SECONDARY_MOBILE = NAV_ITEMS.slice(4);

/** Sauber gezeichnete Ei-Silhouette mit warmem Dotter-Glanz. */
function EggMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <ellipse cx="14" cy="15.5" rx="9.5" ry="11.5" fill="#FAF5E6" stroke="#1A1610" strokeWidth="1.2" />
      <ellipse cx="14" cy="16" rx="5.2" ry="6.2" fill="#D69826" />
      <ellipse cx="12.2" cy="13.5" rx="1.6" ry="2.1" fill="#F4ECD7" opacity="0.6" />
    </svg>
  );
}

/** Logo-Lockup mit Schriftzug — für Sidebar & Top-Bar wiederverwendbar. */
function LogoLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <EggMark className={compact ? "h-7 w-7" : "h-8 w-8"} />
      <div className="leading-tight">
        <div className="font-display italic text-xl text-ink">Kerba</div>
        {!compact && <div className="eyebrow">Bio-Ei GbR</div>}
      </div>
    </div>
  );
}

/** Desktop-Sidebar: ab lg sichtbar, 240 px Breite, sticky. */
function DesktopSidebar() {
  return (
    <aside className="hidden lg:flex w-[240px] shrink-0 flex-col border-r border-rule sticky top-0 h-screen">
      <div className="px-6 pt-8 pb-10">
        <LogoLockup />
      </div>
      <nav className="px-3 pb-6 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "relative flex items-center gap-3 rounded-md px-4 py-3 text-sm transition min-h-[44px]",
                "active:scale-[0.99]",
                isActive
                  ? "bg-yolk/10 text-ink font-medium"
                  : "text-muted-foreground hover:bg-yolk/5 hover:text-ink",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-sm bg-yolk" aria-hidden="true" />
                )}
                <span className="shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

/** Mobile/Tablet-Top-Bar: sticky, 56 px, mit Hamburger (Drawer). */
function MobileTopBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <header
      className="lg:hidden sticky top-0 z-30 h-14 flex items-center justify-between gap-3 px-4 border-b border-rule bg-surface/95 backdrop-blur"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <button
        type="button"
        onClick={onMenuOpen}
        className="inline-flex items-center justify-center h-11 w-11 rounded-md text-ink hover:bg-yolk/10 active:scale-95 transition"
        aria-label="Menü öffnen"
      >
        <Menu className="h-5 w-5" />
      </button>
      <LogoLockup compact />
      <span className="h-11 w-11" aria-hidden="true" />
    </header>
  );
}

/** Drawer-Inhalt: identisch zur Desktop-Sidebar, in Sheet eingebettet. */
function DrawerNav({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <SheetHeader>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <LogoLockup />
      </SheetHeader>
      <nav className="px-3 py-4 space-y-1 overflow-y-auto flex-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "relative flex items-center gap-3 rounded-md px-4 py-3 text-sm transition min-h-[48px]",
                "active:scale-[0.99]",
                isActive
                  ? "bg-yolk/10 text-ink font-medium"
                  : "text-muted-foreground hover:bg-yolk/5 hover:text-ink",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-sm bg-yolk" aria-hidden="true" />
                )}
                <span className="shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Bottom-Tab-Bar: nur <md, 4 Primaer-Tabs + "Mehr"-Sheet. */
function MobileBottomNav({
  onMoreOpen,
  moreActive,
}: {
  onMoreOpen: () => void;
  moreActive: boolean;
}) {
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Hauptnavigation"
    >
      <ul className="grid grid-cols-5">
        {PRIMARY_MOBILE.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 text-[10px] uppercase tracking-wider font-mono transition",
                  "active:scale-95",
                  isActive ? "text-yolk" : "text-muted-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-yolk" aria-hidden="true" />
                  )}
                  {item.icon}
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onMoreOpen}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 w-full min-h-[56px] py-2 text-[10px] uppercase tracking-wider font-mono transition",
              "active:scale-95",
              moreActive ? "text-yolk" : "text-muted-foreground",
            )}
            aria-label="Weitere Bereiche"
          >
            {moreActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-yolk" aria-hidden="true" />
            )}
            <MoreHorizontal className="h-5 w-5" />
            <span>Mehr</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  // Routen, die unter "Mehr" sitzen — fuer Highlight-Logik.
  const moreActive = SECONDARY_MOBILE.some((it) =>
    location.pathname.startsWith(it.to),
  );

  // Beim Routenwechsel offene Sheets schliessen (Drawer + Mehr).
  useEffect(() => {
    setDrawerOpen(false);
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh bg-background">
      <DesktopSidebar />

      <div className="flex flex-1 min-w-0 flex-col">
        {/* Mobile/Tablet-Top-Bar mit Hamburger -> Drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <MobileTopBar onMenuOpen={() => setDrawerOpen(true)} />
          <SheetTrigger className="sr-only">Menü</SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <DrawerNav onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="flex-1 px-4 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8 pb-24 md:pb-8 overflow-y-auto min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom-Nav nur unter md (<768) */}
      <MobileBottomNav onMoreOpen={() => setMoreOpen(true)} moreActive={moreActive} />

      {/* "Mehr"-Sheet (Bottom) mit Sekundaer-Items */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Weitere Bereiche</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-4 grid grid-cols-1 gap-1">
            {SECONDARY_MOBILE.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-4 py-3 text-sm min-h-[48px] transition",
                    "active:scale-[0.99]",
                    isActive
                      ? "bg-yolk/10 text-ink font-medium"
                      : "text-ink hover:bg-yolk/5",
                  )
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
