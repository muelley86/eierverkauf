import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { PageHeader, Panel } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArtikelEierKonfig,
  getArtikelEierKonfig,
  putArtikelEierKonfig,
} from "@/api/client";

interface ZeilenHinweis {
  einheit_text: string;
  hinweis?: string;
}

// Klar lesbarer Hinweistext je Artikel-Code, was der Faktor bedeutet.
const HINWEISE: Record<string, ZeilenHinweis> = {
  "10er Kvp":         { einheit_text: "Eier pro Pack" },
  "6er Kvp":          { einheit_text: "Eier pro Pack" },
  "Lose 180":         { einheit_text: "Eier pro Stück" },
  "Lose 20":          { einheit_text: "Eier pro Stück" },
  "Lose unsortiert":  { einheit_text: "Eier pro Stück" },
  "Gewicht (kg)":     { einheit_text: "Eier pro kg", hinweis: "Leer lassen, wenn keine Stückzahl bekannt." },
  "Sonstige":         { einheit_text: "Eier pro Stück" },
};

export default function Konfiguration() {
  const [daten, setDaten] = useState<ArtikelEierKonfig[]>([]);
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    setLoading(true);
    getArtikelEierKonfig()
      .then((d) => {
        if (abgebrochen) return;
        setDaten(d);
        const initial: Record<string, string> = {};
        for (const eintrag of d) {
          initial[eintrag.artikel_code] =
            eintrag.faktor === null ? "" : String(eintrag.faktor);
        }
        setWerte(initial);
      })
      .catch((e) =>
        toast.error("Konfiguration konnte nicht geladen werden", {
          description: String(e),
        }),
      )
      .finally(() => {
        if (!abgebrochen) setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  const hatAenderung = useMemo(() => {
    return daten.some((eintrag) => {
      const aktuell = werte[eintrag.artikel_code] ?? "";
      const original = eintrag.faktor === null ? "" : String(eintrag.faktor);
      return aktuell.trim() !== original;
    });
  }, [daten, werte]);

  function setWert(artikel_code: string, value: string) {
    setWerte((prev) => ({ ...prev, [artikel_code]: value }));
  }

  async function handleSpeichern() {
    // Leeres Feld → faktor=null. Ungültige Eingabe (negative Zahl, Text) → Toast + Abbruch.
    const payload: ArtikelEierKonfig[] = [];
    for (const eintrag of daten) {
      const raw = (werte[eintrag.artikel_code] ?? "").trim();
      if (raw === "") {
        payload.push({ artikel_code: eintrag.artikel_code, faktor: null });
        continue;
      }
      const num = Number.parseInt(raw, 10);
      if (Number.isNaN(num) || num < 0) {
        toast.error(`Ungültiger Wert für „${eintrag.artikel_code}"`, {
          description: "Bitte eine ganze Zahl ≥ 0 eingeben oder leer lassen.",
        });
        return;
      }
      payload.push({ artikel_code: eintrag.artikel_code, faktor: num });
    }
    setSpeichert(true);
    try {
      const antwort = await putArtikelEierKonfig(payload);
      toast.success("Konfiguration gespeichert", {
        description: `${antwort.neu_berechnete_belege.toLocaleString("de-DE")} Belege neu berechnet.`,
      });
      // Lokalen Daten-Snapshot aktualisieren, damit hatAenderung wieder false ist.
      setDaten(payload);
    } catch (e) {
      toast.error("Speichern fehlgeschlagen", { description: String(e) });
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <div className="space-y-8 max-w-[1400px]">
      <PageHeader
        eyebrow="System"
        title="Eier-Konfiguration"
        subtitle="Faktoren für die Eier-Berechnung pro Artikel-Code."
        withZeitraumFilter={false}
      />

      <Panel eyebrow="Faktoren" title="Eier pro Einheit">
        <div className="mb-6 flex items-start gap-3 rounded-md border border-yolk/40 bg-yolk/10 p-4 text-sm text-ink">
          <Info className="h-5 w-5 shrink-0 text-yolk mt-0.5" aria-hidden="true" />
          <p>
            Änderungen wirken <strong>sofort auf alle bisher importierten Belege</strong>.
            Dashboard und Auswertungen werden automatisch mit den neuen Faktoren neu berechnet.
          </p>
        </div>

        {loading ? (
          <Skeleton className="h-80" />
        ) : (
          <div className="space-y-3">
            {daten.map((eintrag) => {
              const meta = HINWEISE[eintrag.artikel_code] ?? { einheit_text: "Eier pro Einheit" };
              return (
                <div
                  key={eintrag.artikel_code}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg border border-rule bg-white/40 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-base text-ink truncate">
                      {eintrag.artikel_code}
                    </div>
                    {meta.hinweis && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {meta.hinweis}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      value={werte[eintrag.artikel_code] ?? ""}
                      onChange={(e) => setWert(eintrag.artikel_code, e.target.value)}
                      placeholder="—"
                      className="h-11 w-24 font-mono tabular-nums text-right"
                      aria-label={`Faktor für ${eintrag.artikel_code}`}
                    />
                    <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      {meta.einheit_text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
          {hatAenderung && !speichert && (
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Ungespeicherte Änderungen
            </span>
          )}
          <Button
            onClick={handleSpeichern}
            disabled={loading || speichert || !hatAenderung}
            className="h-11 min-w-[160px]"
          >
            {speichert ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
