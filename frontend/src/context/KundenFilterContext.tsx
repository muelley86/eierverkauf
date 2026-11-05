import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { ladeGespeicherteKunden } from "@/lib/kundenfilter";

/**
 * Globaler Kundenfilter (Mehrfachauswahl von Kundennummern, leer = alle).
 * Wirkt auf Belege, Kunden, Artikel, Zeitraum- und Jahresvergleich.
 * Persistiert in localStorage — wie der Zeitraum.
 */
export interface KundenFilterState {
  kunden: string[];
  setKunden: (kunden: string[]) => void;
  zuruecksetzen: () => void;
}

const KundenFilterContext = createContext<KundenFilterState | null>(null);

const STORAGE_KEY = "eierverkauf.kundenfilter.v1";

function loadInitial(): string[] {
  try {
    return ladeGespeicherteKunden(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function KundenFilterProvider({ children }: { children: ReactNode }) {
  const [kunden, setKunden] = useState<string[]>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kunden));
    } catch {
      /* Speichern ist nur Komfort */
    }
  }, [kunden]);

  const value = useMemo<KundenFilterState>(
    () => ({ kunden, setKunden, zuruecksetzen: () => setKunden([]) }),
    [kunden],
  );

  return <KundenFilterContext.Provider value={value}>{children}</KundenFilterContext.Provider>;
}

export function useKundenFilter(): KundenFilterState {
  const ctx = useContext(KundenFilterContext);
  if (!ctx) throw new Error("useKundenFilter muss innerhalb von <KundenFilterProvider> verwendet werden");
  return ctx;
}
