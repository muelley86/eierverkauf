/**
 * Datums-Helfer ohne Zeitzonen-Falle.
 *
 * `Date.toISOString()` rechnet nach UTC um — lokale Mitternacht in MEZ wird so
 * zum Vortag (01.01. → "…-12-31"). Für Zeitraumgrenzen daher immer die
 * lokalen Kalenderfelder verwenden.
 */

function zweistellig(n: number): string {
  return String(n).padStart(2, "0");
}

/** Lokales Kalenderdatum als 'YYYY-MM-DD'. */
export function isoDatumLokal(d: Date): string {
  return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}`;
}
