import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useZeitraum } from "@/context/ZeitraumContext";
import { getKunden, KundenZeile } from "@/api/client";
import { formatDatum, formatEuro, formatZahl } from "@/lib/formatierung";

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
      { accessorKey: "kundennummer", header: "Kundennr.", cell: (i) => i.getValue<string>() },
      { accessorKey: "kundenname", header: "Name" },
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
      {
        accessorKey: "letzter_kauf",
        header: "Letzter Kauf",
        cell: (i) => formatDatum(i.getValue<string | null>()),
      },
    ],
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kundenübersicht</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
