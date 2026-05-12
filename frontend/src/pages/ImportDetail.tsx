import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Panel } from "@/components/PageHeader";
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
      .catch((e) => toast.error("Importdetails konnten nicht geladen werden", { description: String(e) }))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-[1400px]">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-8 max-w-[1400px]">
        <PageHeader back={{ to: "/import", label: "Zur Importhistorie" }} eyebrow="Import" title="Nicht gefunden" />
        <Panel><p className="text-center text-muted-foreground py-6">Import nicht gefunden.</p></Panel>
      </div>
    );
  }

  const keineDetails = detail.fehler.length === 0 && detail.duplikat.length === 0;
  const aelterer = keineDetails && (detail.zeilen_fehlerhaft > 0 || detail.zeilen_uebersprungen > 0);

  return (
    <div className="space-y-8 max-w-[1400px]">
      <PageHeader
        back={{ to: "/import", label: "Zur Importhistorie" }}
        eyebrow="Import"
        title={<span className="font-mono text-2xl">{detail.dateiname}</span>}
      />

      <Panel eyebrow="Zusammenfassung" title="Kennzahlen">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-3 text-sm">
          <dt className="eyebrow self-center">Import-Datum</dt>
          <dd className="font-mono text-xs">{detail.import_datum}</dd>
          <dt className="eyebrow self-center">Datumsbereich</dt>
          <dd className="font-mono text-xs">{detail.datumsbereich ?? "—"}</dd>
          <dt className="eyebrow self-center">Importiert</dt>
          <dd><Badge variant="success">{detail.zeilen_importiert}</Badge></dd>
          <dt className="eyebrow self-center">Übersprungen</dt>
          <dd><Badge variant="warning">{detail.zeilen_uebersprungen}</Badge></dd>
          <dt className="eyebrow self-center">Fehlerhaft</dt>
          <dd><Badge variant="destructive">{detail.zeilen_fehlerhaft}</Badge></dd>
        </dl>
      </Panel>

      {aelterer && (
        <Panel>
          <p className="text-sm text-muted-foreground">
            <AlertTriangle className="mb-1 mr-1 inline h-4 w-4 text-yolk" />
            Dieser Import wurde mit einer älteren App-Version (vor v1.0.3) erstellt.
            Detail-Daten pro Zeile stehen erst für neue Importe zur Verfügung — die Zähler oben sind weiterhin korrekt.
          </p>
        </Panel>
      )}

      {!keineDetails && (
        <Tabs defaultValue={detail.fehler.length > 0 ? "fehler" : "duplikat"}>
          <TabsList className="bg-surface border border-rule">
            <TabsTrigger value="fehler">Fehlerhaft ({detail.fehler.length})</TabsTrigger>
            <TabsTrigger value="duplikat">Übersprungen ({detail.duplikat.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="fehler" className="mt-6">
            <ProtokollPanel zeilen={detail.fehler} title="Fehlerhafte Zeilen" leerHinweis="Keine fehlerhaften Zeilen 🎉" />
          </TabsContent>
          <TabsContent value="duplikat" className="mt-6">
            <ProtokollPanel zeilen={detail.duplikat} title="Übersprungene Zeilen" leerHinweis="Keine Duplikate." />
          </TabsContent>
        </Tabs>
      )}

      {detail.zeilen_fehlerhaft === 0 && detail.zeilen_uebersprungen === 0 && (
        <Panel>
          <p className="text-center text-sm text-muted-foreground py-6">
            <FileSpreadsheet className="mb-1 inline h-4 w-4 text-sage mr-1" />
            Vollständig fehlerfrei — alle {detail.zeilen_importiert} Zeilen importiert.
          </p>
        </Panel>
      )}
    </div>
  );
}

function ProtokollPanel({
  zeilen, title, leerHinweis,
}: {
  zeilen: { csv_zeile: number; grund: string; rohdaten: string }[];
  title: string;
  leerHinweis: string;
}) {
  if (zeilen.length === 0) {
    return <Panel><p className="text-center text-sm text-muted-foreground py-6">{leerHinweis}</p></Panel>;
  }
  return (
    <Panel eyebrow="Tabelle" title={title}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-rule">
              <TableHead className="w-24 font-mono text-[10px] uppercase tracking-[0.12em]">CSV-Zeile</TableHead>
              <TableHead className="w-1/3 font-mono text-[10px] uppercase tracking-[0.12em]">Grund</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Rohdaten</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zeilen.map((z) => (
              <TableRow key={z.csv_zeile} className="border-rule">
                <TableCell className="font-mono tabular-nums">{z.csv_zeile}</TableCell>
                <TableCell className="text-sm">{z.grund}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{z.rohdaten}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
