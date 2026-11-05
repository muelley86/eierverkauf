import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isoDatumLokal } from "./datum";

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
