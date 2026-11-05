import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  CalendarRange,
  LayoutDashboard,
  ListOrdered,
  Menu,
  MoreHorizontal,
  Package,
  Receipt,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import wortmarke from "@/assets/buchenhof-wortmarke.png";
import { FarbschemaUmschalter } from "@/components/FarbschemaUmschalter";
import { AppVersion } from "@/components/AppVersion";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const ICON = "h-5 w-5 shrink-0";

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Übersicht", icon: <LayoutDashboard className={ICON} /> },
  { to: "/kunden", label: "Kunden", icon: <Users className={ICON} /> },
  { to: "/artikel", label: "Artikel", icon: <Package className={ICON} /> },
  { to: "/ranking", label: "Ranking", icon: <ListOrdered className={ICON} /> },
  { to: "/belege", label: "Belege", icon: <Receipt className={ICON} /> },
  { to: "/zeitraumvergleich", label: "Zeitraumvergleich", icon: <CalendarRange className={ICON} /> },
  { to: "/jahresvergleich", label: "Jahresvergleich", icon: <BarChart3 className={ICON} /> },
  { to: "/import", label: "Import", icon: <Upload className={ICON} /> },
  { to: "/konfiguration", label: "Konfiguration", icon: <Settings className={ICON} /> },
];

// Unter md: die ersten 4 Bereiche als Tabs unten, der Rest im „Mehr"-Sheet.
const PRIMARY_MOBILE = NAV_ITEMS.slice(0, 4);
const SECONDARY_MOBILE = NAV_ITEMS.slice(4);

/** Buchenhof-Wortmarke (weiße Schrift, für die Anthrazit-Fläche) + App-Name. */
function Marke({ kompakt = false }: { kompakt?: boolean }) {
  return (
    <div className={cn("flex flex-col", kompakt ? "gap-0.5" : "gap-2")}>
      <img
        src={wortmarke}
        alt="Buchenhof"
        className={cn("w-auto", kompakt ? "h-6" : "h-9")}
        width={1181}
        height={236}
      />
      <span className={cn("text-chrome-foreground/65", kompakt ? "text-[11px]" : "text-xs")}>
        Eierverkauf · Kerba Bio-Ei GbR
      </span>
    </div>
  );
}

/** Navigationsliste auf Anthrazit — Sidebar (lg+) und Drawer (md–lg) teilen sie. */
function ChromeNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1 px-3" aria-label="Hauptnavigation">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 text-sm transition",
              isActive
                ? "bg-brand font-semibold text-brand-foreground"
                : "text-chrome-foreground/75 hover:bg-white/[0.06] hover:text-chrome-foreground",
            )
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/** Desktop-Sidebar ab lg: Anthrazit wie der Kopf von buchenhof.de. */
function DesktopSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col overflow-y-auto bg-chrome lg:flex">
      <div className="px-6 pb-8 pt-7">
        <Marke />
      </div>
      <ChromeNav />
      <div className="mt-auto border-t border-white/10 px-3 py-4">
        <FarbschemaUmschalter variante="zeile" />
        <AppVersion className="mt-2 px-3.5 text-chrome-foreground/50" />
      </div>
    </aside>
  );
}

/** Kopfzeile unter lg. Hamburger nur md–lg; darunter navigiert die Tab-Leiste. */
function MobileTopBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 bg-chrome px-4 lg:hidden"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <button
        type="button"
        onClick={onMenuOpen}
        className="-ml-2 hidden h-11 w-11 items-center justify-center rounded-lg text-chrome-foreground transition hover:bg-white/10 md:inline-flex"
        aria-label="Menü öffnen"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex h-14 items-center">
        <Marke kompakt />
      </div>
      <div className="-mr-2 ml-auto">
        <FarbschemaUmschalter variante="icon" />
      </div>
    </header>
  );
}

const TAB_KLASSEN =
  "flex min-h-[60px] w-full flex-col items-center justify-center gap-1 pb-1.5 pt-2 text-[11px] font-medium transition active:scale-95";

/** Icon mit grüner Pille, wenn aktiv. */
function TabIcon({ aktiv, children }: { aktiv: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-7 w-12 items-center justify-center rounded-full transition",
        aktiv && "bg-brand text-brand-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** Untere Tab-Leiste: nur unter md, 4 Bereiche + „Mehr". */
function MobileBottomNav({ onMoreOpen, moreActive }: { onMoreOpen: () => void; moreActive: boolean }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface/95 backdrop-blur md:hidden"
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
                cn(TAB_KLASSEN, isActive ? "text-ink" : "text-muted-foreground")
              }
            >
              {({ isActive }) => (
                <>
                  <TabIcon aktiv={isActive}>{item.icon}</TabIcon>
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
            className={cn(TAB_KLASSEN, moreActive ? "text-ink" : "text-muted-foreground")}
            aria-label="Weitere Bereiche"
          >
            <TabIcon aktiv={moreActive}>
              <MoreHorizontal className={ICON} />
            </TabIcon>
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

  const moreActive = SECONDARY_MOBILE.some((it) => location.pathname.startsWith(it.to));

  // Beim Routenwechsel offene Sheets schließen (Drawer + Mehr).
  useEffect(() => {
    setDrawerOpen(false);
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh bg-background">
      <DesktopSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar onMenuOpen={() => setDrawerOpen(true)} />

        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 md:px-8 md:pb-10 md:pt-8 lg:px-10">
          <Outlet />
        </main>
      </div>

      {/* Drawer (md–lg): gleiche Anthrazit-Navigation wie die Sidebar */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 border-none bg-chrome p-0 text-chrome-foreground">
          <SheetHeader className="px-6 pb-6 pt-7 text-left">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Marke />
          </SheetHeader>
          <ChromeNav onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <MobileBottomNav onMoreOpen={() => setMoreOpen(true)} moreActive={moreActive} />

      {/* „Mehr"-Sheet mit den übrigen Bereichen */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Weitere Bereiche</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-1 px-2 py-4">
            {SECONDARY_MOBILE.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-[48px] items-center gap-3 rounded-xl px-4 text-sm transition",
                    isActive ? "bg-brand font-semibold text-brand-foreground" : "text-ink hover:bg-brand/15",
                  )
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
          <AppVersion className="px-6 pb-2 text-muted-foreground" />
        </SheetContent>
      </Sheet>
    </div>
  );
}
