import { describe, expect, test } from "vitest";
import { artikelLabel } from "./artikel";

describe("artikelLabel", () => {
  test("ergänzt PACK bei 10er Kvp", () => {
    expect(artikelLabel("10er Kvp")).toBe("10er Kvp (PACK)");
  });

  test("ergänzt PACK bei 6er Kvp", () => {
    expect(artikelLabel("6er Kvp")).toBe("6er Kvp (PACK)");
  });

  test("ergänzt stk bei Lose-Artikeln", () => {
    expect(artikelLabel("Lose 180")).toBe("Lose 180 (stk)");
    expect(artikelLabel("Lose 20")).toBe("Lose 20 (stk)");
    expect(artikelLabel("Lose unsortiert")).toBe("Lose unsortiert (stk)");
  });

  test("lässt Codes mit vorhandener Einheit unverändert", () => {
    expect(artikelLabel("10er Kvp (stk)")).toBe("10er Kvp (stk)");
    expect(artikelLabel("6er Kvp (stk)")).toBe("6er Kvp (stk)");
    expect(artikelLabel("Gewicht (kg)")).toBe("Gewicht (kg)");
  });

  test("lässt Sonstige ohne Einheiten-Zusatz", () => {
    expect(artikelLabel("Sonstige")).toBe("Sonstige");
  });

  test("liefert Platzhalter bei leerem Code", () => {
    expect(artikelLabel(null)).toBe("—");
    expect(artikelLabel(undefined)).toBe("—");
    expect(artikelLabel("")).toBe("—");
  });
});
