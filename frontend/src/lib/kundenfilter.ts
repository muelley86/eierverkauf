/**
 * Reine Helfer für den Kundenfilter (Mehrfachauswahl, seit v1.16.0).
 */
import type { KundeOption } from "@/api/client";

/** Muss zu MAX_KUNDEN in api/kundenfilter.py passen. */
export const MAX_KUNDEN = 500;

/** Beschriftung der Filter-Pille: „Alle Kunden", Name des einen Kunden oder „3 Kunden". */
export function kundenFilterLabel(gewaehlt: string[], liste: KundeOption[]): string {
  if (gewaehlt.length === 0) return "Alle Kunden";
  if (gewaehlt.length === 1) {
    const kunde = liste.find((k) => k.kundennummer === gewaehlt[0]);
    return kunde?.kundenname ?? `Kunde ${gewaehlt[0]}`;
  }
  return `${gewaehlt.length} Kunden`;
}

/** Suche über Name und Kundennummer, ohne Groß-/Kleinschreibung. */
export function filtereKunden(liste: KundeOption[], suche: string): KundeOption[] {
  const s = suche.trim().toLocaleLowerCase("de-DE");
  if (!s) return liste;
  return liste.filter(
    (k) =>
      k.kundenname.toLocaleLowerCase("de-DE").includes(s) || k.kundennummer.toLowerCase().includes(s),
  );
}

/** Schaltet eine Kundennummer in der Auswahl um (neue Liste, Eingabe bleibt unverändert). */
export function umschalten(gewaehlt: string[], kundennummer: string): string[] {
  return gewaehlt.includes(kundennummer)
    ? gewaehlt.filter((nr) => nr !== kundennummer)
    : [...gewaehlt, kundennummer];
}

/** Liest eine gespeicherte Auswahl robust ein; alles Unerwartete ergibt „alle Kunden". */
export function ladeGespeicherteKunden(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const wert: unknown = JSON.parse(raw);
    if (!Array.isArray(wert)) return [];
    const nummern = wert.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    return [...new Set(nummern)].slice(0, MAX_KUNDEN);
  } catch {
    return [];
  }
}
