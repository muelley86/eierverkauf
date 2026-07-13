import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/DataTable";
import { PageHeader, Panel } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useZeitraum } from "@/context/ZeitraumContext";
import { ArtikelZeile, getArtikel } from "@/api/client";
import { artikelLabel } from "@/lib/artikel";
import { formatCentJeEi, formatEuro, formatZahl } from "@/lib/formatierung";

export default function Artikel() {
  const { von, bis } = useZeitraum();
  const navigate = useNavigate();
  const [daten, setDaten] = useState<ArtikelZeile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    setLoading(true);
    getArtikel({ von, bis })
      .then((d) => {
        if (!abgebrochen) setDaten(d);
      })
      .catch((e) => toast.error("Artikelliste konnte nicht geladen werden", { description: String(e) }))
      .finally(() => {
        if (!abgebrochen) setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [von, bis]);

  const columns = useMemo<ColumnDef<ArtikelZeile>[]>(
    () => [
      {
        accessorKey: "artikel_code",
        header: "Artikel",
        meta: { mobilePriority: "primary" },
        cell: (i) => <span className="font-mono text-xs">{artikelLabel(i.getValue<string>())}</span>,
      },
      {
        accessorKey: "menge",
        header: "Menge",
        sortingFn: "basic",
        meta: { mobilePriority: "secondary", mobileLabel: "Menge" },
        cell: (i) => (
          <span className="font-mono tabular-nums">{formatZahl(i.getValue<number>(), 2)}</span>
        ),
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
    ],
    [],
  );

  return (
    <div className="space-y-8 max-w-[1400px]">
      <PageHeader
        eyebrow="Artikel"
        title="Was verkauft wurde"
        subtitle={`${daten.length} Artikel im gewählten Zeitraum.`}
      />
      <Panel eyebrow="Tabelle" title="Vollständige Liste">
        {loading ? (
          <Skeleton className="h-96" />
        ) : (
          <DataTable
            columns={columns}
            data={daten}
            filterPlatzhalter="Artikel filtern…"
            initialSorting={[{ id: "umsatz", desc: true }]}
            onRowClick={(z) => navigate(`/artikel/${encodeURIComponent(z.artikel_code)}`)}
          />
        )}
      </Panel>
    </div>
  );
}
