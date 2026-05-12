/**
 * Detail-Seite eines Imports — zeigt alle persistierten Protokoll-Zeilen
 * (fehlerhaft + übersprungen) mit CSV-Zeilennummer, Grund und Rohdaten.
 * Erlaubt nachträgliche Diagnose, auch nach Seitenwechsel/Refresh.
 *
 * Aufruf: ``/import/:id``  (id aus react-router-params)
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getImportDetail, ImportDetail as ImportDetailDaten } from "@/api/client";

export default function ImportDetail() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ImportDetailDaten | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getImportDetail(Number(id))
      .then(setDetail)
      .catch((e) =>
        toast.error("Importdetails konnten nicht geladen werden", {
          description: String(e),
        }),
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Import nicht gefunden.
          </CardContent>
        </Card>
      </div>
    );
  }

  const keineDetails = detail.fehler.length === 0 && detail.duplikat.length === 0;
  const aelterer = keineDetails && (detail.zeilen_fehlerhaft > 0 || detail.zeilen_uebersprungen > 0);

  return (
    <div className="space-y-6">
      <BackLink />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            {detail.dateiname}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-y-1 text-sm md:grid-cols-2">
            <dt className="text-muted-foreground">Import-Datum</dt>
            <dd>{detail.import_datum}</dd>
            <dt className="text-muted-foreground">Datumsbereich</dt>
            <dd>{detail.datumsbereich ?? "—"}</dd>
            <dt className="text-muted-foreground">Importiert</dt>
            <dd>
              <Badge variant="success">{detail.zeilen_importiert}</Badge>
            </dd>
            <dt className="text-muted-foreground">Übersprungen (Duplikate)</dt>
            <dd>
              <Badge variant="warning">{detail.zeilen_uebersprungen}</Badge>
            </dd>
            <dt className="text-muted-foreground">Fehlerhaft</dt>
            <dd>
              <Badge variant="destructive">{detail.zeilen_fehlerhaft}</Badge>
            </dd>
          </dl>
        </CardContent>
      </Card>

      {aelterer && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <AlertTriangle className="mb-2 inline h-4 w-4 text-amber-500" />{" "}
            Dieser Import wurde mit einer älteren App-Version (vor v1.0.3)
            erstellt. Detail-Daten pro Zeile stehen erst für neue Importe zur
            Verfügung — die Zähler oben sind weiterhin korrekt.
          </CardContent>
        </Card>
      )}

      {!keineDetails && (
        <Tabs defaultValue={detail.fehler.length > 0 ? "fehler" : "duplikat"}>
          <TabsList>
            <TabsTrigger value="fehler">
              Fehlerhaft ({detail.fehler.length})
            </TabsTrigger>
            <TabsTrigger value="duplikat">
              Übersprungen ({detail.duplikat.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fehler">
            <ProtokollTabelle
              zeilen={detail.fehler}
              leerHinweis="Keine fehlerhaften Zeilen 🎉"
            />
          </TabsContent>

          <TabsContent value="duplikat">
            <ProtokollTabelle
              zeilen={detail.duplikat}
              leerHinweis="Keine Duplikate."
            />
          </TabsContent>
        </Tabs>
      )}

      {detail.zeilen_fehlerhaft === 0 && detail.zeilen_uebersprungen === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Dieser Import lief vollständig fehlerfrei — alle{" "}
            {detail.zeilen_importiert} Zeilen wurden importiert.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/import"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Zur Importhistorie
    </Link>
  );
}

function ProtokollTabelle({
  zeilen,
  leerHinweis,
}: {
  zeilen: { csv_zeile: number; grund: string; rohdaten: string }[];
  leerHinweis: string;
}) {
  if (zeilen.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {leerHinweis}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">CSV-Zeile</TableHead>
                <TableHead className="w-1/3">Grund</TableHead>
                <TableHead>Rohdaten</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zeilen.map((z) => (
                <TableRow key={z.csv_zeile}>
                  <TableCell className="font-mono">{z.csv_zeile}</TableCell>
                  <TableCell className="text-sm">{z.grund}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {z.rohdaten}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
