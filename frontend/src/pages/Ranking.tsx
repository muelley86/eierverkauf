import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/DataTable";
import { useZeitraum } from "@/context/ZeitraumContext";
import { getRanking, RankingZeile } from "@/api/client";
import { formatCentJeEi, formatEuro, formatZahl, kuerzeText } from "@/lib/formatierung";
import { cn } from "@/lib/utils";
import { useChartFarben } from "@/lib/chart-farben";
import { useIstMobil } from "@/hooks/useIstMobil";

type SortMode = "menge" | "umsatz";

export default function Ranking() {
  const { farben, tooltip, achse, raster } = useChartFarben();
  const istMobil = useIstMobil();
  const { von, bis } = useZeitraum();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortMode>("menge");
  const [daten, setDaten] = useState<RankingZeile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    setLoading(true);
    getRanking({ von, bis }, sort)
      .then((d) => { if (!abgebrochen) setDaten(d); })
      .catch((e) => toast.error("Ranking konnte nicht geladen werden", { description: String(e) }))
      .finally(() => { if (!abgebrochen) setLoading(false); });
    return () => { abgebrochen = true; };
  }, [von, bis, sort]);

  const top10 = useMemo(() => daten.slice(0, 10), [daten]);
  const dataKey = sort === "menge" ? "eier" : "umsatz";
  const farbe = sort === "menge" ? farben.eierFlaeche : farben.umsatz;

  const columns = useMemo<ColumnDef<RankingZeile>[]>(
    () => [
      {
        id: "rang",
        header: "#",
        meta: { mobilePriority: "secondary", mobileLabel: "Rang" },
        cell: (i) => (
          <span className="tabular-nums text-xs text-muted-foreground">
            {String(i.row.index + 1).padStart(2, "0")}
          </span>
        ),
      },
      {
        accessorKey: "kundennummer",
        header: "Nr.",
        meta: { mobilePriority: "secondary", mobileLabel: "Nr." },
        cell: (i) => <span className="tabular-nums text-xs text-muted-foreground">{i.getValue<string>()}</span>,
      },
      {
        accessorKey: "kundenname",
        header: "Name",
        meta: { mobilePriority: "primary" },
      },
      {
        accessorKey: "eier", header: "Eier",
        sortingFn: "basic",
        meta: { mobilePriority: "primary" },
        cell: (i) => <span className="tabular-nums">{formatZahl(i.getValue<number>())}</span>,
      },
      {
        accessorKey: "umsatz", header: "Umsatz",
        sortingFn: "basic",
        meta: { mobilePriority: "secondary", mobileLabel: "Umsatz" },
        cell: (i) => <span className="tabular-nums">{formatEuro(i.getValue<number>())}</span>,
      },
      {
        id: "umsatz_pro_ei",
        accessorFn: (z) => (z.eier ? (z.eier_umsatz / z.eier) * 100 : null),
        header: "Umsatz/Ei",
        sortingFn: "basic",
        meta: { mobilePriority: "secondary", mobileLabel: "Umsatz/Ei" },
        cell: (i) => (
          <span className="tabular-nums">
            {formatCentJeEi(i.row.original.eier_umsatz, i.row.original.eier)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-8 max-w-[1400px]">
      <PageHeader
        eyebrow="Ranking"
        title={sort === "menge" ? "Top-Kunden nach Eiern" : "Top-Kunden nach Umsatz"}
        subtitle="Die zehn größten Abnehmer im gewählten Zeitraum."
        actions={
          <div className="inline-flex rounded-full border border-rule bg-surface p-1">
            {(["menge", "umsatz"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSort(m)}
                className={cn(
                  "min-h-[40px] px-4 py-2 text-xs tabular-nums rounded-full transition active:scale-95",
                  sort === m ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-ink",
                )}
              >
                {m === "menge" ? "Nach Menge" : "Nach Umsatz"}
              </button>
            ))}
          </div>
        }
      />

      <Panel title="Top 10">
        {loading ? (
          <Skeleton className="h-[360px] sm:h-[450px]" />
        ) : (
          <ResponsiveContainer width="100%" height={istMobil ? 360 : 450}>
            <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid {...raster} horizontal={false} />
              <XAxis type="number" tickFormatter={(v: number) => formatZahl(v)}
                axisLine={false} tickLine={false} tick={achse} />
              <YAxis dataKey="kundenname" type="category" width={istMobil ? 104 : 200}
                tickFormatter={(name: string) => kuerzeText(name, istMobil ? 11 : 28)}
                axisLine={false} tickLine={false} tick={achse} />
              <Tooltip
                formatter={(v: number) => sort === "menge" ? formatZahl(v) : formatEuro(v)}
                contentStyle={tooltip}
                labelStyle={{ color: farben.text }}
              />
              <Bar isAnimationActive={false} dataKey={dataKey} fill={farbe} radius={[0, 4, 4, 0]} cursor="pointer"
                onClick={(d: RankingZeile) => navigate(`/kunden/${encodeURIComponent(d.kundennummer)}`)} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="Vollständige Rangliste">
        {loading ? (
          <Skeleton className="h-96" />
        ) : (
          <DataTable
            columns={columns}
            data={daten}
            filterPlatzhalter="Kunde filtern…"
            onRowClick={(z) => navigate(`/kunden/${encodeURIComponent(z.kundennummer)}`)}
          />
        )}
      </Panel>
    </div>
  );
}
