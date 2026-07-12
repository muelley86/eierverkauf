/**
 * Anzeige-Labels für Artikel-Codes.
 *
 * Ergänzt die Verkaufseinheit in Klammern, wo der Code sie nicht schon
 * trägt. Muss synchron zu normiere_artikel() in data/importer.py bleiben.
 */
const ARTIKEL_EINHEIT: Record<string, string> = {
  "10er Kvp": "PACK",
  "6er Kvp": "PACK",
  "Lose 180": "stk",
  "Lose 20": "stk",
  "Lose unsortiert": "stk",
};

export function artikelLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const einheit = ARTIKEL_EINHEIT[code];
  return einheit ? `${code} (${einheit})` : code;
}
