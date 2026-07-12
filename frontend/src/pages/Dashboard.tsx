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
import { EggCarton } from "@/components/illustrations/EggCarton";
import { Hen } from "@/components/illustrations/Hen";
import { useZeitraum } from "@/context/ZeitraumContext";
import {
  DashboardResponse,
  ImportProtokollEintrag,
  JahresvergleichZeile,
  getDashboard,
  getImportHistorie,
  getJahresvergleich,
} from "@/api/client";
import { artikelLabel } from "@/lib/artikel";
import { formatDatum, formatEuro, formatZahl, monatsKurz } from "@/lib/formatierung";
import { AXIS_TICK, CHART_FARBEN, CHART_GRID, TOOLTIP_STYLE } from "@/lib/chart-farben";

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function delta(aktuell: number, vorjahr: number | undefined | null) {
  if (vorjahr === undefined || vorjahr === null || vorjahr === 0) return null;
  const pct = ((aktuell - vorjahr) / vorjahr) * 100;
  return {
    wert: `${pct >= 0 ? "+" : ""}${pct.toLocaleString("de-DE", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} % vs. Vorjahr`,
    richtung: (pct >= 0 ? "up" : "down") as "up" | "down",
  };
}

/** Extrahiert das Jahr aus einem ISO-Datum „YYYY-MM-DD". Fallback: aktuelles Jahr. */
function jahrAusIso(iso: string): number {
  const m = /^(\d{4})/.exec(iso);
  return m ? Number(m[1]) : new Date().getFullYear();
}

// ---------------------------------------------------------------------------
// Komponente
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { von, bis } = useZeitraum();
  const navigate = useNavigate();
  const [daten, setDaten] = useState<DashboardResponse | null>(null);
  const [verlauf, setVerlauf] = useState<JahresvergleichZeile[] | null>(null);
  const [imports, setImports] = useState<ImportProtokollEintrag[] | null>(null);
  const [loading, setLoading] = useState(true);

  const jahr = jahrAusIso(bis);

  useEffect(() => {
    let abgebrochen = false;
    setLoading(true);
    Promise.all([
      getDashboard({ von, bis }),
      getJahresvergleich(jahr),
      getImportHistorie(),
    ])
      .then(([d, v, i]) => {
        if (abgebrochen) return;
        setDaten(d);
        setVerlauf(v);
        setImports(i.slice(0, 4));
      })
      .catch((e) => {
        toast.error("Dashboard konnte nicht geladen werden", { description: String(e) });
      })
      .finally(() => {
        if (!abgebrochen) setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [von, bis, jahr]);

  // Sparkline-Daten aus dem Monatsverlauf des aktuellen Jahres.
  const sparkEier = useMemo(
    () => verlauf?.map((m) => m.jahr) ?? [],
    [verlauf],
  );
  const sparkUmsatz = useMemo(
    () => verlauf?.map((m) => m.jahr_umsatz) ?? [],
    [verlauf],
  );

  // Delta-Pills aus Vorjahresvergleich (Backend liefert).
  const vj = daten?.vorjahres_kpis;
  const deltaEier = daten ? delta(daten.kpis.gesamt_eier, vj?.gesamt_eier) : null;
  const deltaUmsatz = daten ? delta(daten.kpis.umsatz, vj?.umsatz) : null;
  const deltaKunden = daten ? delta(daten.kpis.anzahl_kunden, vj?.anzahl_kunden) : null;
  const deltaPositionen = daten ? delta(daten.kpis.anzahl_positionen, vj?.anzahl_positionen) : null;

  // Daten für Hauptchart: Monatszeile mit zwei Linien.
  const chartDaten = useMemo(
    () =>
      (verlauf ?? []).map((m) => ({
        monat: monatsKurz(m.monat),
        aktuell: m.jahr || null,
        vorjahr: m.vorjahr || null,
      })),
    [verlauf],
  );

  // Top-5-Werte mit Maximum für Balkenbreite.
  const top5Kunden = daten?.top5_kunden ?? [];
  const top5Artikel = daten?.top5_artikel ?? [];
  const maxEierKunde = Math.max(1, ...top5Kunden.map((k) => k.eier));
  const maxUmsatzArtikel = Math.max(1, ...top5Artikel.map((a) => a.umsatz));

  return (
    <div className="space-y-8 max-w-[1400px]">
      <PageHeader
        eyebrow="Dashboard"
        title="Übersicht"
        subtitle="KPIs, Topkunden und Verlauf auf einen Blick."
        exportHref={`/api/export/excel?typ=ranking&sort=menge${von ? `&von=${von}` : ""}${bis ? `&bis=${bis}` : ""}`}
      />

      {/* KPI-Bande: Hero (8/12) + rechts UMSATZ + 2× kompakt (je 4/12) */}
      {loading || !daten ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Skeleton className="h-72 lg:col-span-8" />
          <div className="lg:col-span-4 space-y-4">
            <Skeleton className="h-36" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <KPICard
            variant="hero"
            titel="Eier · Stück"
            wert={formatZahl(daten.kpis.gesamt_eier)}
            wertFarbe="yolk"
            sparkline={sparkEier}
            sparklineFarbe={CHART_FARBEN.yolk}
            delta={deltaEier ?? undefined}
            illustration={<EggCarton />}
            className="lg:col-span-8"
          />
          <div className="lg:col-span-4 space-y-4">
            <KPICard
              titel="Umsatz"
              wert={formatEuro(daten.kpis.umsatz)}
              wertFarbe="sage"
              sparkline={sparkUmsatz}
              sparklineFarbe={CHART_FARBEN.sage}
              delta={deltaUmsatz ?? undefined}
            />
            <div className="grid grid-cols-2 gap-4">
              <KPICard
                titel="Kunden"
                wert={formatZahl(daten.kpis.anzahl_kunden)}
                delta={deltaKunden ?? undefined}
              />
              <KPICard
                titel="Positionen"
                wert={formatZahl(daten.kpis.anzahl_positionen)}
                delta={deltaPositionen ?? undefined}
              />
            </div>
          </div>
        </div>
      )}

      {/* Hauptchart + Top-5-Artikel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Panel
          className="lg:col-span-8"
          eyebrow="Verlauf"
          title={
            <>
              Eierverkauf <span className="italic">im Jahresverlauf</span>
            </>
          }
          actions={
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-yolk" /> {jahr}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 border-t border-dashed border-muted-foreground" />
                {jahr - 1}
              </span>
            </div>
          }
        >
          {loading || !verlauf ? (
            <Skeleton className="h-[320px]" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={chartDaten}
                margin={{ top: 12, right: 12, left: 0, bottom: 12 }}
              >
                <defs>
                  <linearGradient id="aktuellFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_FARBEN.yolk} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART_FARBEN.yolk} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_GRID} vertical={false} />
                <XAxis
                  dataKey="monat"
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
                  labelFormatter={(l) => `Monat: ${l}`}
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: CHART_FARBEN.ink }}
                />
                <Area
                  type="monotone"
                  dataKey="aktuell"
                  stroke="none"
                  fill="url(#aktuellFill)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="vorjahr"
                  stroke={CHART_FARBEN.inkMuted}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                  name="Vorjahr"
                />
                <Line
                  type="monotone"
                  dataKey="aktuell"
                  stroke={CHART_FARBEN.yolk}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: CHART_FARBEN.yolk, stroke: CHART_FARBEN.surface, strokeWidth: 1.5 }}
                  isAnimationActive={false}
                  name={String(jahr)}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel
          className="lg:col-span-4"
          eyebrow="Verteilung"
          title={
            <>
              Umsatz <span className="italic">nach Verpackung</span>
            </>
          }
          actions={
            <Link
              to="/artikel"
              className="text-xs font-mono text-muted-foreground hover:text-ink underline decoration-rule underline-offset-4"
            >
              Alle Artikel →
            </Link>
          }
        >
          {loading || !daten ? (
            <Skeleton className="h-[280px]" />
          ) : (
            <ol className="space-y-4">
              {top5Artikel.map((a, i) => {
                const pct = Math.max(2, (a.umsatz / maxUmsatzArtikel) * 100);
                return (
                  <li
                    key={a.artikel_code}
                    onClick={() => navigate(`/artikel/${encodeURIComponent(a.artikel_code)}`)}
                    className="cursor-pointer space-y-1.5 group"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex items-baseline gap-3 min-w-0">
                        <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm text-ink group-hover:text-yolk truncate">
                          {artikelLabel(a.artikel_code)}
                        </span>
                      </span>
                      <span className="font-mono text-sm tabular-nums text-ink shrink-0">
                        {formatEuro(a.umsatz)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-rule/40 overflow-hidden">
                      <div
                        className="h-full bg-sage rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      {/* Top-5-Kunden + Aktivität */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Panel
          className="lg:col-span-8"
          eyebrow="Top 5"
          title={
            <>
              Kunden <span className="italic">nach Eiermenge</span>
            </>
          }
          actions={
            <Link
              to="/ranking"
              className="text-xs font-mono text-muted-foreground hover:text-ink underline decoration-rule underline-offset-4"
            >
              Vollständige Rangliste →
            </Link>
          }
        >
          {loading || !daten ? (
            <Skeleton className="h-[260px]" />
          ) : (
            <ol className="space-y-4">
              {top5Kunden.map((k, i) => {
                const pct = Math.max(2, (k.eier / maxEierKunde) * 100);
                return (
                  <li
                    key={k.kundennummer}
                    onClick={() => navigate(`/kunden/${encodeURIComponent(k.kundennummer)}`)}
                    className="cursor-pointer space-y-1.5 group"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex items-baseline gap-3 min-w-0">
                        <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm text-ink group-hover:text-yolk truncate">
                          {k.kundenname}
                        </span>
                      </span>
                      <span className="font-mono text-sm tabular-nums text-ink shrink-0">
                        {formatZahl(k.eier)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-rule/40 overflow-hidden">
                      <div
                        className="h-full bg-yolk rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <Panel className="lg:col-span-4" eyebrow="Aktivität" title="Letzte Imports">
          {loading || !imports ? (
            <Skeleton className="h-[260px]" />
          ) : imports.length === 0 ? (
            <EmptyState
              illustration={<Hen />}
              title="Noch keine Imports"
              description="Laden Sie eine CSV im Bereich Import hoch, um Auswertungen zu sehen."
              action={
                <Link
                  to="/import"
                  className="inline-flex items-center gap-2 rounded-full bg-yolk text-ink px-4 py-2 text-sm font-medium hover:bg-yolk/90 active:scale-95 transition min-h-[44px]"
                >
                  Zum Import
                </Link>
              }
            />
          ) : (
            <ul className="space-y-5">
              {imports.map((imp) => (
                <li key={imp.id} className="flex gap-3">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sage"
                    aria-hidden="true"
                  />
                  <Link
                    to={`/import/${imp.id}`}
                    className="block min-w-0 flex-1 hover:text-yolk transition"
                  >
                    <div className="text-sm text-ink">
                      {formatZahl(imp.zeilen_importiert)} Zeilen importiert
                    </div>
                    <div className="font-mono text-xs text-muted-foreground truncate">
                      {formatDatum(imp.import_datum.slice(0, 10))} · {imp.dateiname}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
