import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
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
  getKundeJahresvergleich,
  getKundeMonate,
  getKundeStamm,
  JahresvergleichZeile,
  KundeStamm,
  MonatsZeile,
} from "@/api/client";
import { useZeitraum } from "@/context/ZeitraumContext";
import { formatEuro, formatMonat, formatZahl, monatsKurz } from "@/lib/formatierung";

const FARBE_EIER = "#2563eb";
const FARBE_UMSATZ = "#16a34a";
const FARBE_VORJAHR = "#94a3b8";

export default function KundenDetail() {
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
    let abgebrochen = false;
    setLoadingTop(true);
    Promise.all([getKundeStamm(nr), getKundeMonate(nr, { von, bis })])
      .then(([s, m]) => {
        if (!abgebrochen) {
          setStamm(s);
          setMonate(m);
        }
      })
      .catch((e) => toast.error("Daten konnten nicht geladen werden", { description: String(e) }))
      .finally(() => {
        if (!abgebrochen) setLoadingTop(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [nr, von, bis]);

  useEffect(() => {
    let abgebrochen = false;
    setLoadingVerg(true);
    getKundeJahresvergleich(nr, jahr)
      .then((d) => {
        if (!abgebrochen) setVergleich(d);
      })
      .catch((e) => toast.error("Jahresvergleich-Fehler", { description: String(e) }))
      .finally(() => {
        if (!abgebrochen) setLoadingVerg(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [nr, jahr]);

  const monateChart = useMemo(
    () => monate.map((m) => ({ ...m, monatLabel: formatMonat(m.monat) })),
    [monate],
  );

  const aktuellesJahr = new Date().getFullYear();
  const jahrOptionen = Array.from({ length: 6 }, (_, i) => aktuellesJahr - i);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/kunden">
              <ArrowLeft className="h-4 w-4" /> Zurück
            </Link>
          </Button>
          <h2 className="text-xl font-semibold">{stamm?.kundenname ?? nr}</h2>
          <span className="text-sm text-muted-foreground">#{nr}</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href={exportExcelUrl({ typ: "kunde_monate", von, bis, kunde_nr: nr })}
              target="_blank"
              rel="noreferrer"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={exportPdfUrl({ typ: "kunde_monate", von, bis, kunde_nr: nr })}
              target="_blank"
              rel="noreferrer"
            >
              <FileText className="h-4 w-4" /> PDF
            </a>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="monatsverlauf">
        <TabsList>
          <TabsTrigger value="monatsverlauf">Monatsverlauf</TabsTrigger>
          <TabsTrigger value="jahresvergleich">Jahresvergleich</TabsTrigger>
        </TabsList>

        <TabsContent value="monatsverlauf" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Eier pro Monat</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTop ? (
                <Skeleton className="h-[350px]" />
              ) : (
                <ChartToggle
                  render={(modus) => (
                    <ResponsiveContainer width="100%" height={350}>
                      {modus === "bar" ? (
                        <BarChart data={monateChart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="monatLabel" />
                          <YAxis tickFormatter={(v: number) => formatZahl(v)} />
                          <Tooltip formatter={(v: number) => formatZahl(v)} />
                          <Bar dataKey="eier" fill={FARBE_EIER} />
                          <Brush dataKey="monatLabel" height={20} stroke={FARBE_EIER} />
                        </BarChart>
                      ) : (
                        <LineChart data={monateChart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
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
                    <TableHead>Eier</TableHead>
                    <TableHead>Umsatz</TableHead>
                    <TableHead>Positionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monate.map((m) => (
                    <TableRow key={m.monat}>
                      <TableCell>{formatMonat(m.monat)}</TableCell>
                      <TableCell className="tabular-nums">{formatZahl(m.eier)}</TableCell>
                      <TableCell className="tabular-nums">{formatEuro(m.umsatz)}</TableCell>
                      <TableCell className="tabular-nums">{formatZahl(m.positionen ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jahresvergleich" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Jahresvergleich {jahr} vs. {jahr - 1}</CardTitle>
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
            </CardHeader>
            <CardContent>
              {loadingVerg ? (
                <Skeleton className="h-[350px]" />
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart
                    data={vergleich.map((v) => ({ ...v, monatLabel: monatsKurz(v.monat) }))}
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
                    <TableHead>Δ</TableHead>
                    <TableHead>Umsatz {jahr}</TableHead>
                    <TableHead>Δ €</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vergleich.map((v) => (
                    <TableRow key={v.monat}>
                      <TableCell>{monatsKurz(v.monat)}</TableCell>
                      <TableCell className="tabular-nums">{formatZahl(v.jahr)}</TableCell>
                      <TableCell className="tabular-nums">{formatZahl(v.vorjahr)}</TableCell>
                      <TableCell
                        className={`tabular-nums font-medium ${
                          v.differenz > 0
                            ? "text-emerald-600"
                            : v.differenz < 0
                              ? "text-red-600"
                              : ""
                        }`}
                      >
                        {v.differenz > 0 ? "+" : ""}
                        {formatZahl(v.differenz)}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatEuro(v.jahr_umsatz)}</TableCell>
                      <TableCell
                        className={`tabular-nums font-medium ${
                          v.differenz_umsatz > 0
                            ? "text-emerald-600"
                            : v.differenz_umsatz < 0
                              ? "text-red-600"
                              : ""
                        }`}
                      >
                        {v.differenz_umsatz > 0 ? "+" : ""}
                        {formatEuro(v.differenz_umsatz)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
