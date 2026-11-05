/**
 * Hell/Dunkel-Umschaltung (seit v1.16.0).
 *
 * Quelle der Wahrheit ist das Attribut `data-theme` auf <html>; index.css
 * hängt die Dunkel-Tokens an `:root[data-theme="dunkel"]`. Gesetzt wird es
 * vor dem ersten Rendern von `public/farbschema.js` (kein Aufblitzen) — die
 * Logik dort muss zu `wirksamesSchema` passen. Ohne eigene Wahl folgt die
 * App der Systemeinstellung, eine eigene Wahl steht in localStorage.
 */
import { useSyncExternalStore } from "react";

export type Farbschema = "hell" | "dunkel";

/** Muss zu public/farbschema.js passen. */
export const FARBSCHEMA_KEY = "eierverkauf.farbschema";
const SYSTEM_DUNKEL = "(prefers-color-scheme: dark)";

export function leseGespeichertesSchema(raw: string | null): Farbschema | null {
  return raw === "hell" || raw === "dunkel" ? raw : null;
}

export function wirksamesSchema(gespeichert: Farbschema | null, systemDunkel: boolean): Farbschema {
  return gespeichert ?? (systemDunkel ? "dunkel" : "hell");
}

export function gegenschema(schema: Farbschema): Farbschema {
  return schema === "hell" ? "dunkel" : "hell";
}

function gespeichert(): Farbschema | null {
  try {
    return leseGespeichertesSchema(localStorage.getItem(FARBSCHEMA_KEY));
  } catch {
    return null;
  }
}

function anwenden(schema: Farbschema): void {
  document.documentElement.dataset.theme = schema;
}

export function aktuellesSchema(): Farbschema {
  return document.documentElement.dataset.theme === "dunkel" ? "dunkel" : "hell";
}

/** Eigene Wahl setzen und merken. */
export function setzeSchema(schema: Farbschema): void {
  try {
    localStorage.setItem(FARBSCHEMA_KEY, schema);
  } catch {
    /* Merken ist nur Komfort */
  }
  anwenden(schema);
}

/** Meldet jede Änderung von `data-theme` (Umschalter oder Systemwechsel). */
export function abonniereSchema(rueckruf: () => void): () => void {
  const beobachter = new MutationObserver(rueckruf);
  beobachter.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => beobachter.disconnect();
}

/** Einmal beim Start: Schema setzen und Systemwechseln folgen, solange keine eigene Wahl besteht. */
export function starteFarbschema(): void {
  const mq = window.matchMedia(SYSTEM_DUNKEL);
  anwenden(wirksamesSchema(gespeichert(), mq.matches));
  mq.addEventListener("change", (e) => {
    if (gespeichert() === null) anwenden(e.matches ? "dunkel" : "hell");
  });
}

export function useFarbschema(): { schema: Farbschema; umschalten: () => void } {
  const schema = useSyncExternalStore(abonniereSchema, aktuellesSchema, () => "hell" as Farbschema);
  return { schema, umschalten: () => setzeSchema(gegenschema(schema)) };
}
