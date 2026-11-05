import { describe, expect, test } from "vitest";
import {
  formatBruttoRetouren,
  formatCentJeEi,
  formatEuro,
  formatVerlaufLabel,
  formatZahl,
  kuerzeText,
} from "./formatierung";

describe("formatCentJeEi", () => {
  test("formatiert Umsatz je Ei in Cent mit einer Nachkommastelle", () => {
    expect(formatCentJeEi(24.8, 100)).toBe("24,8 ct");
    expect(formatCentJeEi(33.8, 100)).toBe("33,8 ct");
  });

  test("rundet auf eine Nachkommastelle (deutsches Komma)", () => {
    // 21964 € / 88380 Eier = 24,851… ct
    expect(formatCentJeEi(21964, 88380)).toBe("24,9 ct");
  });

  test("zeigt 0,0 ct bei Umsatz null Euro aber vorhandenen Eiern", () => {
    expect(formatCentJeEi(0, 100)).toBe("0,0 ct");
  });

  test("liefert Platzhalter ohne Eier-Stückzahl", () => {
    expect(formatCentJeEi(100, 0)).toBe("—");
    expect(formatCentJeEi(100, null)).toBe("—");
    expect(formatCentJeEi(100, undefined)).toBe("—");
  });

  test("liefert Platzhalter ohne Umsatz-Wert", () => {
    expect(formatCentJeEi(null, 100)).toBe("—");
    expect(formatCentJeEi(undefined, 100)).toBe("—");
  });
});

describe("formatBruttoRetouren", () => {
  test("liefert null ohne Retouren im Zeitraum", () => {
    expect(formatBruttoRetouren(573066, 0, formatZahl)).toBeNull();
  });

  test("liefert null bei fehlenden Werten", () => {
    expect(formatBruttoRetouren(null, -50274, formatZahl)).toBeNull();
    expect(formatBruttoRetouren(undefined, -50274, formatZahl)).toBeNull();
    expect(formatBruttoRetouren(573066, null, formatZahl)).toBeNull();
    expect(formatBruttoRetouren(573066, undefined, formatZahl)).toBeNull();
  });

  test("zeigt die Zeile auch bei Brutto 0 (Zeitraum nur mit Retouren)", () => {
    expect(formatBruttoRetouren(0, -20, formatZahl)).toBe(
      `Verkauft ${formatZahl(0)} · Retouren ${formatZahl(-20)}`,
    );
  });

  test("setzt Brutto und Retouren mit dem Zahl-Formatter zusammen", () => {
    expect(formatBruttoRetouren(573066, -50274, formatZahl)).toBe(
      `Verkauft ${formatZahl(573066)} · Retouren ${formatZahl(-50274)}`,
    );
  });

  test("funktioniert mit dem Euro-Formatter", () => {
    expect(formatBruttoRetouren(74.8, -15, formatEuro)).toBe(
      `Verkauft ${formatEuro(74.8)} · Retouren ${formatEuro(-15)}`,
    );
  });
});

describe("formatVerlaufLabel", () => {
  test("formatiert Tages-Buckets als 'TT.MM.'", () => {
    expect(formatVerlaufLabel("2026-11-03", "tag")).toBe("03.11.");
  });

  test("formatiert Wochen-Buckets mit Startdatum", () => {
    expect(formatVerlaufLabel("2026-11-02", "woche")).toBe("ab 02.11.");
  });

  test("formatiert Monats-Buckets als 'Mon JJ'", () => {
    expect(formatVerlaufLabel("2025-11-15", "monat")).toBe("Nov 25");
  });
});

describe("kuerzeText", () => {
  test("lässt kurze Texte unverändert", () => {
    expect(kuerzeText("EDEKA", 10)).toBe("EDEKA");
  });

  test("kürzt lange Texte auf die Maximallänge inklusive Auslassungszeichen", () => {
    expect(kuerzeText("REWE Markt GmbH, Zweigniederlassung", 12)).toBe("REWE Markt…");
  });
});
