import { ReactNode } from "react";
import { Area, AreaChart, Line, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { CHART_FARBEN } from "@/lib/chart-farben";

interface KPICardProps {
  titel: string;
  wert: ReactNode;
  hinweis?: string;
  delta?: { wert: string; richtung: "up" | "down" | "flat" };
  variant?: "hero" | "default";
  /** Farbton der großen Wert-Zahl. */
  wertFarbe?: "ink" | "yolk" | "sage";
  /** Daten-Array für eine kleine Sparkline (Index = X, value = Y). */
  sparkline?: number[];
  /** Strich-/Flächenfarbe der Sparkline. Default richtet sich nach `wertFarbe`. */
  sparklineFarbe?: string;
  /** Optionale Illustration (SVG-Komponente), die als Wasserzeichen rechts oben sitzt (Hero). */
  illustration?: ReactNode;
  className?: string;
}

const FARB_KLASSEN: Record<NonNullable<KPICardProps["wertFarbe"]>, string> = {
  ink: "text-ink",
  yolk: "text-yolk",
  sage: "text-sage",
};

const FARB_HEX: Record<NonNullable<KPICardProps["wertFarbe"]>, string> = {
  ink: CHART_FARBEN.ink,
  yolk: CHART_FARBEN.yolk,
  sage: CHART_FARBEN.sage,
};

/** Mini-Area-Chart ohne Achsen — reines visuelles Verlaufssignal. */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const series = data.map((wert, i) => ({ i, wert }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="wert"
          stroke="none"
          fill={`url(#spark-${color.replace("#", "")})`}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="wert"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
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
  sparklineFarbe,
  illustration,
  className,
}: KPICardProps) {
  const isHero = variant === "hero";
  const farbeHex = sparklineFarbe ?? FARB_HEX[wertFarbe];

  // Hero-Variante: großer Wert links, optionale Illustration rechts oben, Sparkline schwebt unten rechts.
  if (isHero) {
    return (
      <div
        className={cn(
          "relative rounded-xl border border-rule bg-surface p-6 sm:p-8 flex flex-col md:col-span-2 lg:col-span-2 overflow-hidden",
          className,
        )}
      >
        <span className="eyebrow">{titel}</span>
        <div
          className={cn(
            "mt-4 sm:mt-6 kpi-value leading-none text-[64px] sm:text-[88px] md:text-[112px]",
            FARB_KLASSEN[wertFarbe],
          )}
        >
          {wert}
        </div>
        {/* pr reserviert die Ecke der absolut positionierten Sparkline, sonst läuft der Hinweis darunter. */}
        <div
          className={cn(
            "mt-4 sm:mt-6 flex items-center gap-3 flex-wrap",
            sparkline && sparkline.length > 1 && "pr-32 sm:pr-48",
          )}
        >
          {delta && (
            <span className={delta.richtung === "down" ? "delta-down" : "delta-up"}>
              {delta.richtung === "down" ? "▾" : "▴"} {delta.wert}
            </span>
          )}
          {hinweis && <span className="text-xs text-muted-foreground">{hinweis}</span>}
        </div>
        {illustration && (
          <div
            className={cn(
              "absolute top-6 right-6 w-24 sm:w-32 pointer-events-none opacity-30 hidden sm:block",
              FARB_KLASSEN[wertFarbe],
            )}
            aria-hidden="true"
          >
            {illustration}
          </div>
        )}
        {sparkline && sparkline.length > 1 && (
          <div
            className="absolute bottom-6 right-6 h-12 sm:h-14 w-32 sm:w-48 pointer-events-none opacity-80"
            aria-hidden="true"
          >
            <Sparkline data={sparkline} color={farbeHex} />
          </div>
        )}
      </div>
    );
  }

  // Default-Variante: Wert + Delta links, Sparkline (falls vorhanden) absolut in der rechten unteren Ecke.
  return (
    <div
      className={cn(
        "relative rounded-xl border border-rule bg-surface p-5 sm:p-6 flex flex-col gap-2 sm:gap-3 overflow-hidden",
        className,
      )}
    >
      <span className="eyebrow">{titel}</span>
      <div className={cn("kpi-value text-4xl sm:text-5xl md:text-6xl", FARB_KLASSEN[wertFarbe])}>
        {wert}
      </div>
      {delta && (
        <span
          className={cn(
            "self-start",
            delta.richtung === "down" ? "delta-down" : "delta-up",
          )}
        >
          {delta.richtung === "down" ? "▾" : "▴"} {delta.wert}
        </span>
      )}
      {hinweis && (
        <p
          className={cn(
            "text-sm text-muted-foreground leading-snug",
            // pr reserviert die Ecke der absolut positionierten Sparkline.
            sparkline && sparkline.length > 1 && "pr-28",
          )}
        >
          {hinweis}
        </p>
      )}
      {sparkline && sparkline.length > 1 && (
        <div
          className="absolute bottom-4 right-4 h-10 w-28 pointer-events-none opacity-80"
          aria-hidden="true"
        >
          <Sparkline data={sparkline} color={farbeHex} />
        </div>
      )}
    </div>
  );
}
