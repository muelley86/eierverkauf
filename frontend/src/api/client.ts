/**
 * Axios-Client für alle Backend-Endpunkte. Strikt typisiert, keine `any`.
 */
import axios, { AxiosInstance } from "axios";

export const api: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 60_000,
});

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface DashboardKPIs {
  gesamt_eier: number;
  umsatz: number;
  anzahl_kunden: number;
  anzahl_positionen: number;
}

export interface KundeTop {
  kundennummer: string;
  kundenname: string;
  eier: number;
  umsatz: number;
}

export interface ArtikelTop {
  artikel_code: string;
  eier: number;
  menge: number;
  umsatz: number;
}

export interface DashboardResponse {
  kpis: DashboardKPIs;
  /** KPIs für denselben Zeitraum ein Jahr zurück; null wenn ohne Filter. */
  vorjahres_kpis: DashboardKPIs | null;
  top5_kunden: KundeTop[];
  top5_artikel: ArtikelTop[];
}

export interface KundenZeile {
  kundennummer: string;
  kundenname: string;
  eier: number;
  umsatz: number;
  positionen: number;
  letzter_kauf: string | null;
}

export interface KundeStamm {
  kundennummer: string;
  kundenname: string;
  erster_kauf: string | null;
  letzter_kauf: string | null;
  positionen: number;
}

export interface MonatsZeile {
  monat: string;
  eier: number;
  umsatz: number;
  positionen?: number;
  menge?: number;
}

export interface JahresvergleichZeile {
  monat: number;
  jahr: number;
  vorjahr: number;
  differenz: number;
  jahr_umsatz: number;
  vorjahr_umsatz: number;
  differenz_umsatz: number;
}

export interface ArtikelZeile {
  artikel_code: string;
  menge: number;
  eier: number;
  umsatz: number;
  positionen: number;
}

export interface RankingZeile {
  kundennummer: string;
  kundenname: string;
  eier: number;
  umsatz: number;
}

export interface ImportProtokollEintrag {
  id: number;
  import_datum: string;
  dateiname: string;
  datumsbereich: string | null;
  zeilen_importiert: number;
  zeilen_uebersprungen: number;
  zeilen_fehlerhaft: number;
}

export interface ImportErgebnis {
  import_id: number;
  zeilen_importiert: number;
  zeilen_uebersprungen: number;
  zeilen_fehlerhaft: number;
  datumsbereich: string;
  dateiname: string;
  /** Bis zu 50 Detail-Gründe, warum einzelne Zeilen verworfen wurden. */
  fehler_details: string[];
  /** Backend-Warnungen, wenn wichtige Spalten (z.B. Gesamt) im Header
   *  nicht erkannt wurden. Wird prominent oberhalb des Protokolls angezeigt. */
  header_warnungen: string[];
}

export interface ImportProtokollZeile {
  csv_zeile: number;
  grund: string;
  rohdaten: string;
}

export interface ImportDetail extends ImportProtokollEintrag {
  fehler: ImportProtokollZeile[];
  duplikat: ImportProtokollZeile[];
}

export interface VorschauResponse {
  zeilen: Record<string, string>[];
  anzahl: number;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export interface Zeitraum {
  von?: string; // ISO YYYY-MM-DD
  bis?: string;
}

function params(z: Zeitraum, extra: Record<string, string | number | undefined> = {}): URLSearchParams {
  const sp = new URLSearchParams();
  if (z.von) sp.set("von", z.von);
  if (z.bis) sp.set("bis", z.bis);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp;
}

// ---------------------------------------------------------------------------
// Endpunkte
// ---------------------------------------------------------------------------

export async function getDashboard(z: Zeitraum): Promise<DashboardResponse> {
  const { data } = await api.get<DashboardResponse>(`/dashboard?${params(z)}`);
  return data;
}

export async function getKunden(z: Zeitraum): Promise<KundenZeile[]> {
  const { data } = await api.get<KundenZeile[]>(`/kunden?${params(z)}`);
  return data;
}

export async function getKundeStamm(nr: string): Promise<KundeStamm> {
  const { data } = await api.get<KundeStamm>(`/kunden/${encodeURIComponent(nr)}`);
  return data;
}

export async function getKundeMonate(nr: string, z: Zeitraum): Promise<MonatsZeile[]> {
  const { data } = await api.get<MonatsZeile[]>(
    `/kunden/${encodeURIComponent(nr)}/monate?${params(z)}`,
  );
  return data;
}

export async function getKundeJahresvergleich(nr: string, jahr: number): Promise<JahresvergleichZeile[]> {
  const { data } = await api.get<JahresvergleichZeile[]>(
    `/kunden/${encodeURIComponent(nr)}/jahresvergleich?jahr=${jahr}`,
  );
  return data;
}

export async function getArtikel(z: Zeitraum): Promise<ArtikelZeile[]> {
  const { data } = await api.get<ArtikelZeile[]>(`/artikel?${params(z)}`);
  return data;
}

export async function getArtikelMonate(code: string, z: Zeitraum): Promise<MonatsZeile[]> {
  const { data } = await api.get<MonatsZeile[]>(
    `/artikel/${encodeURIComponent(code)}/monate?${params(z)}`,
  );
  return data;
}

export async function getRanking(z: Zeitraum, sort: "menge" | "umsatz"): Promise<RankingZeile[]> {
  const { data } = await api.get<RankingZeile[]>(`/ranking?${params(z, { sort })}`);
  return data;
}

export async function getJahresvergleich(jahr: number): Promise<JahresvergleichZeile[]> {
  const { data } = await api.get<JahresvergleichZeile[]>(`/jahresvergleich?jahr=${jahr}`);
  return data;
}

export async function uploadImport(file: File): Promise<ImportErgebnis> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post<ImportErgebnis>("/import", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function uploadVorschau(file: File): Promise<VorschauResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post<VorschauResponse>("/import/preview", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getImportHistorie(): Promise<ImportProtokollEintrag[]> {
  const { data } = await api.get<ImportProtokollEintrag[]>("/imports");
  return data;
}

export async function getImportDetail(id: number): Promise<ImportDetail> {
  const { data } = await api.get<ImportDetail>(`/imports/${id}`);
  return data;
}

export async function deleteImport(id: number): Promise<void> {
  await api.delete(`/imports/${id}`);
}

// Export-URLs (Browser-Download via <a href>) -------------------------------
export interface ExportOptionen extends Zeitraum {
  typ:
    | "kunden"
    | "artikel"
    | "ranking"
    | "kunde_monate"
    | "artikel_monate"
    | "jahresvergleich";
  kunde_nr?: string;
  code?: string;
  jahr?: number;
  sort?: "menge" | "umsatz";
}

export function exportExcelUrl(opt: ExportOptionen): string {
  const sp = params(opt, {
    typ: opt.typ,
    kunde_nr: opt.kunde_nr,
    code: opt.code,
    jahr: opt.jahr,
    sort: opt.sort,
  });
  return `/api/export/excel?${sp}`;
}

export function exportPdfUrl(opt: ExportOptionen): string {
  const sp = params(opt, {
    typ: opt.typ,
    kunde_nr: opt.kunde_nr,
    code: opt.code,
    jahr: opt.jahr,
    sort: opt.sort,
  });
  return `/api/export/pdf?${sp}`;
}
