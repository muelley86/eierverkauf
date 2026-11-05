import { useEffect, useState } from "react";
import { getHealth } from "@/api/client";
import { cn } from "@/lib/utils";

/**
 * Laufende Server-Version (aus `/api/health`) als dezente Zeile. Farbe und
 * Abstand über `className` (Anthrazit-Sidebar vs. helles „Mehr"-Menü).
 * Ohne Antwort bleibt die Zeile leer — die App läuft weiter.
 */
export function AppVersion({ className }: { className?: string }) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let aktiv = true;
    getHealth()
      .then((h) => {
        if (aktiv) setVersion(h.version);
      })
      .catch((err: unknown) => {
        console.warn("Version konnte nicht geladen werden", err);
      });
    return () => {
      aktiv = false;
    };
  }, []);

  if (!version) return null;
  return (
    <p className={cn("text-xs tabular-nums", className)}>Version {version}</p>
  );
}
