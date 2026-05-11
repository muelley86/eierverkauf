import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useZeitraum } from "@/context/ZeitraumContext";
import { ArtikelZeile, getArtikel } from "@/api/client";
import { formatEuro, formatZahl } from "@/lib/formatierung";

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
      { accessorKey: "artikel_code", header: "Artikel" },
      {
        accessorKey: "menge",
        header: "Menge",
        cell: (i) => <span className="tabular-nums">{formatZahl(i.getValue<number>(), 2)}</span>,
      },
      {
        accessorKey: "eier",
        header: "Eier",
        cell: (i) => <span className="tabular-nums">{formatZahl(i.getValue<number>())}</span>,
      },
      {
        accessorKey: "umsatz",
        header: "Umsatz",
        cell: (i) => <span className="tabular-nums">{formatEuro(i.getValue<number>())}</span>,
      },
      {
        accessorKey: "positionen",
        header: "Positionen",
        cell: (i) => <span className="tabular-nums">{formatZahl(i.getValue<number>())}</span>,
      },
    ],
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Artikelübersicht</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
