/**
 * Zentrale Quelle für Recharts-Farbwerte. Recharts erwartet Farben direkt in
 * Props (fill/stroke) — Tailwind-Klassen greifen dort nicht. Die Werte stehen
 * als `--chart-*` in index.css (hell + dunkel) und werden hier zur Laufzeit
 * gelesen; `useChartFarben()` rendert bei Wechsel des Farbschemas neu.
 */
import { useEffect, useMemo, useState } from "react";
import { abonniereSchema } from "@/lib/farbschema";

export interface ChartFarben {
  /** Eier-Reihen (Linie/Balken). */
  eier: string;
  /** Flächen-/Balkenfüllung für Eier (Buchenhof-Grün). */
  eierFlaeche: string;
  umsatz: string;
  vorjahr: string;
  raster: string;
  text: string;
  /** Kartenhintergrund (Punkt-Umrandung, Tooltip). */
  flaeche: string;
}

/** Fallback (helles Schema) für Umgebungen ohne DOM. */
const HELL: ChartFarben = {
  eier: "#76981C",
  eierFlaeche: "#B5D556",
  umsatz: "#565B5B",
  vorjahr: "#A6A9A9",
  raster: "#E6E7E4",
  text: "#565B5B",
  flaeche: "#FFFFFF",
};

const VARIABLEN: Record<keyof ChartFarben, string> = {
  eier: "--chart-eier",
  eierFlaeche: "--chart-eier-flaeche",
  umsatz: "--chart-umsatz",
  vorjahr: "--chart-vorjahr",
  raster: "--chart-raster",
  text: "--chart-text",
  flaeche: "--chart-flaeche",
};

export function leseChartFarben(): ChartFarben {
  if (typeof window === "undefined") return HELL;
  const stil = getComputedStyle(document.documentElement);
  const eintraege = Object.entries(VARIABLEN).map(([schluessel, variable]) => {
    const wert = stil.getPropertyValue(variable).trim();
    return [schluessel, wert || HELL[schluessel as keyof ChartFarben]];
  });
  return Object.fromEntries(eintraege) as unknown as ChartFarben;
}

export interface ChartStil {
  farben: ChartFarben;
  tooltip: Record<string, string | number>;
  achse: { fill: string; fontSize: number };
  raster: { stroke: string; strokeDasharray: string };
}

/** Farben + abgeleitete Recharts-Stile; folgt dem Hell/Dunkel-Umschalter. */
export function useChartFarben(): ChartStil {
  const [farben, setFarben] = useState<ChartFarben>(leseChartFarben);

  useEffect(() => {
    // Ein Lesen beim Einhängen deckt einen Wechsel zwischen erstem Render und Effekt ab.
    setFarben(leseChartFarben());
    return abonniereSchema(() => setFarben(leseChartFarben()));
  }, []);

  return useMemo(
    () => ({
      farben,
      tooltip: {
        background: farben.flaeche,
        border: `1px solid ${farben.raster}`,
        borderRadius: 10,
        fontSize: 12,
        color: farben.text,
        fontVariantNumeric: "tabular-nums",
      },
      achse: { fill: farben.text, fontSize: 11 },
      raster: { stroke: farben.raster, strokeDasharray: "3 3" },
    }),
    [farben],
  );
}
