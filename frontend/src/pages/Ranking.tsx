import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/DataTable";
import { useZeitraum } from "@/context/ZeitraumContext";
import { getRanking, RankingZeile } from "@/api/client";
import { formatEuro, formatZahl } from "@/lib/formatierung";

const FARBE_EIER = "#2563eb";
const FARBE_UMSATZ = "#16a34a";

type SortMode = "menge" | "umsatz";

export default function Ranking() {
  const { von, bis } = useZeitraum();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortMode>("menge");
  const [daten, setDaten] = useState<RankingZeile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    setLoading(true);
    getRanking({ von, bis }, sort)
      .then((d) => {
        if (!abgebrochen) setDaten(d);
      })
      .catch((e) => toast.error("Ranking konnte nicht geladen werden", { description: String(e) }))
      .finally(() => {
        if (!abgebrochen) setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [von, bis, sort]);

  const top10 = useMemo(() => daten.slice(0, 10), [daten]);
  const dataKey = sort === "menge" ? "eier" : "umsatz";
  const farbe = sort === "menge" ? FARBE_EIER : FARBE_UMSATZ;

  const columns = useMemo<ColumnDef<RankingZeile>[]>(
    () => [
      {
        id: "rang",
        header: "Rang",
        cell: (i) => <span className="text-muted-foreground">{i.row.index + 1}</span>,
      },
      { accessorKey: "kundennummer", header: "Kundennr." },
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
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Top 10 Kunden — {sort === "menge" ? "Eier" : "Umsatz"}</CardTitle>
            <Tabs value={sort} onValueChange={(v) => setSort(v as SortMode)}>
              <TabsList>
                <TabsTrigger value="menge">Nach Menge</TabsTrigger>
                <TabsTrigger value="umsatz">Nach Umsatz</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[450px]" />
          ) : (
            <ResponsiveContainer width="100%" height={450}>
              <BarChart
                data={top10}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v: number) => formatZahl(v)} />
                <YAxis dataKey="kundenname" type="category" width={150} />
                <Tooltip
                  formatter={(v: number) =>
                    sort === "menge" ? formatZahl(v) : formatEuro(v)
                  }
                />
                <Bar
                  dataKey={dataKey}
                  fill={farbe}
                  cursor="pointer"
                  onClick={(d: RankingZeile) =>
                    navigate(`/kunden/${encodeURIComponent(d.kundennummer)}`)
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vollständige Rangliste</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-96" />
          ) : (
            <DataTable
              columns={columns}
              data={daten}
              filterPlatzhalter="Kunde filtern…"
              onRowClick={(z) => navigate(`/kunden/${encodeURIComponent(z.kundennummer)}`)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
