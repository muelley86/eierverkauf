import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

/**
 * Globaler Zeitraumfilter (Von/Bis). Default: laufendes Jahr.
 * Persistiert in localStorage.
 */

export interface ZeitraumState {
  von: string; // YYYY-MM-DD
  bis: string;
  setVon: (von: string) => void;
  setBis: (bis: string) => void;
  setRange: (von: string, bis: string) => void;
  dieserMonat: () => void;
  diesesQuartal: () => void;
  diesesJahr: () => void;
  letztesJahr: () => void;
  zuruecksetzen: () => void;
}

const ZeitraumContext = createContext<ZeitraumState | null>(null);

const STORAGE_KEY = "eierverkauf.zeitraum";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultRange(): { von: string; bis: string } {
  const heute = new Date();
  return { von: iso(new Date(heute.getFullYear(), 0, 1)), bis: iso(heute) };
}

function loadInitial(): { von: string; bis: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { von?: string; bis?: string };
      if (parsed.von && parsed.bis) return { von: parsed.von, bis: parsed.bis };
    }
  } catch {
    /* ignore */
  }
  return defaultRange();
}

export function ZeitraumProvider({ children }: { children: ReactNode }) {
  const initial = loadInitial();
  const [von, setVon] = useState<string>(initial.von);
  const [bis, setBis] = useState<string>(initial.bis);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ von, bis }));
  }, [von, bis]);

  const setRange = useCallback((v: string, b: string) => {
    setVon(v);
    setBis(b);
  }, []);

  const dieserMonat = useCallback(() => {
    const h = new Date();
    setRange(iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(h));
  }, [setRange]);

  const diesesQuartal = useCallback(() => {
    const h = new Date();
    const qStart = Math.floor(h.getMonth() / 3) * 3;
    setRange(iso(new Date(h.getFullYear(), qStart, 1)), iso(h));
  }, [setRange]);

  const diesesJahr = useCallback(() => {
    const h = new Date();
    setRange(iso(new Date(h.getFullYear(), 0, 1)), iso(h));
  }, [setRange]);

  const letztesJahr = useCallback(() => {
    const h = new Date();
    const jahr = h.getFullYear() - 1;
    setRange(iso(new Date(jahr, 0, 1)), iso(new Date(jahr, 11, 31)));
  }, [setRange]);

  const zuruecksetzen = useCallback(() => {
    const d = defaultRange();
    setRange(d.von, d.bis);
  }, [setRange]);

  const value = useMemo<ZeitraumState>(
    () => ({
      von,
      bis,
      setVon,
      setBis,
      setRange,
      dieserMonat,
      diesesQuartal,
      diesesJahr,
      letztesJahr,
      zuruecksetzen,
    }),
    [von, bis, setRange, dieserMonat, diesesQuartal, diesesJahr, letztesJahr, zuruecksetzen],
  );

  return <ZeitraumContext.Provider value={value}>{children}</ZeitraumContext.Provider>;
}

export function useZeitraum(): ZeitraumState {
  const ctx = useContext(ZeitraumContext);
  if (!ctx) throw new Error("useZeitraum muss innerhalb von <ZeitraumProvider> verwendet werden");
  return ctx;
}
