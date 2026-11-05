import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isoDatumLokal, pruefeZeitraum } from "./datum";

describe("isoDatumLokal", () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Europe/Berlin";
  });

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("liefert für lokale Mitternacht am 01.01. denselben Kalendertag (kein UTC-Versatz)", () => {
    expect(isoDatumLokal(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("liefert für den 31.12. im Sommerzeit-freien Winter den 31.12.", () => {
    expect(isoDatumLokal(new Date(2025, 11, 31))).toBe("2025-12-31");
  });

  it("füllt Monat und Tag zweistellig auf", () => {
    expect(isoDatumLokal(new Date(2026, 6, 5, 23, 59))).toBe("2026-07-05");
  });
});

describe("pruefeZeitraum", () => {
  it("akzeptiert einen gültigen Zeitraum", () => {
    expect(pruefeZeitraum("2026-01-01", "2026-09-30")).toBeNull();
  });

  it("akzeptiert einen einzelnen Tag", () => {
    expect(pruefeZeitraum("2026-09-30", "2026-09-30")).toBeNull();
  });

  it("meldet leere oder unvollständige Eingaben", () => {
    expect(pruefeZeitraum("", "2026-09-30")).toBe("Bitte ein vollständiges Von-Datum eingeben.");
    expect(pruefeZeitraum("2026-01-01", "")).toBe("Bitte ein vollständiges Bis-Datum eingeben.");
  });

  it("meldet Jahreszahlen, die noch getippt werden (z. B. 0002)", () => {
    expect(pruefeZeitraum("0002-01-01", "2026-09-30")).toBe(
      "Bitte ein Jahr zwischen 2000 und 2099 eingeben.",
    );
  });

  it("meldet von nach bis", () => {
    expect(pruefeZeitraum("2026-10-01", "2026-09-30")).toBe("„Von“ darf nicht nach „Bis“ liegen.");
  });
});
