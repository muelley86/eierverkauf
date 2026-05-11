import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartToggle } from "@/components/ChartToggle";
import {
  exportExcelUrl,
  exportPdfUrl,
  getArtikelMonate,
  MonatsZeile,
} from "@/api/client";
import { useZeitraum } from "@/context/ZeitraumContext";
import { formatEuro, formatMonat, formatZahl } from "@/lib/formatierung";

const FARBE_EIER = "#2563eb";

export default function ArtikelDetail() {
  const { code } = useParams<{ code: string }>();
  const artikel = code ?? "";
  const { von, bis } = useZeitraum();
  const [monate, setMonate] = useState<MonatsZeile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    setLoading(true);
    getArtikelMonate(artikel, { von, bis })
      .then((d) => {
        if (!abgebrochen) setMonate(d);
      })
      .catch((e) => toast.error("Daten konnten nicht geladen werden", { description: String(e) }))
      .finally(() => {
        if (!abgebrochen) setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [artikel, von, bis]);

  const chartDaten = useMemo(
    () => monate.map((m) => ({ ...m, monatLabel: formatMonat(m.monat) })),
    [monate],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/artikel">
              <ArrowLeft className="h-4 w-4" /> Zurück
            </Link>
          </Button>
          <h2 className="text-xl font-semibold">{artikel}</h2>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href={exportExcelUrl({ typ: "artikel_monate", von, bis, code: artikel })}
              target="_blank"
              rel="noreferrer"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={exportPdfUrl({ typ: "artikel_monate", von, bis, code: artikel })}
              target="_blank"
              rel="noreferrer"
            >
              <FileText className="h-4 w-4" /> PDF
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monatsverlauf</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[350px]" />
          ) : (
            <ChartToggle
              render={(modus) => (
                <ResponsiveContainer width="100%" height={350}>
                  {modus === "bar" ? (
                    <BarChart data={chartDaten} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="monatLabel" />
                      <YAxis tickFormatter={(v: number) => formatZahl(v)} />
                      <Tooltip formatter={(v: number) => formatZahl(v)} />
                      <Bar dataKey="eier" fill={FARBE_EIER} />
                      <Brush dataKey="monatLabel" height={20} stroke={FARBE_EIER} />
                    </BarChart>
                  ) : (
                    <LineChart data={chartDaten} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="monatLabel" />
                      <YAxis tickFormatter={(v: number) => formatZahl(v)} />
                      <Tooltip formatter={(v: number) => formatZahl(v)} />
                      <Line type="monotone" dataKey="eier" stroke={FARBE_EIER} strokeWidth={2} />
                      <Brush dataKey="monatLabel" height={20} stroke={FARBE_EIER} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabelle</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Monat</TableHead>
                <TableHead>Menge</TableHead>
                <TableHead>Eier</TableHead>
                <TableHead>Umsatz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monate.map((m) => (
                <TableRow key={m.monat}>
                  <TableCell>{formatMonat(m.monat)}</TableCell>
                  <TableCell className="tabular-nums">{formatZahl(m.menge ?? 0, 2)}</TableCell>
                  <TableCell className="tabular-nums">{formatZahl(m.eier)}</TableCell>
                  <TableCell className="tabular-nums">{formatEuro(m.umsatz)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
