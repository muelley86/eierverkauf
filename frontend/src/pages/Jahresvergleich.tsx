import { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  exportExcelUrl,
  exportPdfUrl,
  getJahresvergleich,
  JahresvergleichZeile,
} from "@/api/client";
import { formatEuro, formatZahl, monatsKurz } from "@/lib/formatierung";

const FARBE_EIER = "#2563eb";
const FARBE_VORJAHR = "#94a3b8";

export default function Jahresvergleich() {
  const aktuellesJahr = new Date().getFullYear();
  const [jahr, setJahr] = useState<number>(aktuellesJahr);
  const [daten, setDaten] = useState<JahresvergleichZeile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    setLoading(true);
    getJahresvergleich(jahr)
      .then((d) => {
        if (!abgebrochen) setDaten(d);
      })
      .catch((e) => toast.error("Jahresvergleich-Fehler", { description: String(e) }))
      .finally(() => {
        if (!abgebrochen) setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [jahr]);

  const jahrOptionen = Array.from({ length: 6 }, (_, i) => aktuellesJahr - i);
  const summe = (key: keyof JahresvergleichZeile) =>
    daten.reduce((acc, d) => acc + Number(d[key] ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">
            Jahresvergleich {jahr} vs. {jahr - 1}
          </h2>
          <Select
            value={String(jahr)}
            onChange={(e) => setJahr(Number(e.target.value))}
            className="w-32"
          >
            {jahrOptionen.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={exportExcelUrl({ typ: "jahresvergleich", jahr })} target="_blank" rel="noreferrer">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={exportPdfUrl({ typ: "jahresvergleich", jahr })} target="_blank" rel="noreferrer">
              <FileText className="h-4 w-4" /> PDF
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eier — Monatsvergleich</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[350px]" />
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart
                data={daten.map((d) => ({ ...d, monatLabel: monatsKurz(d.monat) }))}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monatLabel" />
                <YAxis tickFormatter={(v: number) => formatZahl(v)} />
                <Tooltip formatter={(v: number) => formatZahl(v)} />
                <Bar dataKey="jahr" name={String(jahr)} fill={FARBE_EIER} />
                <Line
                  type="monotone"
                  dataKey="vorjahr"
                  name={String(jahr - 1)}
                  stroke={FARBE_VORJAHR}
                  strokeWidth={2}
                  dot
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Differenz-Tabelle</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Monat</TableHead>
                <TableHead>Eier {jahr}</TableHead>
                <TableHead>Eier {jahr - 1}</TableHead>
                <TableHead>Δ Stück</TableHead>
                <TableHead>Δ %</TableHead>
                <TableHead>Umsatz {jahr}</TableHead>
                <TableHead>Δ €</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daten.map((d) => {
                const prozent = d.vorjahr > 0 ? (d.differenz / d.vorjahr) * 100 : 0;
                return (
                  <TableRow key={d.monat}>
                    <TableCell>{monatsKurz(d.monat)}</TableCell>
                    <TableCell className="tabular-nums">{formatZahl(d.jahr)}</TableCell>
                    <TableCell className="tabular-nums">{formatZahl(d.vorjahr)}</TableCell>
                    <TableCell
                      className={`tabular-nums font-medium ${
                        d.differenz > 0 ? "text-emerald-600" : d.differenz < 0 ? "text-red-600" : ""
                      }`}
                    >
                      {d.differenz > 0 ? "+" : ""}
                      {formatZahl(d.differenz)}
                    </TableCell>
                    <TableCell
                      className={`tabular-nums ${
                        prozent > 0 ? "text-emerald-600" : prozent < 0 ? "text-red-600" : ""
                      }`}
                    >
                      {d.vorjahr > 0 ? `${prozent > 0 ? "+" : ""}${formatZahl(prozent, 1)} %` : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatEuro(d.jahr_umsatz)}</TableCell>
                    <TableCell
                      className={`tabular-nums font-medium ${
                        d.differenz_umsatz > 0
                          ? "text-emerald-600"
                          : d.differenz_umsatz < 0
                            ? "text-red-600"
                            : ""
                      }`}
                    >
                      {d.differenz_umsatz > 0 ? "+" : ""}
                      {formatEuro(d.differenz_umsatz)}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-semibold border-t-2">
                <TableCell>Summe</TableCell>
                <TableCell className="tabular-nums">{formatZahl(summe("jahr"))}</TableCell>
                <TableCell className="tabular-nums">{formatZahl(summe("vorjahr"))}</TableCell>
                <TableCell className="tabular-nums">{formatZahl(summe("differenz"))}</TableCell>
                <TableCell />
                <TableCell className="tabular-nums">{formatEuro(summe("jahr_umsatz"))}</TableCell>
                <TableCell className="tabular-nums">{formatEuro(summe("differenz_umsatz"))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
