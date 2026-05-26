import { ChevronDown } from "lucide-react";
import { useZeitraum } from "@/context/ZeitraumContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDatum } from "@/lib/formatierung";
import { cn } from "@/lib/utils";

/** Liefert das aktuelle ISO-Datum (Tag-genau, lokale Zeitzone). */
function isoHeute(): string {
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth(), h.getDate()).toISOString().slice(0, 10);
}

/** Heuristik: erkennt eine der Quick-Ranges am aktuellen (von,bis)-Paar. */
function aktuelleRange(von: string, bis: string): string {
  const heute = isoHeute();
  const h = new Date();
  const jahr = h.getFullYear();
  const monatStart = new Date(jahr, h.getMonth(), 1).toISOString().slice(0, 10);
  const qStart = new Date(jahr, Math.floor(h.getMonth() / 3) * 3, 1)
    .toISOString()
    .slice(0, 10);
  const jahrStart = new Date(jahr, 0, 1).toISOString().slice(0, 10);
  const letztesJahrStart = new Date(jahr - 1, 0, 1).toISOString().slice(0, 10);
  const letztesJahrEnde = new Date(jahr - 1, 11, 31).toISOString().slice(0, 10);

  if (von === monatStart && bis === heute) return "Dieser Monat";
  if (von === qStart && bis === heute) return "Dieses Quartal";
  if (von === jahrStart && bis === heute) return "Dieses Jahr";
  if (von === letztesJahrStart && bis === letztesJahrEnde) return "Letztes Jahr";
  return "Eigener Zeitraum";
}

export function ZeitraumFilter({ className }: { className?: string }) {
  const z = useZeitraum();
  const rangeLabel = aktuelleRange(z.von, z.bis);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-11 gap-2 sm:gap-3 rounded-full border-rule bg-surface px-3 sm:px-4 text-ink hover:bg-yolk/10",
            className,
          )}
        >
          <span className="h-2 w-2 rounded-full bg-yolk" aria-hidden="true" />
          <span className="font-display text-sm sm:text-base leading-none">{rangeLabel}</span>
          <span className="hidden sm:inline font-mono text-xs text-muted-foreground tabular-nums">
            {formatDatum(z.von)} – {formatDatum(z.bis)}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3 border-rule bg-surface" align="end">
        <div className="space-y-2">
          <Label htmlFor="zr-von" className="eyebrow">Von</Label>
          <Input
            id="zr-von"
            type="date"
            value={z.von}
            onChange={(e) => z.setVon(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zr-bis" className="eyebrow">Bis</Label>
          <Input
            id="zr-bis"
            type="date"
            value={z.bis}
            onChange={(e) => z.setBis(e.target.value)}
          />
        </div>
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
