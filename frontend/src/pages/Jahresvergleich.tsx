import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Panel } from "@/components/PageHeader";
import {
  ExportKnoepfe,
  VergleichsDiagramm,
  VergleichsLegende,
  VergleichsTabelle,
} from "@/components/VergleichsAnsicht";
import { exportExcelUrl, exportPdfUrl, getJahresvergleich, JahresvergleichZeile } from "@/api/client";
import { zeilenAusJahresvergleich } from "@/lib/vergleich";

const ANZAHL_JAHRE_AUSWAHL = 6;

export default function Jahresvergleich() {
  const aktuellesJahr = new Date().getFullYear();
  const [jahr, setJahr] = useState<number>(aktuellesJahr);
  const [daten, setDaten] = useState<JahresvergleichZeile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ab = false;
    setLoading(true);
    getJahresvergleich(jahr)
      .then((d) => { if (!ab) setDaten(d); })
      .catch((e) => toast.error("Jahresvergleich konnte nicht geladen werden", { description: String(e) }))
      .finally(() => { if (!ab) setLoading(false); });
    return () => { ab = true; };
  }, [jahr]);

  const zeilen = useMemo(() => zeilenAusJahresvergleich(daten), [daten]);
  const jahrOptionen = Array.from({ length: ANZAHL_JAHRE_AUSWAHL }, (_, i) => aktuellesJahr - i);
  const beschriftung = { labelAktuell: String(jahr), labelVorjahr: String(jahr - 1) };

  return (
    <div className="max-w-[1400px] space-y-4 md:space-y-6">
      <PageHeader
        title="Jahresvergleich"
        subtitle="Ganzes Kalenderjahr im Vergleich zum Vorjahr, Monat für Monat."
        withZeitraumFilter={false}
      />

      <Panel
        title={<>{jahr} vs. {jahr - 1}</>}
        actions={
          <div className="flex items-center gap-3">
            <VergleichsLegende {...beschriftung} />
            <Select
              value={String(jahr)}
              onChange={(e) => setJahr(Number(e.target.value))}
              className="h-8 w-24 border-rule text-xs tabular-nums"
              aria-label="Jahr wählen"
            >
              {jahrOptionen.map((j) => <option key={j} value={j}>{j}</option>)}
            </Select>
            <ExportKnoepfe
              excelHref={exportExcelUrl({ typ: "jahresvergleich", jahr })}
              pdfHref={exportPdfUrl({ typ: "jahresvergleich", jahr })}
            />
          </div>
        }
      >
        {loading ? <Skeleton className="h-[260px] sm:h-[360px]" /> : <VergleichsDiagramm zeilen={zeilen} {...beschriftung} />}
      </Panel>

      <Panel>
        {loading ? <Skeleton className="h-72" /> : (
          <VergleichsTabelle zeilen={zeilen} ersteSpalte="Monat" {...beschriftung} />
        )}
      </Panel>
    </div>
  );
}
