import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Bar, BarChart, Brush, CartesianGrid, ComposedChart, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TABELLE_STICKY_ERSTE_SPALTE } from "@/lib/tabelle";
import { ChartToggle } from "@/components/ChartToggle";
import { PageHeader, Panel } from "@/components/PageHeader";
import {
  exportExcelUrl, exportPdfUrl, getKundeJahresvergleich,
  getKundeMonate, getKundeStamm, JahresvergleichZeile, KundeStamm, MonatsZeile,
} from "@/api/client";
import { useZeitraum } from "@/context/ZeitraumContext";
import { formatCentJeEi, formatEuro, formatMonat, formatZahl, monatsKurz } from "@/lib/formatierung";
import { useChartFarben } from "@/lib/chart-farben";

export default function KundenDetail() {
  const { farben, tooltip, achse, raster } = useChartFarben();
  const params = useParams<{ nr: string }>();
  const nr = params.nr ?? "";
  const { von, bis } = useZeitraum();
  const [stamm, setStamm] = useState<KundeStamm | null>(null);
  const [monate, setMonate] = useState<MonatsZeile[]>([]);
  const [vergleich, setVergleich] = useState<JahresvergleichZeile[]>([]);
  const [jahr, setJahr] = useState<number>(new Date().getFullYear());
  const [loadingTop, setLoadingTop] = useState(true);
  const [loadingVerg, setLoadingVerg] = useState(true);

  useEffect(() => {
    let ab = false;
    setLoadingTop(true);
    Promise.all([getKundeStamm(nr), getKundeMonate(nr, { von, bis })])
      .then(([s, m]) => { if (!ab) { setStamm(s); setMonate(m); } })
      .catch((e) => toast.error("Daten konnten nicht geladen werden", { description: String(e) }))
      .finally(() => { if (!ab) setLoadingTop(false); });
    return () => { ab = true; };
  }, [nr, von, bis]);

  useEffect(() => {
    let ab = false;
    setLoadingVerg(true);
    getKundeJahresvergleich(nr, jahr)
      .then((d) => { if (!ab) setVergleich(d); })
      .catch((e) => toast.error("Jahresvergleich-Fehler", { description: String(e) }))
      .finally(() => { if (!ab) setLoadingVerg(false); });
    return () => { ab = true; };
  }, [nr, jahr]);

  const monateChart = useMemo(
    () => monate.map((m) => ({ ...m, monatLabel: formatMonat(m.monat) })),
    [monate],
  );

  const aktuellesJahr = new Date().getFullYear();
  const jahrOptionen = Array.from({ length: 6 }, (_, i) => aktuellesJahr - i);

  return (
    <div className="space-y-8 max-w-[1400px]">
      <PageHeader
        back={{ to: "/kunden", label: "Zur Kundenliste" }}
        eyebrow={`Kunde · ${nr}`}
        title={stamm?.kundenname ?? nr}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="border-rule">
              <a href={exportExcelUrl({ typ: "kunde_monate", von, bis, kunde_nr: nr })} target="_blank" rel="noreferrer">
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-rule">
              <a href={exportPdfUrl({ typ: "kunde_monate", von, bis, kunde_nr: nr })} target="_blank" rel="noreferrer">
                <FileText className="h-4 w-4" /> PDF
              </a>
            </Button>
          </>
        }
      />

      <Tabs defaultValue="monatsverlauf">
        <TabsList className="bg-surface border border-rule">
          <TabsTrigger value="monatsverlauf">Monatsverlauf</TabsTrigger>
          <TabsTrigger value="jahresvergleich">Jahresvergleich</TabsTrigger>
        </TabsList>

        <TabsContent value="monatsverlauf" className="space-y-6 mt-6">
          <Panel title="Eier pro Monat">
            {loadingTop ? <Skeleton className="h-[350px]" /> : (
              <ChartToggle render={(modus) => (
                <ResponsiveContainer width="100%" height={350}>
                  {modus === "bar" ? (
                    <BarChart data={monateChart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid {...raster} vertical={false} />
                      <XAxis dataKey="monatLabel" stroke={farben.text} tick={achse} />
                      <YAxis tickFormatter={(v: number) => formatZahl(v)} stroke={farben.text} tick={achse} />
                      <Tooltip formatter={(v: number) => formatZahl(v)} contentStyle={tooltip} />
                      <Bar isAnimationActive={false} maxBarSize={56} dataKey="eier" fill={farben.eierFlaeche} radius={[4, 4, 0, 0]} />
                      <Brush dataKey="monatLabel" height={20} stroke={farben.eier} fill={farben.flaeche} />
                    </BarChart>
                  ) : (
                    <LineChart data={monateChart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid {...raster} vertical={false} />
                      <XAxis dataKey="monatLabel" stroke={farben.text} tick={achse} />
                      <YAxis tickFormatter={(v: number) => formatZahl(v)} stroke={farben.text} tick={achse} />
                      <Tooltip formatter={(v: number) => formatZahl(v)} contentStyle={tooltip} />
                      <Line isAnimationActive={false} type="monotone" dataKey="eier" stroke={farben.eier} strokeWidth={2} dot={{ fill: farben.eier, r: 3 }} />
                      <Brush dataKey="monatLabel" height={20} stroke={farben.eier} fill={farben.flaeche} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )} />
            )}
          </Panel>

          <Panel title="Detailwerte">
            <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto">
              <Table className={TABELLE_STICKY_ERSTE_SPALTE}>
                <TableHeader>
                  <TableRow className="border-rule">
                    <TableHead className="tabular-nums text-xs">Monat</TableHead>
                    <TableHead className="tabular-nums text-xs">Eier</TableHead>
                    <TableHead className="tabular-nums text-xs">Umsatz</TableHead>
                    <TableHead className="tabular-nums text-xs">Umsatz/Ei</TableHead>
                    <TableHead className="tabular-nums text-xs">Positionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monate.map((m) => (
                    <TableRow key={m.monat} className="border-rule">
                      <TableCell>{formatMonat(m.monat)}</TableCell>
                      <TableCell className="tabular-nums">{formatZahl(m.eier)}</TableCell>
                      <TableCell className="tabular-nums">{formatEuro(m.umsatz)}</TableCell>
                      <TableCell className="tabular-nums">{formatCentJeEi(m.eier_umsatz, m.eier)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{formatZahl(m.positionen ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="jahresvergleich" className="space-y-6 mt-6">
          <Panel
            title={`${jahr} vs. ${jahr - 1}`}
            actions={
              <Select value={String(jahr)} onChange={(e) => setJahr(Number(e.target.value))} className="w-32 border-rule">
                {jahrOptionen.map((j) => <option key={j} value={j}>{j}</option>)}
              </Select>
            }
          >
            {loadingVerg ? <Skeleton className="h-[350px]" /> : (
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart
                  data={vergleich.map((v) => ({ ...v, monatLabel: monatsKurz(v.monat) }))}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid {...raster} vertical={false} />
                  <XAxis dataKey="monatLabel" stroke={farben.text} tick={achse} />
                  <YAxis tickFormatter={(v: number) => formatZahl(v)} stroke={farben.text} tick={achse} />
                  <Tooltip formatter={(v: number) => formatZahl(v)} contentStyle={tooltip} />
                  <Bar isAnimationActive={false} maxBarSize={56} dataKey="jahr" name={String(jahr)} fill={farben.eierFlaeche} radius={[4, 4, 0, 0]} />
                  <Line isAnimationActive={false} type="monotone" dataKey="vorjahr" name={String(jahr - 1)} stroke={farben.vorjahr} strokeWidth={2} dot={{ fill: farben.vorjahr, r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Differenz">
            <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto">
              <Table className={TABELLE_STICKY_ERSTE_SPALTE}>
                <TableHeader>
                  <TableRow className="border-rule">
                    <TableHead className="tabular-nums text-xs">Monat</TableHead>
                    <TableHead className="tabular-nums text-xs">Eier {jahr}</TableHead>
                    <TableHead className="tabular-nums text-xs">Eier {jahr - 1}</TableHead>
                    <TableHead className="tabular-nums text-xs">Δ</TableHead>
                    <TableHead className="tabular-nums text-xs">Umsatz {jahr}</TableHead>
                    <TableHead className="tabular-nums text-xs">Δ €</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vergleich.map((v) => (
                    <TableRow key={v.monat} className="border-rule">
                      <TableCell>{monatsKurz(v.monat)}</TableCell>
                      <TableCell className="tabular-nums">{formatZahl(v.jahr)}</TableCell>
                      <TableCell className="tabular-nums">{formatZahl(v.vorjahr)}</TableCell>
                      <TableCell className={`tabular-nums tabular-nums font-medium ${v.differenz > 0 ? "text-positive" : v.differenz < 0 ? "text-negative" : ""}`}>
                        {v.differenz > 0 ? "+" : ""}{formatZahl(v.differenz)}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatEuro(v.jahr_umsatz)}</TableCell>
                      <TableCell className={`tabular-nums tabular-nums font-medium ${v.differenz_umsatz > 0 ? "text-positive" : v.differenz_umsatz < 0 ? "text-negative" : ""}`}>
                        {v.differenz_umsatz > 0 ? "+" : ""}{formatEuro(v.differenz_umsatz)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
