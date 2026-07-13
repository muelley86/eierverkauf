import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/DataTable";
import { PageHeader, Panel } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useZeitraum } from "@/context/ZeitraumContext";
import { getKunden, KundenZeile } from "@/api/client";
import { formatCentJeEi, formatDatum, formatEuro, formatZahl } from "@/lib/formatierung";

export default function Kunden() {
  const { von, bis } = useZeitraum();
  const navigate = useNavigate();
  const [daten, setDaten] = useState<KundenZeile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    setLoading(true);
    getKunden({ von, bis })
      .then((d) => {
        if (!abgebrochen) setDaten(d);
      })
      .catch((e) => toast.error("Kundenliste konnte nicht geladen werden", { description: String(e) }))
      .finally(() => {
        if (!abgebrochen) setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [von, bis]);

  const columns = useMemo<ColumnDef<KundenZeile>[]>(
    () => [
      {
        accessorKey: "kundennummer",
        header: "Nr.",
        meta: { mobilePriority: "secondary", mobileLabel: "Nr." },
        cell: (i) => (
          <span className="font-mono text-xs text-muted-foreground">
            {i.getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "kundenname",
        header: "Name",
        meta: { mobilePriority: "primary" },
        cell: (i) => <span className="text-ink">{i.getValue<string>()}</span>,
      },
      {
        accessorKey: "eier",
        header: "Eier",
        sortingFn: "basic",
        meta: { mobilePriority: "secondary", mobileLabel: "Eier" },
        cell: (i) => (
          <span className="font-mono tabular-nums">{formatZahl(i.getValue<number>())}</span>
        ),
      },
      {
        accessorKey: "umsatz",
        header: "Umsatz",
        sortingFn: "basic",
        meta: { mobilePriority: "primary" },
        cell: (i) => (
          <span className="font-mono tabular-nums">{formatEuro(i.getValue<number>())}</span>
        ),
      },
      {
        id: "umsatz_pro_ei",
        accessorFn: (z) => (z.eier ? (z.eier_umsatz / z.eier) * 100 : null),
        header: "Umsatz/Ei",
        sortingFn: "basic",
        meta: { mobilePriority: "secondary", mobileLabel: "Umsatz/Ei" },
        cell: (i) => (
          <span className="font-mono tabular-nums">
            {formatCentJeEi(i.row.original.eier_umsatz, i.row.original.eier)}
          </span>
        ),
      },
      {
        accessorKey: "positionen",
        header: "Positionen",
        sortingFn: "basic",
        meta: { mobilePriority: "secondary", mobileLabel: "Pos." },
        cell: (i) => (
          <span className="font-mono tabular-nums text-muted-foreground">
            {formatZahl(i.getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "letzter_kauf",
        header: "Letzter Kauf",
        meta: { mobilePriority: "secondary", mobileLabel: "Letzter Kauf" },
        cell: (i) => (
          <span className="font-mono text-xs text-muted-foreground">
            {formatDatum(i.getValue<string | null>())}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-8 max-w-[1400px]">
      <PageHeader
        eyebrow="Kunden"
        title="Wer hat bestellt"
        subtitle={`${daten.length} Kunden im gewählten Zeitraum.`}
      />
      <Panel eyebrow="Tabelle" title="Vollständige Liste">
        {loading ? (
          <Skeleton className="h-96" />
        ) : (
          <DataTable
            columns={columns}
            data={daten}
            filterPlatzhalter="Nach Name filtern…"
            initialSorting={[{ id: "eier", desc: true }]}
            onRowClick={(z) => navigate(`/kunden/${encodeURIComponent(z.kundennummer)}`)}
          />
        )}
      </Panel>
    </div>
  );
}
