import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { KPICard } from "@/components/KPICard";
import { PageHeader, Panel } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Hen } from "@/components/illustrations/Hen";
import { useZeitraum } from "@/context/ZeitraumContext";
import { useKundenFilter } from "@/context/KundenFilterContext";
import {
  DashboardResponse,
  ZeitraumVerlauf,
  ImportProtokollEintrag,
  exportExcelUrl,
  getDashboard,
  getVerlauf,
  getImportHistorie,
} from "@/api/client";
import { artikelLabel } from "@/lib/artikel";
import {
  formatBruttoRetouren,
  formatDatum,
  formatEuro,
  formatVerlaufLabel,
  formatZahl,
} from "@/lib/formatierung";
import { useChartFarben } from "@/lib/chart-farben";
import { cn } from "@/lib/utils";

const ANZAHL_LETZTE_IMPORTS = 4;
const MIN_BALKEN_PROZENT = 2;

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function delta(aktuell: number, vorjahr: number | undefined | null) {
  if (vorjahr === undefined || vorjahr === null || vorjahr === 0) return undefined;
  const pct = ((aktuell - vorjahr) / vorjahr) * 100;
  return {
    wert: `${pct >= 0 ? "+" : ""}${formatZahl(pct, 1)} %`,
    richtung: (pct >= 0 ? "up" : "down") as "up" | "down",
  };
}

const LINK_KLASSEN = "text-sm text-muted-foreground underline-offset-4 transition hover:text-ink hover:underline";

// ---------------------------------------------------------------------------
// Teilkomponenten
// ---------------------------------------------------------------------------

function KpiBand({ daten, verlauf }: { daten: DashboardResponse; verlauf: ZeitraumVerlauf | null }) {
  const vj = daten.vorjahres_kpis;
  const sparkEier = verlauf?.punkte.map((p) => p.eier) ?? [];
  const sparkUmsatz = verlauf?.punkte.map((p) => p.umsatz) ?? [];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <KPICard
        variant="hero"
        titel="Verkaufte Eier (Stück)"
        wert={formatZahl(daten.kpis.gesamt_eier)}
        sparkline={sparkEier}
        delta={delta(daten.kpis.gesamt_eier, vj?.gesamt_eier)}
        hinweis={
          formatBruttoRetouren(daten.kpis.brutto_eier, daten.kpis.retouren_eier, formatZahl) ?? undefined
        }
        className="lg:col-span-7"
      />
      <div className="grid grid-cols-2 gap-4 lg:col-span-5 lg:grid-rows-[1fr_auto]">
        <KPICard
          titel="Umsatz"
          wert={formatEuro(daten.kpis.umsatz)}
          sparkline={sparkUmsatz}
          sparklineReihe="umsatz"
          delta={delta(daten.kpis.umsatz, vj?.umsatz)}
          hinweis={
            formatBruttoRetouren(daten.kpis.brutto_umsatz, daten.kpis.retouren_umsatz, formatEuro) ??
            undefined
          }
          className="col-span-2"
        />
        <KPICard
          titel="Kunden"
          wert={formatZahl(daten.kpis.anzahl_kunden)}
          delta={delta(daten.kpis.anzahl_kunden, vj?.anzahl_kunden)}
        />
        <KPICard
          titel="Positionen"
          wert={formatZahl(daten.kpis.anzahl_positionen)}
          delta={delta(daten.kpis.anzahl_positionen, vj?.anzahl_positionen)}
        />
      </div>
    </div>
  );
}

function Legende({ hatVorjahr }: { hatVorjahr: boolean }) {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Zeitraum
      </span>
      {hatVorjahr && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t-2 border-dashed border-muted-foreground/60" />
          Vorjahr
        </span>
      )}
    </div>
  );
}

function VerlaufChart({ verlauf }: { verlauf: ZeitraumVerlauf }) {
  const { farben, tooltip, achse, raster } = useChartFarben();
  const daten = verlauf.punkte.map((p) => ({
    label: formatVerlaufLabel(p.start, verlauf.granularitaet),
    aktuell: p.eier,
    vorjahr: p.vorjahr_eier,
  }));
  return (
    <div className="h-[240px] sm:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={daten} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="verlaufFlaeche" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={farben.eierFlaeche} stopOpacity={0.55} />
              <stop offset="100%" stopColor={farben.eierFlaeche} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid {...raster} vertical={false} />
          <XAxis
            dataKey="label"
            tick={achse}
            axisLine={false}
            tickLine={false}
            // Ausdünnen vom Ende her in gleichmäßigem Takt: „preserveStartEnd"
            // erzwang das letzte Label zusätzlich zum Takt ab Start — dadurch
            // fehlten Apr/Mai vor „Jun 26" (Lücke von drei Monaten).
            interval="preserveEnd"
            // Kleiner Abstand, damit 12 Monatslabels auf Desktop vollständig passen.
            minTickGap={8}
            // Flächen-Punkte liegen sonst exakt am Rand; Recharts rückt die
            // Randbeschriftung dann nach innen und verdrängt die Nachbarn.
            padding={{ left: 18, right: 18 }}
          />
          <YAxis
            tickFormatter={(v: number) => formatZahl(v)}
            tick={achse}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            formatter={(v: number) => formatZahl(v)}
            contentStyle={tooltip}
            labelStyle={{ color: farben.text, fontWeight: 600 }}
          />
          <Line
            type="monotone"
            dataKey="vorjahr"
            name="Vorjahr"
            stroke={farben.vorjahr}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="aktuell"
            name="Zeitraum"
            stroke={farben.eier}
            strokeWidth={2.5}
            fill="url(#verlaufFlaeche)"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

interface RanglistenEintrag {
  schluessel: string;
  label: string;
  wert: number;
  wertText: string;
  ziel: string;
}

/** Kurze Rangliste mit Balken — Top-5 Kunden bzw. Artikel. */
function Rangliste({ eintraege, balkenKlasse }: { eintraege: RanglistenEintrag[]; balkenKlasse: string }) {
  const navigate = useNavigate();
  const maximum = Math.max(1, ...eintraege.map((e) => e.wert));
  return (
    <ol className="space-y-4">
      {eintraege.map((e, i) => (
        <li key={e.schluessel}>
          <button
            type="button"
            onClick={() => navigate(e.ziel)}
            className="group block w-full space-y-1.5 text-left"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-2.5">
                <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="truncate text-sm text-ink group-hover:underline">{e.label}</span>
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{e.wertText}</span>
            </span>
            <span className="ml-6 block h-2 overflow-hidden rounded-full bg-muted">
              <span
                className={cn("block h-full rounded-full", balkenKlasse)}
                style={{ width: `${Math.max(MIN_BALKEN_PROZENT, (e.wert / maximum) * 100)}%` }}
              />
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function LetzteImports({ imports }: { imports: ImportProtokollEintrag[] }) {
  if (imports.length === 0) {
    return (
      <EmptyState
        illustration={<Hen />}
        title="Noch keine Imports"
        description="Laden Sie eine CSV im Bereich Import hoch, um Auswertungen zu sehen."
        action={
          <Link
            to="/import"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition hover:bg-brand/90 active:scale-95"
          >
            CSV importieren
          </Link>
        }
      />
    );
  }
  return (
    <ul className="space-y-4">
      {imports.map((imp) => (
        <li key={imp.id}>
          <Link to={`/import/${imp.id}`} className="group block min-w-0">
            <div className="text-sm text-ink group-hover:underline">
              {formatZahl(imp.zeilen_importiert)} Zeilen importiert
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {formatDatum(imp.import_datum.slice(0, 10))}, {imp.dateiname}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Seite
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { von, bis } = useZeitraum();
  const { kunden } = useKundenFilter();
  const [daten, setDaten] = useState<DashboardResponse | null>(null);
  const [verlauf, setVerlauf] = useState<ZeitraumVerlauf | null>(null);
  const [imports, setImports] = useState<ImportProtokollEintrag[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    setLoading(true);
    Promise.all([getDashboard({ von, bis, kunden }), getVerlauf({ von, bis, kunden }), getImportHistorie()])
      .then(([d, v, i]) => {
        if (abgebrochen) return;
        setDaten(d);
        setVerlauf(v);
        setImports(i.slice(0, ANZAHL_LETZTE_IMPORTS));
      })
      .catch((e) => {
        toast.error("Übersicht konnte nicht geladen werden", { description: String(e) });
      })
      .finally(() => {
        if (!abgebrochen) setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [von, bis, kunden]);

  const hatVorjahr = useMemo(
    () => verlauf?.punkte.some((p) => p.vorjahr_eier !== null) ?? false,
    [verlauf],
  );

  const topKunden: RanglistenEintrag[] = (daten?.top5_kunden ?? []).map((k) => ({
    schluessel: k.kundennummer,
    label: k.kundenname,
    wert: k.eier,
    wertText: formatZahl(k.eier),
    ziel: `/kunden/${encodeURIComponent(k.kundennummer)}`,
  }));
  const topArtikel: RanglistenEintrag[] = (daten?.top5_artikel ?? []).map((a) => ({
    schluessel: a.artikel_code,
    label: artikelLabel(a.artikel_code),
    wert: a.umsatz,
    wertText: formatEuro(a.umsatz),
    ziel: `/artikel/${encodeURIComponent(a.artikel_code)}`,
  }));
  const bereit = !loading && daten !== null;

  return (
    <div className="max-w-[1400px] space-y-4 md:space-y-6">
      <PageHeader
        eyebrow="Buchenhof Eierverkauf"
        title="Übersicht"
        withKundenFilter
        exportHref={exportExcelUrl({ typ: "ranking", sort: "menge", von, bis, kunden })}
      />

      {bereit ? (
        <KpiBand daten={daten} verlauf={verlauf} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Skeleton className="h-64 rounded-2xl lg:col-span-7" />
          <Skeleton className="h-64 rounded-2xl lg:col-span-5" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12">
        <Panel
          className="lg:col-span-8"
          title="Eierverkauf im Zeitraum"
          actions={<Legende hatVorjahr={hatVorjahr} />}
        >
          {loading || !verlauf ? (
            <Skeleton className="h-[240px] sm:h-[320px]" />
          ) : (
            <VerlaufChart verlauf={verlauf} />
          )}
        </Panel>

        <Panel
          className="lg:col-span-4"
          title="Umsatz nach Verpackung"
          actions={<Link to="/artikel" className={LINK_KLASSEN}>Alle Artikel</Link>}
        >
          {bereit ? <Rangliste eintraege={topArtikel} balkenKlasse="bg-ink/70" /> : <Skeleton className="h-[260px]" />}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12">
        <Panel
          className="lg:col-span-8"
          title="Top-Kunden nach Eiern"
          actions={<Link to="/ranking" className={LINK_KLASSEN}>Ganze Rangliste</Link>}
        >
          {bereit ? <Rangliste eintraege={topKunden} balkenKlasse="bg-brand" /> : <Skeleton className="h-[260px]" />}
        </Panel>

        <Panel className="lg:col-span-4" title="Letzte Imports">
          {loading || !imports ? <Skeleton className="h-[200px]" /> : <LetzteImports imports={imports} />}
        </Panel>
      </div>
    </div>
  );
}
