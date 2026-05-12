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
import { formatEuro, formatMonat, formatZahl } from "@/lib/formatierung";

const FARBE_EIER = "#D69826";
const chartGrid = { stroke: "#E4D9BB", strokeDasharray: "3 3" };
const axisTick = { fill: "#6F6552", fontSize: 11, fontFamily: "JetBrains Mono" };
const tooltipStyle = {
  background: "#FAF5E6", border: "1px solid #E4D9BB", borderRadius: 8,
  fontFamily: "JetBrains Mono", fontSize: 12,
};

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
        title={<span className="font-mono">{artikel}</span>}
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
                  <CartesianGrid {...chartGrid} vertical={false} />
                  <XAxis dataKey="monatLabel" stroke="#6F6552" tick={axisTick} />
                  <YAxis tickFormatter={(v: number) => formatZahl(v)} stroke="#6F6552" tick={axisTick} />
                  <Tooltip formatter={(v: number) => formatZahl(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="eier" fill={FARBE_EIER} radius={[4, 4, 0, 0]} />
                  <Brush dataKey="monatLabel" height={20} stroke={FARBE_EIER} fill="#FAF5E6" />
                </BarChart>
              ) : (
                <LineChart data={chartDaten} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid {...chartGrid} vertical={false} />
                  <XAxis dataKey="monatLabel" stroke="#6F6552" tick={axisTick} />
                  <YAxis tickFormatter={(v: number) => formatZahl(v)} stroke="#6F6552" tick={axisTick} />
                  <Tooltip formatter={(v: number) => formatZahl(v)} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="eier" stroke={FARBE_EIER} strokeWidth={2} dot={{ fill: FARBE_EIER, r: 3 }} />
                  <Brush dataKey="monatLabel" height={20} stroke={FARBE_EIER} fill="#FAF5E6" />
                </LineChart>
              )}
            </ResponsiveContainer>
          )} />
        )}
      </Panel>

      <Panel eyebrow="Tabelle" title="Detailwerte">
        <Table>
          <TableHeader>
            <TableRow className="border-rule">
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Monat</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Menge</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Eier</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Umsatz</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monate.map((m) => (
              <TableRow key={m.monat} className="border-rule">
                <TableCell>{formatMonat(m.monat)}</TableCell>
                <TableCell className="font-mono tabular-nums">{formatZahl(m.menge ?? 0, 2)}</TableCell>
                <TableCell className="font-mono tabular-nums">{formatZahl(m.eier)}</TableCell>
                <TableCell className="font-mono tabular-nums">{formatEuro(m.umsatz)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
