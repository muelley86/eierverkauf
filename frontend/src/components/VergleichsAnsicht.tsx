/**
 * Gemeinsame Bausteine für „Jahresvergleich" und „Zeitraumvergleich":
 * Balkendiagramm (Vorjahr grau, aktuell grün), Legende, Export-Knöpfe und
 * Tabelle mit Δ Stück, Δ %, Umsatz/Ei und Summenzeile.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TABELLE_STICKY_ERSTE_SPALTE } from "@/lib/tabelle";
import { formatCentJeEi, formatZahl } from "@/lib/formatierung";
import { useChartFarben } from "@/lib/chart-farben";
import { useIstMobil } from "@/hooks/useIstMobil";
import { prozentAenderung, summiereVergleich, VergleichsZeile } from "@/lib/vergleich";

const HOEHE_MOBIL = 260;
const HOEHE_DESKTOP = 360;
const MAX_BALKENBREITE = 56;

interface Beschriftung {
  /** Legende/Spaltenkopf der aktuellen Reihe, z. B. „2026" oder „Zeitraum". */
  labelAktuell: string;
  /** Legende/Spaltenkopf der Vorjahresreihe, z. B. „2025" oder „Vorjahr". */
  labelVorjahr: string;
}

export function VergleichsLegende({ labelAktuell, labelVorjahr }: Beschriftung) {
  const { farben } = useChartFarben();
  return (
    <div className="hidden items-center gap-3 text-xs tabular-nums text-muted-foreground sm:flex">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-brand" /> {labelAktuell}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: farben.vorjahr }} /> {labelVorjahr}
      </span>
    </div>
  );
}

export function ExportKnoepfe({ excelHref, pdfHref }: { excelHref: string; pdfHref: string }) {
  return (
    <>
      <Button asChild variant="outline" size="sm" className="h-8 border-rule">
        <a href={excelHref} target="_blank" rel="noreferrer" aria-label="Excel-Export">
          <FileSpreadsheet className="h-4 w-4" />
        </a>
      </Button>
      <Button asChild variant="outline" size="sm" className="h-8 border-rule">
        <a href={pdfHref} target="_blank" rel="noreferrer" aria-label="PDF-Export">
          <FileText className="h-4 w-4" />
        </a>
      </Button>
    </>
  );
}

export function VergleichsDiagramm({
  zeilen,
  labelAktuell,
  labelVorjahr,
}: Beschriftung & { zeilen: VergleichsZeile[] }) {
  const { farben, tooltip, achse, raster } = useChartFarben();
  const istMobil = useIstMobil();
  return (
    <ResponsiveContainer width="100%" height={istMobil ? HOEHE_MOBIL : HOEHE_DESKTOP}>
      <BarChart
        data={zeilen}
        margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
        barCategoryGap={istMobil ? "14%" : "28%"}
        barGap={istMobil ? 1 : 4}
      >
        <CartesianGrid {...raster} vertical={false} />
        <XAxis
          dataKey="label"
          tick={achse}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis tickFormatter={(v: number) => formatZahl(v)} tick={achse} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v: number) => formatZahl(v)}
          contentStyle={tooltip}
          cursor={{ fill: farben.raster, opacity: 0.5 }}
        />
        <Bar isAnimationActive={false} maxBarSize={MAX_BALKENBREITE} dataKey="vorjahr" name={labelVorjahr}
          fill={farben.vorjahr} radius={[3, 3, 0, 0]} />
        <Bar isAnimationActive={false} maxBarSize={MAX_BALKENBREITE} dataKey="aktuell" name={labelAktuell}
          fill={farben.eierFlaeche} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const KOPF = "text-xs text-muted-foreground";
const ZAHL = "whitespace-nowrap tabular-nums text-right";

function deltaKlasse(differenz: number): string {
  if (differenz > 0) return "text-positive";
  if (differenz < 0) return "text-negative";
  return "text-muted-foreground";
}

function vorzeichen(wert: number): string {
  return wert > 0 ? "+" : "";
}

function formatProzent(aktuell: number, vorjahr: number): string {
  const prozent = prozentAenderung(aktuell, vorjahr);
  return prozent === null ? "—" : `${vorzeichen(prozent)}${formatZahl(prozent, 1)} %`;
}

export function VergleichsTabelle({
  zeilen,
  ersteSpalte,
  labelAktuell,
  labelVorjahr,
}: Beschriftung & { zeilen: VergleichsZeile[]; ersteSpalte: string }) {
  const summe = summiereVergleich(zeilen);
  const summeDifferenz = summe.aktuell - summe.vorjahr;
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      <Table className={TABELLE_STICKY_ERSTE_SPALTE}>
        <TableHeader>
          <TableRow className="border-rule hover:bg-transparent">
            <TableHead className={KOPF}>{ersteSpalte}</TableHead>
            <TableHead className={`${KOPF} text-right`}>{labelVorjahr}</TableHead>
            <TableHead className={`${KOPF} text-right`}>{labelAktuell}</TableHead>
            <TableHead className={`${KOPF} text-right`}>Δ Stück</TableHead>
            <TableHead className={`${KOPF} text-right`}>Δ %</TableHead>
            <TableHead className={`${KOPF} text-right`}>Umsatz/Ei {labelVorjahr}</TableHead>
            <TableHead className={`${KOPF} text-right`}>Umsatz/Ei {labelAktuell}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {zeilen.map((z) => {
            const differenz = z.aktuell - z.vorjahr;
            return (
              <TableRow key={z.schluessel} className="border-rule hover:bg-brand/[0.04]">
                <TableCell className="whitespace-nowrap font-medium text-ink">{z.label}</TableCell>
                <TableCell className={ZAHL}>{formatZahl(z.vorjahr)}</TableCell>
                <TableCell className={ZAHL}>{formatZahl(z.aktuell)}</TableCell>
                <TableCell className={`${ZAHL} ${deltaKlasse(differenz)}`}>
                  {vorzeichen(differenz)}{formatZahl(differenz)}
                </TableCell>
                <TableCell className={`${ZAHL} ${deltaKlasse(differenz)}`}>
                  {formatProzent(z.aktuell, z.vorjahr)}
                </TableCell>
                <TableCell className={ZAHL}>{formatCentJeEi(z.vorjahrEierUmsatz, z.vorjahr)}</TableCell>
                <TableCell className={ZAHL}>{formatCentJeEi(z.aktuellEierUmsatz, z.aktuell)}</TableCell>
              </TableRow>
            );
          })}
          <TableRow className="border-t-2 border-rule bg-background/40 font-semibold hover:bg-background/40">
            <TableCell className="text-ink">Summe</TableCell>
            <TableCell className={ZAHL}>{formatZahl(summe.vorjahr)}</TableCell>
            <TableCell className={ZAHL}>{formatZahl(summe.aktuell)}</TableCell>
            <TableCell className={`${ZAHL} ${deltaKlasse(summeDifferenz)}`}>
              {vorzeichen(summeDifferenz)}{formatZahl(summeDifferenz)}
            </TableCell>
            <TableCell className={`${ZAHL} ${deltaKlasse(summeDifferenz)}`}>
              {formatProzent(summe.aktuell, summe.vorjahr)}
            </TableCell>
            <TableCell className={ZAHL}>{formatCentJeEi(summe.vorjahrEierUmsatz, summe.vorjahr)}</TableCell>
            <TableCell className={ZAHL}>{formatCentJeEi(summe.aktuellEierUmsatz, summe.aktuell)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
