import { describe, expect, it } from "vitest";
import { filtereKunden, kundenFilterLabel, ladeGespeicherteKunden, umschalten } from "./kundenfilter";

const LISTE = [
  { kundennummer: "10001", kundenname: "Anna Müller" },
  { kundennummer: "15.100.008", kundenname: "Bäckerei Bert" },
];

describe("kundenFilterLabel", () => {
  it("zeigt Alle Kunden ohne Auswahl", () => {
    expect(kundenFilterLabel([], LISTE)).toBe("Alle Kunden");
  });

  it("zeigt den Namen bei genau einem Kunden", () => {
    expect(kundenFilterLabel(["15.100.008"], LISTE)).toBe("Bäckerei Bert");
  });

  it("fällt auf die Nummer zurück, solange die Liste noch nicht geladen ist", () => {
    expect(kundenFilterLabel(["10001"], [])).toBe("Kunde 10001");
  });

  it("zeigt die Anzahl bei mehreren Kunden", () => {
    expect(kundenFilterLabel(["10001", "15.100.008"], LISTE)).toBe("2 Kunden");
  });
});

describe("filtereKunden", () => {
  it("sucht ohne Groß-/Kleinschreibung im Namen", () => {
    expect(filtereKunden(LISTE, "BÄCK").map((k) => k.kundennummer)).toEqual(["15.100.008"]);
  });

  it("sucht in der Kundennummer inklusive Punkten", () => {
    expect(filtereKunden(LISTE, "15.100").map((k) => k.kundenname)).toEqual(["Bäckerei Bert"]);
  });

  it("liefert ohne Suchtext alles", () => {
    expect(filtereKunden(LISTE, "  ")).toHaveLength(2);
  });
});

describe("umschalten", () => {
  it("fügt hinzu und entfernt, ohne die Eingabe zu verändern", () => {
    const vorher = ["10001"];
    expect(umschalten(vorher, "2")).toEqual(["10001", "2"]);
    expect(umschalten(vorher, "10001")).toEqual([]);
    expect(vorher).toEqual(["10001"]);
  });
});

describe("ladeGespeicherteKunden", () => {
  it("liest eine gültige Liste und entfernt Doppelte und Leere", () => {
    expect(ladeGespeicherteKunden('["1","1","", "2"]')).toEqual(["1", "2"]);
  });

  it.each([null, "", "kaputt", '{"a":1}', "[1,2]"])("verwirft Unerwartetes: %s", (raw) => {
    expect(ladeGespeicherteKunden(raw)).toEqual([]);
  });
});
