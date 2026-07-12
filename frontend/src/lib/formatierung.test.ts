import { describe, expect, test } from "vitest";
import { formatCentJeEi } from "./formatierung";

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
