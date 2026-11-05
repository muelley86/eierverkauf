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

/** Plausible Jahre für Verkaufsdaten (CSV-Importe deuten 2-stellige Jahre als 20YY). */
const MIN_JAHR = 2000;
const MAX_JAHR = 2099;
const ISO_DATUM = /^(\d{4})-\d{2}-\d{2}$/;

function pruefeDatum(wert: string, name: "Von" | "Bis"): string | null {
  const treffer = ISO_DATUM.exec(wert);
  if (!treffer) return `Bitte ein vollständiges ${name}-Datum eingeben.`;
  const jahr = Number(treffer[1]);
  if (jahr < MIN_JAHR || jahr > MAX_JAHR) {
    return `Bitte ein Jahr zwischen ${MIN_JAHR} und ${MAX_JAHR} eingeben.`;
  }
  return null;
}

/**
 * Prüft eine Zeitraum-Eingabe, bevor sie global übernommen wird.
 * Liefert eine Fehlermeldung für den Nutzer oder `null`, wenn alles passt.
 * Verhindert, dass Zwischenstände beim Tippen (Jahr „0002", Von nach Bis)
 * als API-Abfragen rausgehen.
 */
export function pruefeZeitraum(von: string, bis: string): string | null {
  const fehler = pruefeDatum(von, "Von") ?? pruefeDatum(bis, "Bis");
  if (fehler) return fehler;
  // ISO-Daten sind lexikographisch vergleichbar.
  if (von > bis) return "„Von“ darf nicht nach „Bis“ liegen.";
  return null;
}
