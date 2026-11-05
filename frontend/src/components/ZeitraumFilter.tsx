import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useZeitraum } from "@/context/ZeitraumContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDatum } from "@/lib/formatierung";
import { isoDatumLokal, pruefeZeitraum } from "@/lib/datum";
import { cn } from "@/lib/utils";

/** Liefert das aktuelle ISO-Datum (Tag-genau, lokale Zeitzone). */
function isoHeute(): string {
  const h = new Date();
  return isoDatumLokal(h);
}

/** Heuristik: erkennt eine der Quick-Ranges am aktuellen (von,bis)-Paar. */
function aktuelleRange(von: string, bis: string): string {
  const heute = isoHeute();
  const h = new Date();
  const jahr = h.getFullYear();
  const monatStart = isoDatumLokal(new Date(jahr, h.getMonth(), 1));
  const qStart = isoDatumLokal(new Date(jahr, Math.floor(h.getMonth() / 3) * 3, 1));
  const jahrStart = isoDatumLokal(new Date(jahr, 0, 1));
  const letztesJahrStart = isoDatumLokal(new Date(jahr - 1, 0, 1));
  const letztesJahrEnde = isoDatumLokal(new Date(jahr - 1, 11, 31));

  if (von === monatStart && bis === heute) return "Dieser Monat";
  if (von === qStart && bis === heute) return "Dieses Quartal";
  if (von === jahrStart && bis === heute) return "Dieses Jahr";
  if (von === letztesJahrStart && bis === letztesJahrEnde) return "Letztes Jahr";
  return "Eigener Zeitraum";
}

/**
 * Lokaler Entwurf der Datumsfelder: Eingaben werden erst global übernommen,
 * wenn sie einen gültigen Zeitraum ergeben (sonst Hinweis statt API-Fehler).
 * Ändert sich der Zeitraum von außen (Schnellwahl), wird der Entwurf ersetzt.
 */
function useZeitraumEntwurf(von: string, bis: string, setRange: (von: string, bis: string) => void) {
  const [entwurf, setEntwurf] = useState({ von, bis });
  useEffect(() => setEntwurf({ von, bis }), [von, bis]);
  const fehler = pruefeZeitraum(entwurf.von, entwurf.bis);

  const aendern = (neuVon: string, neuBis: string) => {
    setEntwurf({ von: neuVon, bis: neuBis });
    if (pruefeZeitraum(neuVon, neuBis) === null) setRange(neuVon, neuBis);
  };

  return { von: entwurf.von, bis: entwurf.bis, fehler, aendern };
}

export function ZeitraumFilter({ className }: { className?: string }) {
  const z = useZeitraum();
  const rangeLabel = aktuelleRange(z.von, z.bis);
  const entwurf = useZeitraumEntwurf(z.von, z.bis, z.setRange);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-11 gap-2 sm:gap-3 rounded-full border-rule bg-surface px-3 sm:px-4 text-ink hover:bg-brand/20",
            className,
          )}
        >
          <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
          <span className="text-sm leading-none">{rangeLabel}</span>
          <span className="hidden sm:inline tabular-nums text-xs text-muted-foreground">
            {formatDatum(z.von)} – {formatDatum(z.bis)}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] space-y-3 border-rule bg-surface" align="end">
        <div className="space-y-2">
          <Label htmlFor="zr-von" className="eyebrow">Von</Label>
          <Input
            id="zr-von"
            type="date"
            value={entwurf.von}
            onChange={(e) => entwurf.aendern(e.target.value, entwurf.bis)}
            aria-invalid={entwurf.fehler !== null}
            aria-describedby={entwurf.fehler ? "zr-fehler" : undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zr-bis" className="eyebrow">Bis</Label>
          <Input
            id="zr-bis"
            type="date"
            value={entwurf.bis}
            onChange={(e) => entwurf.aendern(entwurf.von, e.target.value)}
            aria-invalid={entwurf.fehler !== null}
            aria-describedby={entwurf.fehler ? "zr-fehler" : undefined}
          />
        </div>
        {entwurf.fehler && (
          <p id="zr-fehler" role="alert" className="text-xs text-negative">
            {entwurf.fehler}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button size="sm" variant="secondary" onClick={z.dieserMonat}>Dieser Monat</Button>
          <Button size="sm" variant="secondary" onClick={z.diesesQuartal}>Quartal</Button>
          <Button size="sm" variant="secondary" onClick={z.diesesJahr}>Dieses Jahr</Button>
          <Button size="sm" variant="secondary" onClick={z.letztesJahr}>Letztes Jahr</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
