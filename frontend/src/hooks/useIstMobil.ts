import { useEffect, useState } from "react";

/** Entspricht Tailwind `sm` (640 px): darunter gilt die Ansicht als Handy. */
const MOBIL_QUERY = "(max-width: 639px)";

function istMobil(): boolean {
  return typeof window !== "undefined" && window.matchMedia(MOBIL_QUERY).matches;
}

/** Für Diagramm-Props (Achsenbreiten, Abstände), die Tailwind nicht erreicht. */
export function useIstMobil(): boolean {
  const [mobil, setMobil] = useState<boolean>(istMobil);
  useEffect(() => {
    const mq = window.matchMedia(MOBIL_QUERY);
    const aktualisieren = () => setMobil(mq.matches);
    mq.addEventListener("change", aktualisieren);
    return () => mq.removeEventListener("change", aktualisieren);
  }, []);
  return mobil;
}
