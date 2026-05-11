import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  CalendarRange,
  Egg,
  LayoutDashboard,
  ListOrdered,
  Package,
  Upload,
  Users,
} from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useZeitraum } from "@/context/ZeitraumContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDatum } from "@/lib/formatierung";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/import", label: "Import", icon: <Upload className="h-4 w-4" /> },
  { to: "/kunden", label: "Kunden", icon: <Users className="h-4 w-4" /> },
  { to: "/artikel", label: "Artikel", icon: <Package className="h-4 w-4" /> },
  { to: "/ranking", label: "Ranking", icon: <ListOrdered className="h-4 w-4" /> },
  { to: "/jahresvergleich", label: "Jahresvergleich", icon: <BarChart3 className="h-4 w-4" /> },
];

function ZeitraumFilter() {
  const z = useZeitraum();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarRange className="h-4 w-4" />
          {formatDatum(z.von)} – {formatDatum(z.bis)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="space-y-2">
          <Label htmlFor="von">Von</Label>
          <Input id="von" type="date" value={z.von} onChange={(e) => z.setVon(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bis">Bis</Label>
          <Input id="bis" type="date" value={z.bis} onChange={(e) => z.setBis(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button size="sm" variant="secondary" onClick={z.dieserMonat}>
            Dieser Monat
          </Button>
          <Button size="sm" variant="secondary" onClick={z.diesesQuartal}>
            Quartal
          </Button>
          <Button size="sm" variant="secondary" onClick={z.diesesJahr}>
            Dieses Jahr
          </Button>
          <Button size="sm" variant="secondary" onClick={z.letztesJahr}>
            Letztes Jahr
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="w-60 shrink-0 border-r bg-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <Egg className="h-6 w-6 text-amber-500" />
          <span className="font-semibold">Eierverkauf</span>
        </div>
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b bg-card px-6 py-3">
          <h1 className="text-lg font-semibold text-slate-800">Kerba Bio-Ei GbR — Auswertung</h1>
          <ZeitraumFilter />
        </header>
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
