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
import { formatEuro, formatZahl } from "@/lib/formatierung";
import { cn } from "@/lib/utils";
import { AXIS_TICK, CHART_FARBEN, CHART_GRID, TOOLTIP_STYLE } from "@/lib/chart-farben";

type SortMode = "menge" | "umsatz";

export default function Ranking() {
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
  const farbe = sort === "menge" ? CHART_FARBEN.yolk : CHART_FARBEN.sage;

  const columns = useMemo<ColumnDef<RankingZeile>[]>(
    () => [
      {
        id: "rang",
        header: "#",
        cell: (i) => (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {String(i.row.index + 1).padStart(2, "0")}
          </span>
        ),
      },
      {
        accessorKey: "kundennummer",
        header: "Nr.",
        cell: (i) => <span className="font-mono text-xs text-muted-foreground">{i.getValue<string>()}</span>,
      },
      { accessorKey: "kundenname", header: "Name" },
      {
        accessorKey: "eier", header: "Eier",
        sortingFn: "basic",
        cell: (i) => <span className="font-mono tabular-nums">{formatZahl(i.getValue<number>())}</span>,
      },
      {
        accessorKey: "umsatz", header: "Umsatz",
        sortingFn: "basic",
        cell: (i) => <span className="font-mono tabular-nums">{formatEuro(i.getValue<number>())}</span>,
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
                  "min-h-[40px] px-4 py-2 text-xs font-mono uppercase tracking-[0.1em] rounded-full transition active:scale-95",
                  sort === m ? "bg-yolk text-ink" : "text-muted-foreground hover:text-ink",
                )}
              >
                {m === "menge" ? "Nach Menge" : "Nach Umsatz"}
              </button>
            ))}
          </div>
        }
      />

      <Panel eyebrow="Chart" title="Top 10">
        {loading ? (
          <Skeleton className="h-[450px]" />
        ) : (
          <ResponsiveContainer width="100%" height={450}>
            <BarChart data={top10} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
              <CartesianGrid {...CHART_GRID} horizontal={false} />
              <XAxis type="number" tickFormatter={(v: number) => formatZahl(v)}
                stroke={CHART_FARBEN.inkMuted} tick={AXIS_TICK} />
              <YAxis dataKey="kundenname" type="category" width={150}
                stroke={CHART_FARBEN.inkMuted} tick={AXIS_TICK} />
              <Tooltip
                formatter={(v: number) => sort === "menge" ? formatZahl(v) : formatEuro(v)}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: CHART_FARBEN.ink }}
              />
              <Bar dataKey={dataKey} fill={farbe} radius={[0, 4, 4, 0]} cursor="pointer"
                onClick={(d: RankingZeile) => navigate(`/kunden/${encodeURIComponent(d.kundennummer)}`)} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel eyebrow="Tabelle" title="Vollständige Rangliste">
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
