import { describe, expect, test } from "vitest";
import type { ZeitraumVerlauf } from "@/api/client";
import { prozentAenderung, summiereVergleich, zeilenAusVerlauf } from "./vergleich";

const VERLAUF: ZeitraumVerlauf = {
  granularitaet: "tag",
  zeitraum: { von: "2026-11-01", bis: "2026-11-02" },
  vorjahreszeitraum: { von: "2025-11-01", bis: "2025-11-02" },
  punkte: [
    { start: "2026-11-01", eier: 100, umsatz: 30, eier_umsatz: 25,
      vorjahr_eier: 80, vorjahr_umsatz: 20, vorjahr_eier_umsatz: 20 },
    { start: "2026-11-02", eier: 0, umsatz: 0, eier_umsatz: 0,
      vorjahr_eier: null, vorjahr_umsatz: null, vorjahr_eier_umsatz: null },
  ],
};

describe("zeilenAusVerlauf", () => {
  test("übernimmt Werte, beschriftet Buckets und setzt fehlende Vorjahreswerte auf 0", () => {
    const zeilen = zeilenAusVerlauf(VERLAUF);

    expect(zeilen[0]).toEqual({
      schluessel: "2026-11-01", label: "01.11.", vorjahr: 80, aktuell: 100,
      vorjahrEierUmsatz: 20, aktuellEierUmsatz: 25,
    });
    expect(zeilen[1].vorjahr).toBe(0);
  });
});

describe("summiereVergleich", () => {
  test("summiert alle Spalten", () => {
    expect(summiereVergleich(zeilenAusVerlauf(VERLAUF))).toEqual({
      vorjahr: 80, aktuell: 100, vorjahrEierUmsatz: 20, aktuellEierUmsatz: 25,
    });
  });
});

describe("prozentAenderung", () => {
  test("berechnet die Änderung zum Vorjahr", () => {
    expect(prozentAenderung(110, 100)).toBeCloseTo(10);
  });

  test("liefert null bei Vorjahr 0", () => {
    expect(prozentAenderung(50, 0)).toBeNull();
  });
});
