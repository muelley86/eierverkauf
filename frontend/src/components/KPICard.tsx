import { ReactNode, useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { useChartFarben } from "@/lib/chart-farben";

interface KPICardProps {
  titel: string;
  wert: ReactNode;
  hinweis?: string;
  /** Prozentänderung zum Vorjahr; „zum Vorjahr" ergänzt die Karte selbst. */
  delta?: { wert: string; richtung: "up" | "down" | "flat" };
  /** `hero` = dunkle Anthrazit-Karte mit grünem Wert (eine pro Seite). */
  variant?: "hero" | "default";
  /** Farbton der Wert-Zahl. */
  wertFarbe?: "ink" | "brand";
  /** Werte für die Verlaufslinie am unteren Kartenrand (ab 2 Punkten sichtbar). */
  sparkline?: number[];
  /** Welche Diagrammfarbe die Verlaufslinie nutzt. */
  sparklineReihe?: "eier" | "umsatz";
  className?: string;
}

const MIN_SPARKLINE_PUNKTE = 2;

const FARB_KLASSEN: Record<NonNullable<KPICardProps["wertFarbe"]>, string> = {
  ink: "text-ink",
  brand: "text-brand-strong",
};

/** Achsenlose Fläche als reines Verlaufssignal, volle Kartenbreite. */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const verlaufId = useId().replace(/:/g, "");
  const series = data.map((wert, i) => ({ i, wert }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={verlaufId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="wert"
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#${verlaufId})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DeltaPille({ delta, kompakt }: { delta: NonNullable<KPICardProps["delta"]>; kompakt: boolean }) {
  const runter = delta.richtung === "down";
  return (
    <span className={cn("self-start whitespace-nowrap", runter ? "delta-down" : "delta-up")}>
      <span aria-hidden="true">{runter ? "▾" : "▴"}</span> {delta.wert}
      {/* Kleine Karten auf dem Handy: nur die Prozentzahl, damit die Pille nicht umbricht. */}
      <span className={cn(kompakt && "sr-only sm:not-sr-only")}> zum Vorjahr</span>
    </span>
  );
}

export function KPICard({
  titel,
  wert,
  hinweis,
  delta,
  variant = "default",
  wertFarbe = "ink",
  sparkline,
  sparklineReihe = "eier",
  className,
}: KPICardProps) {
  const { farben } = useChartFarben();
  const isHero = variant === "hero";
  const zeigeSparkline = (sparkline?.length ?? 0) >= MIN_SPARKLINE_PUNKTE;
  const linienFarbe =
    sparklineReihe === "umsatz" ? farben.umsatz : isHero ? farben.eierFlaeche : farben.eier;

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl",
        isHero ? "flaeche-dunkel border border-rule" : "border border-rule bg-surface",
        className,
      )}
    >
      {/* Hero-Wert skaliert mit der Kartenbreite (cqi), nicht mit dem Viewport — sonst bricht „3.590.551" um. */}
      <div className={cn("flex flex-col gap-2", isHero ? "p-6 [container-type:inline-size] sm:p-8" : "p-5")}>
        <span className="text-sm font-medium text-muted-foreground">{titel}</span>
        <div
          className={cn(
            "kpi-value break-words",
            isHero
              ? "mt-2 text-[clamp(2.5rem,15cqi,6.5rem)] text-brand-strong"
              : "text-3xl sm:text-4xl",
            !isHero && FARB_KLASSEN[wertFarbe],
          )}
        >
          {wert}
        </div>
        {(delta || hinweis) && (
          <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", isHero && "mt-2")}>
            {delta && <DeltaPille delta={delta} kompakt={!isHero} />}
            {hinweis && <span className="text-xs text-muted-foreground tabular-nums">{hinweis}</span>}
          </div>
        )}
      </div>
      {zeigeSparkline && sparkline && (
        <div
          className={cn("mt-auto w-full pointer-events-none", isHero ? "h-20 sm:h-24" : "h-10")}
          aria-hidden="true"
        >
          <Sparkline data={sparkline} color={linienFarbe} />
        </div>
      )}
    </div>
  );
}
