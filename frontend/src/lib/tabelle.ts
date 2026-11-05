/**
 * Klassen für rohe shadcn-`<Table>`s, die auf dem Handy horizontal scrollen:
 * erste Spalte bleibt stehen (Orientierung beim Wischen). Hintergrund nötig,
 * damit scrollende Zellen nicht durchscheinen.
 */
export const TABELLE_STICKY_ERSTE_SPALTE =
  "[&_tr>*:first-child]:sticky [&_tr>*:first-child]:left-0 [&_tr>*:first-child]:z-10 [&_tr>*:first-child]:bg-surface";
