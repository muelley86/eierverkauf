/**
 * Deutsche Zahlen- und Datumsformatierung.
 *
 * Wir nutzen toLocaleString('de-DE') statt date-fns für Zahlen (kürzer),
 * und date-fns nur für Datumsoperationen.
 */
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

export function formatZahl(wert: number | null | undefined, dezimal = 0): string {
  if (wert === null || wert === undefined || Number.isNaN(wert)) return "—";
  return wert.toLocaleString("de-DE", {
    minimumFractionDigits: dezimal,
    maximumFractionDigits: dezimal,
  });
}

export function formatEuro(wert: number | null | undefined): string {
  if (wert === null || wert === undefined || Number.isNaN(wert)) return "—";
  return wert.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Umsatz je Ei in Cent ('24,8 ct'). '—' wenn keine Eier-Stückzahl vorliegt. */
export function formatCentJeEi(
  umsatz: number | null | undefined,
  eier: number | null | undefined,
): string {
  if (umsatz === null || umsatz === undefined || Number.isNaN(umsatz) || !eier) return "—";
  return `${formatZahl((umsatz / eier) * 100, 1)} ct`;
}

/** ISO-Datum 'YYYY-MM-DD' -> 'DD.MM.YYYY'. */
export function formatDatum(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd.MM.yyyy", { locale: de });
  } catch {
    return iso;
  }
}

/** 'YYYY-MM' -> 'Mär 2025' (kurzer Monatsname). */
export function formatMonat(jahrMonat: string | null | undefined): string {
  if (!jahrMonat) return "—";
  try {
    return format(parseISO(`${jahrMonat}-01`), "MMM yyyy", { locale: de });
  } catch {
    return jahrMonat;
  }
}

/** Monatsname zu Zahl 1..12 ('Januar', 'Februar', ...). */
export const MONATSNAMEN: readonly string[] = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export function monatsname(nr: number): string {
  return MONATSNAMEN[nr - 1] ?? String(nr);
}

export function monatsKurz(nr: number): string {
  return MONATSNAMEN[nr - 1]?.slice(0, 3) ?? String(nr);
}
