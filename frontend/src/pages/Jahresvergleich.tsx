import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader, Panel } from "@/components/PageHeader";
import { exportExcelUrl, exportPdfUrl, getJahresvergleich, JahresvergleichZeile } from "@/api/client";
import { formatZahl, monatsKurz } from "@/lib/formatierung";
import { AXIS_TICK, CHART_FARBEN, CHART_GRID, TOOLTIP_STYLE } from "@/lib/chart-farben";

export default function Jahresvergleich() {
  const aktuellesJahr = new Date().getFullYear();
  const [jahr, setJahr] = useState<number>(aktuellesJahr);
  const [daten, setDaten] = useState<JahresvergleichZeile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ab = false;
    setLoading(true);
    getJahresvergleich(jahr)
      .then((d) => { if (!ab) setDaten(d); })
      .catch((e) => toast.error("Jahresvergleich-Fehler", { description: String(e) }))
      .finally(() => { if (!ab) setLoading(false); });
    return () => { ab = true; };
  }, [jahr]);

  const jahrOptionen = Array.from({ length: 6 }, (_, i) => aktuellesJahr - i);
  const summe = (key: keyof JahresvergleichZeile) =>
    daten.reduce((acc, d) => acc + Number(d[key] ?? 0), 0);

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* PageHeader gemäß Mockup: schlicht, ohne Eyebrow, ohne Zeitraumfilter, ohne Actions. */}
      <PageHeader
        title="Jahresvergleich"
        subtitle="Aktuelles Jahr vs. Vorjahr."
        withZeitraumFilter={false}
      />

      <Panel
        eyebrow="Vergleich"
        title={<>{jahr} <span className="italic">vs.</span> {jahr - 1}</>}
        actions={
          <div className="flex items-center gap-3">
            {/* Legende */}
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-yolk" /> {jahr}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_FARBEN.vorjahr }} /> {jahr - 1}
              </span>
            </div>
            {/* Funktionale Aktionen (im Mockup nicht abgebildet, hier dezent neben Legende) */}
            <Select
              value={String(jahr)}
              onChange={(e) => setJahr(Number(e.target.value))}
              className="h-8 w-24 border-rule text-xs font-mono"
            >
              {jahrOptionen.map((j) => <option key={j} value={j}>{j}</option>)}
            </Select>
            <Button asChild variant="outline" size="sm" className="h-8 border-rule">
              <a href={exportExcelUrl({ typ: "jahresvergleich", jahr })} target="_blank" rel="noreferrer" aria-label="Excel-Export">
                <FileSpreadsheet className="h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 border-rule">
              <a href={exportPdfUrl({ typ: "jahresvergleich", jahr })} target="_blank" rel="noreferrer" aria-label="PDF-Export">
                <FileText className="h-4 w-4" />
              </a>
            </Button>
          </div>
        }
      >
        {loading ? <Skeleton className="h-[360px]" /> : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={daten.map((d) => ({ ...d, monatLabel: monatsKurz(d.monat) }))}
              margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
              barCategoryGap="32%"
              barGap={4}
            >
              <CartesianGrid {...CHART_GRID} vertical={false} />
              <XAxis
                dataKey="monatLabel"
                stroke={CHART_FARBEN.inkMuted}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatZahl(v)}
                stroke={CHART_FARBEN.inkMuted}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v: number) => formatZahl(v)}
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "rgba(214,152,38,0.06)" }}
              />
              {/* Reihenfolge im Mockup: Vorjahr links/grau, Jahr rechts/orange */}
              <Bar dataKey="vorjahr" name={String(jahr - 1)} fill={CHART_FARBEN.vorjahr} radius={[2, 2, 0, 0]} />
              <Bar dataKey="jahr"    name={String(jahr)}     fill={CHART_FARBEN.yolk} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Tabelle im Mockup-Stil: nur Eier-Spalten, Vorjahr-vor-Jahr-Reihenfolge, kein Panel-Header. */}
      <Panel>
        {loading ? <Skeleton className="h-72" /> : (
          <div className="-mx-6 px-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-rule hover:bg-transparent">
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Monat</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground text-right">{jahr - 1}</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground text-right">{jahr}</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground text-right">Δ Stück</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground text-right">Δ %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daten.map((d) => {
                const prozent = d.vorjahr > 0 ? (d.differenz / d.vorjahr) * 100 : 0;
                const deltaKlasse = d.differenz > 0 ? "text-sage" : d.differenz < 0 ? "text-brick" : "text-muted-foreground";
                return (
                  <TableRow key={d.monat} className="border-rule hover:bg-yolk/[0.04]">
                    <TableCell className="font-medium text-ink">{monatsKurz(d.monat)}</TableCell>
                    <TableCell className="font-mono tabular-nums text-right">{formatZahl(d.vorjahr)}</TableCell>
                    <TableCell className="font-mono tabular-nums text-right">{formatZahl(d.jahr)}</TableCell>
                    <TableCell className={`font-mono tabular-nums text-right ${deltaKlasse}`}>
                      {d.differenz > 0 ? "+" : ""}{formatZahl(d.differenz)}
                    </TableCell>
                    <TableCell className={`font-mono tabular-nums text-right ${deltaKlasse}`}>
                      {d.vorjahr > 0 ? `${prozent > 0 ? "+" : ""}${formatZahl(prozent, 1)} %` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Summenzeile dezent — funktional erhalten, im Mockup nur abgeschnitten. */}
              <TableRow className="border-t-2 border-rule bg-background/40 hover:bg-background/40 font-semibold">
                <TableCell className="text-ink">Summe</TableCell>
                <TableCell className="font-mono tabular-nums text-right">{formatZahl(summe("vorjahr"))}</TableCell>
                <TableCell className="font-mono tabular-nums text-right">{formatZahl(summe("jahr"))}</TableCell>
                <TableCell className="font-mono tabular-nums text-right">
                  {summe("differenz") > 0 ? "+" : ""}{formatZahl(summe("differenz"))}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
