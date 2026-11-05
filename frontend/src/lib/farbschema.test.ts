import { describe, expect, it } from "vitest";
import { gegenschema, leseGespeichertesSchema, wirksamesSchema } from "./farbschema";

describe("leseGespeichertesSchema", () => {
  it.each([
    ["hell", "hell"],
    ["dunkel", "dunkel"],
  ] as const)("übernimmt %s", (raw, erwartet) => {
    expect(leseGespeichertesSchema(raw)).toBe(erwartet);
  });

  it.each([null, "", "dark", "HELL"])("verwirft Unerwartetes: %s", (raw) => {
    expect(leseGespeichertesSchema(raw)).toBeNull();
  });
});

describe("wirksamesSchema", () => {
  it("folgt ohne eigene Wahl dem System", () => {
    expect(wirksamesSchema(null, true)).toBe("dunkel");
    expect(wirksamesSchema(null, false)).toBe("hell");
  });

  it("bevorzugt die eigene Wahl vor dem System", () => {
    expect(wirksamesSchema("hell", true)).toBe("hell");
    expect(wirksamesSchema("dunkel", false)).toBe("dunkel");
  });
});

describe("gegenschema", () => {
  it("schaltet um", () => {
    expect(gegenschema("hell")).toBe("dunkel");
    expect(gegenschema("dunkel")).toBe("hell");
  });
});
