/**
 * Zentrale Quelle für Recharts-Farbwerte. Recharts erwartet Hex/RGB direkt in
 * Props (fill/stroke) — Tailwind-Tokens funktionieren dort nicht. Deshalb dieses
 * Mapping; bei Palette-Anpassungen nur hier ändern.
 */

export const CHART_FARBEN = {
  yolk: "#D69826",
  sage: "#5A7F4F",
  brick: "#B5532C",
  vorjahr: "#B5A98C",
  rule: "#E4D9BB",
  inkMuted: "#6F6552",
  ink: "#1A1610",
  surface: "#FAF5E6",
  straw: "#F0E6CC",
} as const;

export const TOOLTIP_STYLE = {
  background: CHART_FARBEN.surface,
  border: `1px solid ${CHART_FARBEN.rule}`,
  borderRadius: 8,
  fontFamily: "JetBrains Mono",
  fontSize: 12,
} as const;

export const AXIS_TICK = {
  fill: CHART_FARBEN.inkMuted,
  fontSize: 11,
  fontFamily: "JetBrains Mono",
} as const;

export const CHART_GRID = {
  stroke: CHART_FARBEN.rule,
  strokeDasharray: "3 3",
} as const;
