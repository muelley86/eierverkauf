/**
 * Gemeinsame Zeilenform für Jahres- und Zeitraumvergleich: beide Seiten zeigen
 * dasselbe Diagramm und dieselbe Tabelle (components/VergleichsAnsicht.tsx).
 */
import type { JahresvergleichZeile, ZeitraumVerlauf } from "@/api/client";
import { formatVerlaufLabel, monatsKurz } from "@/lib/formatierung";

export interface VergleichsZeile {
  schluessel: string;
  label: string;
  vorjahr: number;
  aktuell: number;
  /** Umsatz nur aus Positionen mit Eier-Stückzahl (Basis für Umsatz/Ei). */
  vorjahrEierUmsatz: number;
  aktuellEierUmsatz: number;
}

export interface VergleichsSumme {
  vorjahr: number;
  aktuell: number;
  vorjahrEierUmsatz: number;
  aktuellEierUmsatz: number;
}

export function zeilenAusJahresvergleich(daten: JahresvergleichZeile[]): VergleichsZeile[] {
  return daten.map((d) => ({
    schluessel: String(d.monat),
    label: monatsKurz(d.monat),
    vorjahr: d.vorjahr,
    aktuell: d.jahr,
    vorjahrEierUmsatz: d.vorjahr_eier_umsatz,
    aktuellEierUmsatz: d.jahr_eier_umsatz,
  }));
}

export function zeilenAusVerlauf(verlauf: ZeitraumVerlauf): VergleichsZeile[] {
  return verlauf.punkte.map((p) => ({
    schluessel: p.start,
    label: formatVerlaufLabel(p.start, verlauf.granularitaet),
    vorjahr: p.vorjahr_eier ?? 0,
    aktuell: p.eier,
    vorjahrEierUmsatz: p.vorjahr_eier_umsatz ?? 0,
    aktuellEierUmsatz: p.eier_umsatz,
  }));
}

export function summiereVergleich(zeilen: VergleichsZeile[]): VergleichsSumme {
  return zeilen.reduce<VergleichsSumme>(
    (summe, z) => ({
      vorjahr: summe.vorjahr + z.vorjahr,
      aktuell: summe.aktuell + z.aktuell,
      vorjahrEierUmsatz: summe.vorjahrEierUmsatz + z.vorjahrEierUmsatz,
      aktuellEierUmsatz: summe.aktuellEierUmsatz + z.aktuellEierUmsatz,
    }),
    { vorjahr: 0, aktuell: 0, vorjahrEierUmsatz: 0, aktuellEierUmsatz: 0 },
  );
}

/** Änderung in Prozent zum Vorjahr; null, wenn das Vorjahr 0 ist (nicht definiert). */
export function prozentAenderung(aktuell: number, vorjahr: number): number | null {
  if (vorjahr <= 0) return null;
  return ((aktuell - vorjahr) / vorjahr) * 100;
}
