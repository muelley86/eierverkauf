import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CircleDollarSign, Egg, Layers, Users } from "lucide-react";
import { toast } from "sonner";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useZeitraum } from "@/context/ZeitraumContext";
import {
  DashboardResponse,
  getDashboard,
  KundeTop,
  ArtikelTop,
} from "@/api/client";
import { formatEuro, formatZahl } from "@/lib/formatierung";

const FARBE_EIER = "#2563eb";
const FARBE_UMSATZ = "#16a34a";

export default function Dashboard() {
  const { von, bis } = useZeitraum();
  const navigate = useNavigate();
  const [daten, setDaten] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    setLoading(true);
    getDashboard({ von, bis })
      .then((d) => {
        if (!abgebrochen) setDaten(d);
      })
      .catch((e) => {
        toast.error("Dashboard konnte nicht geladen werden", { description: String(e) });
      })
      .finally(() => {
        if (!abgebrochen) setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [von, bis]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !daten ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <KPICard
              titel="Eier (Stück)"
              wert={formatZahl(daten.kpis.gesamt_eier)}
              icon={<Egg className="h-4 w-4 text-amber-500" />}
            />
            <KPICard
              titel="Umsatz"
              wert={formatEuro(daten.kpis.umsatz)}
              icon={<CircleDollarSign className="h-4 w-4 text-emerald-600" />}
            />
            <KPICard
              titel="Kunden"
              wert={formatZahl(daten.kpis.anzahl_kunden)}
              icon={<Users className="h-4 w-4 text-blue-600" />}
            />
            <KPICard
              titel="Positionen"
              wert={formatZahl(daten.kpis.anzahl_positionen)}
              icon={<Layers className="h-4 w-4 text-slate-500" />}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Kunden (Eier)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !daten ? (
              <Skeleton className="h-[300px]" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={daten.top5_kunden} margin={{ top: 10, right: 12, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="kundenname"
                    angle={-15}
                    textAnchor="end"
                    interval={0}
                    height={50}
                  />
                  <YAxis tickFormatter={(v: number) => formatZahl(v)} />
                  <Tooltip
                    formatter={(v: number) => formatZahl(v)}
                    labelClassName="text-slate-700"
                  />
                  <Bar
                    dataKey="eier"
                    fill={FARBE_EIER}
                    onClick={(d: KundeTop) =>
                      navigate(`/kunden/${encodeURIComponent(d.kundennummer)}`)
                    }
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Artikel (Umsatz)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !daten ? (
              <Skeleton className="h-[300px]" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={daten.top5_artikel} margin={{ top: 10, right: 12, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="artikel_code" />
                  <YAxis tickFormatter={(v: number) => formatZahl(v)} />
                  <Tooltip formatter={(v: number) => formatEuro(v)} />
                  <Bar
                    dataKey="umsatz"
                    fill={FARBE_UMSATZ}
                    onClick={(d: ArtikelTop) =>
                      navigate(`/artikel/${encodeURIComponent(d.artikel_code)}`)
                    }
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
