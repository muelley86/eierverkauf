import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Bar, BarChart, Brush, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChartToggle } from "@/components/ChartToggle";
import { PageHeader, Panel } from "@/components/PageHeader";
import { exportExcelUrl, exportPdfUrl, getArtikelMonate, MonatsZeile } from "@/api/client";
import { useZeitraum } from "@/context/ZeitraumContext";
import { artikelLabel } from "@/lib/artikel";
import { formatCentJeEi, formatEuro, formatMonat, formatZahl } from "@/lib/formatierung";
import { AXIS_TICK, CHART_FARBEN, CHART_GRID, TOOLTIP_STYLE } from "@/lib/chart-farben";

export default function ArtikelDetail() {
  const { code } = useParams<{ code: string }>();
  const artikel = code ?? "";
  const { von, bis } = useZeitraum();
  const [monate, setMonate] = useState<MonatsZeile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ab = false;
    setLoading(true);
    getArtikelMonate(artikel, { von, bis })
      .then((d) => { if (!ab) setMonate(d); })
      .catch((e) => toast.error("Daten konnten nicht geladen werden", { description: String(e) }))
      .finally(() => { if (!ab) setLoading(false); });
    return () => { ab = true; };
  }, [artikel, von, bis]);

  const chartDaten = useMemo(
    () => monate.map((m) => ({ ...m, monatLabel: formatMonat(m.monat) })),
    [monate],
  );

  return (
    <div className="space-y-8 max-w-[1400px]">
      <PageHeader
        back={{ to: "/artikel", label: "Zur Artikelliste" }}
        eyebrow="Artikel"
        title={<span className="font-mono">{artikelLabel(artikel)}</span>}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="border-rule">
              <a href={exportExcelUrl({ typ: "artikel_monate", von, bis, code: artikel })} target="_blank" rel="noreferrer">
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-rule">
              <a href={exportPdfUrl({ typ: "artikel_monate", von, bis, code: artikel })} target="_blank" rel="noreferrer">
                <FileText className="h-4 w-4" /> PDF
              </a>
            </Button>
          </>
        }
      />

      <Panel eyebrow="Chart" title="Monatsverlauf">
        {loading ? <Skeleton className="h-[350px]" /> : (
          <ChartToggle render={(modus) => (
            <ResponsiveContainer width="100%" height={350}>
              {modus === "bar" ? (
                <BarChart data={chartDaten} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid {...CHART_GRID} vertical={false} />
                  <XAxis dataKey="monatLabel" stroke={CHART_FARBEN.inkMuted} tick={AXIS_TICK} />
                  <YAxis tickFormatter={(v: number) => formatZahl(v)} stroke={CHART_FARBEN.inkMuted} tick={AXIS_TICK} />
                  <Tooltip formatter={(v: number) => formatZahl(v)} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="eier" fill={CHART_FARBEN.yolk} radius={[4, 4, 0, 0]} />
                  <Brush dataKey="monatLabel" height={20} stroke={CHART_FARBEN.yolk} fill={CHART_FARBEN.surface} />
                </BarChart>
              ) : (
                <LineChart data={chartDaten} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid {...CHART_GRID} vertical={false} />
                  <XAxis dataKey="monatLabel" stroke={CHART_FARBEN.inkMuted} tick={AXIS_TICK} />
                  <YAxis tickFormatter={(v: number) => formatZahl(v)} stroke={CHART_FARBEN.inkMuted} tick={AXIS_TICK} />
                  <Tooltip formatter={(v: number) => formatZahl(v)} contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="eier" stroke={CHART_FARBEN.yolk} strokeWidth={2} dot={{ fill: CHART_FARBEN.yolk, r: 3 }} />
                  <Brush dataKey="monatLabel" height={20} stroke={CHART_FARBEN.yolk} fill={CHART_FARBEN.surface} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )} />
        )}
      </Panel>

      <Panel eyebrow="Tabelle" title="Detailwerte">
        <div className="-mx-6 px-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-rule">
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Monat</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Menge</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Eier</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Umsatz</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Umsatz/Ei</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monate.map((m) => (
                <TableRow key={m.monat} className="border-rule">
                  <TableCell>{formatMonat(m.monat)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{formatZahl(m.menge ?? 0, 2)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{formatZahl(m.eier)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{formatEuro(m.umsatz)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{formatCentJeEi(m.eier_umsatz, m.eier)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
}
