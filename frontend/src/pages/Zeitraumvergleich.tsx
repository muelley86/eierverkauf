import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Panel } from "@/components/PageHeader";
import {
  ExportKnoepfe,
  VergleichsDiagramm,
  VergleichsLegende,
  VergleichsTabelle,
} from "@/components/VergleichsAnsicht";
import { useZeitraum } from "@/context/ZeitraumContext";
import { exportExcelUrl, exportPdfUrl, getVerlauf, ZeitraumVerlauf } from "@/api/client";
import { formatDatum } from "@/lib/formatierung";
import { zeilenAusVerlauf } from "@/lib/vergleich";

// Vergleichsebene ist immer der Monat (wie beim Jahresvergleich); der erste
// und letzte Monat können angebrochen sein, wenn der Zeitraum mitten im Monat beginnt/endet.
const VERGLEICHSEBENE = "monat";

const BESCHRIFTUNG = { labelAktuell: "Zeitraum", labelVorjahr: "Vorjahr" };

function panelTitel(verlauf: ZeitraumVerlauf | null): string {
  const vj = verlauf?.vorjahreszeitraum;
  if (!vj) return "Zeitraum vs. Vorjahr";
  return `Vergleich mit ${formatDatum(vj.von)} – ${formatDatum(vj.bis)}`;
}

export default function Zeitraumvergleich() {
  const { von, bis } = useZeitraum();
  const [verlauf, setVerlauf] = useState<ZeitraumVerlauf | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ab = false;
    setLoading(true);
    getVerlauf({ von, bis }, VERGLEICHSEBENE)
      .then((v) => { if (!ab) setVerlauf(v); })
      .catch((e) => toast.error("Zeitraumvergleich konnte nicht geladen werden", { description: String(e) }))
      .finally(() => { if (!ab) setLoading(false); });
    return () => { ab = true; };
  }, [von, bis]);

  const zeilen = useMemo(() => (verlauf ? zeilenAusVerlauf(verlauf) : []), [verlauf]);

  return (
    <div className="max-w-[1400px] space-y-4 md:space-y-6">
      <PageHeader
        title="Zeitraumvergleich"
        subtitle="Gewählter Zeitraum im Vergleich zum selben Zeitraum ein Jahr früher, Monat für Monat."
      />

      <Panel
        title={panelTitel(verlauf)}
        actions={
          <div className="flex items-center gap-3">
            <VergleichsLegende {...BESCHRIFTUNG} />
            <ExportKnoepfe
              excelHref={exportExcelUrl({ typ: "zeitraumvergleich", von, bis })}
              pdfHref={exportPdfUrl({ typ: "zeitraumvergleich", von, bis })}
            />
          </div>
        }
      >
        {loading ? <Skeleton className="h-[260px] sm:h-[360px]" /> : <VergleichsDiagramm zeilen={zeilen} {...BESCHRIFTUNG} />}
      </Panel>

      <Panel>
        {loading ? <Skeleton className="h-72" /> : (
          <VergleichsTabelle zeilen={zeilen} ersteSpalte="Monat" {...BESCHRIFTUNG} />
        )}
      </Panel>
    </div>
  );
}
