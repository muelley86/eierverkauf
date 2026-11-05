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
import { TABELLE_STICKY_ERSTE_SPALTE } from "@/lib/tabelle";
import { PageHeader, Panel } from "@/components/PageHeader";
import { exportExcelUrl, exportPdfUrl, getJahresvergleich, JahresvergleichZeile } from "@/api/client";
import { formatCentJeEi, formatZahl, monatsKurz } from "@/lib/formatierung";
import { useChartFarben } from "@/lib/chart-farben";
import { useIstMobil } from "@/hooks/useIstMobil";

export default function Jahresvergleich() {
  const { farben, tooltip, achse, raster } = useChartFarben();
  const istMobil = useIstMobil();
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
        title={<>{jahr} vs. {jahr - 1}</>}
        actions={
          <div className="flex items-center gap-3">
            {/* Legende */}
            <div className="hidden sm:flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand" /> {jahr}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: farben.vorjahr }} /> {jahr - 1}
              </span>
            </div>
            {/* Funktionale Aktionen (im Mockup nicht abgebildet, hier dezent neben Legende) */}
            <Select
              value={String(jahr)}
              onChange={(e) => setJahr(Number(e.target.value))}
              className="h-8 w-24 border-rule text-xs tabular-nums"
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
        {loading ? <Skeleton className="h-[260px] sm:h-[360px]" /> : (
          <ResponsiveContainer width="100%" height={istMobil ? 260 : 360}>
            <BarChart
              data={daten.map((d) => ({ ...d, monatLabel: monatsKurz(d.monat) }))}
              margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
              barCategoryGap={istMobil ? "14%" : "28%"}
              barGap={istMobil ? 1 : 4}
            >
              <CartesianGrid {...raster} vertical={false} />
              <XAxis
                dataKey="monatLabel"
                stroke={farben.text}
                tick={achse}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatZahl(v)}
                stroke={farben.text}
                tick={achse}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v: number) => formatZahl(v)}
                contentStyle={tooltip}
                cursor={{ fill: farben.raster, opacity: 0.5 }}
              />
              {/* Reihenfolge im Mockup: Vorjahr links/grau, Jahr rechts/orange */}
              <Bar isAnimationActive={false} maxBarSize={56} dataKey="vorjahr" name={String(jahr - 1)} fill={farben.vorjahr} radius={[3, 3, 0, 0]} />
              <Bar isAnimationActive={false} maxBarSize={56} dataKey="jahr"    name={String(jahr)}     fill={farben.eierFlaeche} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Tabelle im Mockup-Stil: nur Eier-Spalten, Vorjahr-vor-Jahr-Reihenfolge, kein Panel-Header. */}
      <Panel>
        {loading ? <Skeleton className="h-72" /> : (
          <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto">
          <Table className={TABELLE_STICKY_ERSTE_SPALTE}>
            <TableHeader>
              <TableRow className="border-rule hover:bg-transparent">
                <TableHead className="tabular-nums text-xs text-muted-foreground">Monat</TableHead>
                <TableHead className="tabular-nums text-xs text-muted-foreground text-right">{jahr - 1}</TableHead>
                <TableHead className="tabular-nums text-xs text-muted-foreground text-right">{jahr}</TableHead>
                <TableHead className="tabular-nums text-xs text-muted-foreground text-right">Δ Stück</TableHead>
                <TableHead className="tabular-nums text-xs text-muted-foreground text-right">Δ %</TableHead>
                <TableHead className="tabular-nums text-xs text-muted-foreground text-right">Umsatz/Ei {jahr - 1}</TableHead>
                <TableHead className="tabular-nums text-xs text-muted-foreground text-right">Umsatz/Ei {jahr}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daten.map((d) => {
                const prozent = d.vorjahr > 0 ? (d.differenz / d.vorjahr) * 100 : 0;
                const deltaKlasse = d.differenz > 0 ? "text-positive" : d.differenz < 0 ? "text-negative" : "text-muted-foreground";
                return (
                  <TableRow key={d.monat} className="border-rule hover:bg-brand/[0.04]">
                    <TableCell className="font-medium text-ink">{monatsKurz(d.monat)}</TableCell>
                    <TableCell className="tabular-nums text-right">{formatZahl(d.vorjahr)}</TableCell>
                    <TableCell className="tabular-nums text-right">{formatZahl(d.jahr)}</TableCell>
                    <TableCell className={`tabular-nums tabular-nums text-right ${deltaKlasse}`}>
                      {d.differenz > 0 ? "+" : ""}{formatZahl(d.differenz)}
                    </TableCell>
                    <TableCell className={`tabular-nums tabular-nums text-right ${deltaKlasse}`}>
                      {d.vorjahr > 0 ? `${prozent > 0 ? "+" : ""}${formatZahl(prozent, 1)} %` : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-right">
                      {formatCentJeEi(d.vorjahr_eier_umsatz, d.vorjahr)}
                    </TableCell>
                    <TableCell className="tabular-nums text-right">
                      {formatCentJeEi(d.jahr_eier_umsatz, d.jahr)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Summenzeile dezent — funktional erhalten, im Mockup nur abgeschnitten. */}
              <TableRow className="border-t-2 border-rule bg-background/40 hover:bg-background/40 font-semibold">
                <TableCell className="text-ink">Summe</TableCell>
                <TableCell className="tabular-nums text-right">{formatZahl(summe("vorjahr"))}</TableCell>
                <TableCell className="tabular-nums text-right">{formatZahl(summe("jahr"))}</TableCell>
                <TableCell className="tabular-nums text-right">
                  {summe("differenz") > 0 ? "+" : ""}{formatZahl(summe("differenz"))}
                </TableCell>
                <TableCell />
                <TableCell className="tabular-nums text-right">
                  {formatCentJeEi(summe("vorjahr_eier_umsatz"), summe("vorjahr"))}
                </TableCell>
                <TableCell className="tabular-nums text-right">
                  {formatCentJeEi(summe("jahr_eier_umsatz"), summe("jahr"))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
