import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getKundenAuswahl, KundeOption } from "@/api/client";
import { useKundenFilter } from "@/context/KundenFilterContext";
import { filtereKunden, kundenFilterLabel, MAX_KUNDEN, umschalten } from "@/lib/kundenfilter";
import { cn } from "@/lib/utils";

// SQLite sortiert Umlaute nicht deutsch („Bäckerei“ nach „Brotjanker“).
const DEUTSCH = new Intl.Collator("de-DE", { sensitivity: "base" });

/** Lädt die Auswahlliste einmal je Seitenaufruf (nach Importen sofort aktuell). */
function useKundenListe(): { liste: KundeOption[]; laedt: boolean } {
  const [liste, setListe] = useState<KundeOption[]>([]);
  const [laedt, setLaedt] = useState(true);
  useEffect(() => {
    let ab = false;
    getKundenAuswahl()
      .then((d) => { if (!ab) setListe([...d].sort((x, y) => DEUTSCH.compare(x.kundenname, y.kundenname))); })
      .catch((e) => toast.error("Kundenliste für den Filter konnte nicht geladen werden", { description: String(e) }))
      .finally(() => { if (!ab) setLaedt(false); });
    return () => { ab = true; };
  }, []);
  return { liste, laedt };
}

/** Beim Öffnen gewählte Kunden zuerst, damit die Auswahl ohne Scrollen sichtbar ist. */
function sortiert(liste: KundeOption[], gewaehlt: string[]): KundeOption[] {
  const istGewaehlt = new Set(gewaehlt);
  return [
    ...liste.filter((k) => istGewaehlt.has(k.kundennummer)),
    ...liste.filter((k) => !istGewaehlt.has(k.kundennummer)),
  ];
}

function KundenZeile({ kunde, aktiv, onToggle }: { kunde: KundeOption; aktiv: boolean; onToggle: () => void }) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={aktiv}
        onClick={onToggle}
        className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-left transition hover:bg-brand/15"
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
            aktiv ? "border-brand bg-brand text-brand-foreground" : "border-rule bg-surface",
          )}
          aria-hidden="true"
        >
          {aktiv && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1 py-1.5" title={kunde.kundenname}>
          {/* Zwei Zeilen: bei Filialen steht das Unterscheidende am Ende („… Filiale 2154/GLN …"). */}
          <span className="line-clamp-2 break-words text-sm leading-snug text-ink">{kunde.kundenname}</span>
          <span className="block text-xs tabular-nums text-muted-foreground">{kunde.kundennummer}</span>
        </span>
      </button>
    </li>
  );
}

/** Pille „Kunden" mit Mehrfachauswahl — sitzt im Seitenkopf neben dem Zeitraum. */
export function KundenFilter({ className }: { className?: string }) {
  const { kunden, setKunden, zuruecksetzen } = useKundenFilter();
  const { liste, laedt } = useKundenListe();
  const [suche, setSuche] = useState("");
  // Sortierbasis nur beim Öffnen festhalten — sonst springt eine Zeile beim Anklicken nach oben.
  const [oben, setOben] = useState<string[]>(kunden);
  const aktiv = kunden.length > 0;

  const sichtbar = useMemo(
    () => filtereKunden(sortiert(liste, oben), suche),
    [liste, oben, suche],
  );

  const toggle = (nr: string) => {
    const neu = umschalten(kunden, nr);
    if (neu.length > MAX_KUNDEN) {
      toast.error(`Höchstens ${MAX_KUNDEN} Kunden gleichzeitig wählbar.`);
      return;
    }
    setKunden(neu);
  };

  return (
    <Popover onOpenChange={(offen) => (offen ? setOben(kunden) : setSuche(""))}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-11 min-w-0 max-w-full gap-2 rounded-full px-3 text-ink sm:max-w-[20rem] sm:px-4",
            aktiv ? "border-brand bg-brand/20 hover:bg-brand/30" : "border-rule bg-surface hover:bg-brand/20",
            className,
          )}
          aria-label={`Kundenfilter: ${kundenFilterLabel(kunden, liste)}`}
          title={kundenFilterLabel(kunden, liste)}
        >
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate text-sm leading-none">{kundenFilterLabel(kunden, liste)}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(26rem,calc(100vw-2rem))] space-y-3 border-rule bg-surface p-3" align="end">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Name oder Kundennummer suchen…"
            className="pl-9"
            aria-label="Kunden suchen"
          />
        </div>

        <div className="flex min-h-[28px] items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <span>{aktiv ? `${kunden.length} gewählt` : "Keine Auswahl: alle Kunden"}</span>
          {aktiv && (
            <button
              type="button"
              onClick={zuruecksetzen}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-ink transition hover:bg-brand/15"
            >
              <X className="h-3.5 w-3.5" /> Auswahl aufheben
            </button>
          )}
        </div>

        <ul className="max-h-[min(20rem,50dvh)] space-y-0.5 overflow-y-auto overscroll-contain" aria-label="Kunden">
          {laedt && <li className="px-2 py-3 text-sm text-muted-foreground">Kunden werden geladen…</li>}
          {!laedt && sichtbar.length === 0 && (
            <li className="px-2 py-3 text-sm text-muted-foreground">
              {liste.length === 0 ? "Noch keine Kunden importiert." : "Kein Kunde passt zur Suche."}
            </li>
          )}
          {sichtbar.map((k) => (
            <KundenZeile
              key={k.kundennummer}
              kunde={k}
              aktiv={kunden.includes(k.kundennummer)}
              onToggle={() => toggle(k.kundennummer)}
            />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
