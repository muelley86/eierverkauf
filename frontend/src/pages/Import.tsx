import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileRejection, useDropzone } from "react-dropzone";
import { AlertTriangle, FileSpreadsheet, Info, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  deleteImport,
  getImportHistorie,
  ImportErgebnis,
  ImportProtokollEintrag,
  uploadImport,
  uploadVorschau,
  VorschauResponse,
} from "@/api/client";

export default function Import() {
  const [vorschau, setVorschau] = useState<VorschauResponse | null>(null);
  const [datei, setDatei] = useState<File | null>(null);
  const [protokoll, setProtokoll] = useState<ImportErgebnis | null>(null);
  const [historie, setHistorie] = useState<ImportProtokollEintrag[]>([]);
  const [importiert, setImportiert] = useState(false);
  const [loading, setLoading] = useState(false);

  const ladeHistorie = useCallback(async () => {
    try {
      setHistorie(await getImportHistorie());
    } catch (e) {
      toast.error("Importhistorie konnte nicht geladen werden", { description: String(e) });
    }
  }, []);

  useEffect(() => {
    void ladeHistorie();
  }, [ladeHistorie]);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setDatei(file);
    setProtokoll(null);
    setImportiert(false);
    setLoading(true);
    try {
      const v = await uploadVorschau(file);
      setVorschau(v);
    } catch (e) {
      toast.error("Vorschau fehlgeschlagen", { description: String(e) });
      setVorschau(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Windows liefert für .csv häufig MIME `application/vnd.ms-excel` (oder
  // gar nichts), nicht `text/csv`. Wir lehnen sonst stillschweigend ab.
  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    const erste = rejections[0];
    if (!erste) return;
    const grund = erste.errors[0]?.message ?? "Datei wurde nicht akzeptiert.";
    toast.error("Datei abgelehnt", {
      description: `${erste.file.name}: ${grund}`,
    });
  }, []);

  const importieren = async () => {
    if (!datei) return;
    setLoading(true);
    try {
      const ergebnis = await uploadImport(datei);
      setProtokoll(ergebnis);
      setImportiert(true);
      if (ergebnis.zeilen_importiert === 0) {
        toast.warning(
          `Keine Zeile importiert (${ergebnis.zeilen_fehlerhaft} fehlerhaft, ` +
          `${ergebnis.zeilen_uebersprungen} Duplikate)`,
        );
      } else {
        toast.success(
          `Import abgeschlossen: ${ergebnis.zeilen_importiert} Zeilen` +
          (ergebnis.zeilen_fehlerhaft > 0
            ? ` — ${ergebnis.zeilen_fehlerhaft} fehlerhaft`
            : ""),
        );
      }
      await ladeHistorie();
    } catch (e) {
      toast.error("Import fehlgeschlagen", { description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const loeschen = async (id: number) => {
    if (!confirm("Diesen Import inkl. aller Positionen wirklich löschen?")) return;
    try {
      await deleteImport(id);
      toast.success("Import gelöscht");
      await ladeHistorie();
    } catch (e) {
      toast.error("Löschen fehlgeschlagen", { description: String(e) });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    // Mehrere MIME-Varianten + Extension-Fallback. Windows liefert für
    // .csv-Dateien teilweise `application/vnd.ms-excel`, manche Browser
    // gar keinen MIME-Type.
    accept: {
      "text/csv": [".csv"],
      "text/plain": [".csv"],
      "application/vnd.ms-excel": [".csv"],
      "application/csv": [".csv"],
    },
    multiple: false,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CSV-Datei importieren</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition ${
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30"
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm">
              {isDragActive
                ? "CSV hier loslassen…"
                : "CSV-Datei hierher ziehen oder klicken zum Auswählen"}
            </p>
            <p className="text-xs text-muted-foreground">
              Semikolon-getrennt, UTF-8-BOM. Kopfzeile wird automatisch erkannt.
            </p>
          </div>
          {datei && (
            <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                {datei.name} <Badge variant="outline">{(datei.size / 1024).toFixed(1)} KB</Badge>
              </div>
              <Button onClick={importieren} disabled={loading || importiert}>
                {importiert ? "Importiert" : loading ? "Verarbeite…" : "Importieren"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {vorschau && (
        <Card>
          <CardHeader>
            <CardTitle>Vorschau (erste {vorschau.anzahl} Zeilen)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(vorschau.zeilen[0] ?? {}).map((k) => (
                      <TableHead key={k}>{k}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vorschau.zeilen.map((zeile, idx) => (
                    <TableRow key={idx}>
                      {Object.keys(zeile).map((k) => (
                        <TableCell key={k}>{String(zeile[k] ?? "")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {protokoll && (
        <Card>
          <CardHeader>
            <CardTitle>Importprotokoll</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {protokoll.header_warnungen?.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-50 p-3 dark:bg-amber-950/30">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <Info className="h-4 w-4" />
                  Header-Warnungen
                </div>
                <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
                  {protokoll.header_warnungen.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Datei</dt>
              <dd>
                <Link
                  to={`/import/${protokoll.import_id}`}
                  className="text-blue-600 underline-offset-2 hover:underline"
                >
                  {protokoll.dateiname}
                </Link>
              </dd>
              <dt className="text-muted-foreground">Datumsbereich</dt>
              <dd>{protokoll.datumsbereich}</dd>
              <dt className="text-muted-foreground">Importiert</dt>
              <dd>
                <Badge variant="success">{protokoll.zeilen_importiert}</Badge>
              </dd>
              <dt className="text-muted-foreground">Übersprungen (Duplikate)</dt>
              <dd>
                <Badge variant="warning">{protokoll.zeilen_uebersprungen}</Badge>
              </dd>
              <dt className="text-muted-foreground">Fehlerhaft</dt>
              <dd>
                <Badge variant="destructive">{protokoll.zeilen_fehlerhaft}</Badge>
              </dd>
            </dl>

            {protokoll.fehler_details.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Fehlerprotokoll
                  {protokoll.zeilen_fehlerhaft > protokoll.fehler_details.length && (
                    <span className="text-xs font-normal text-muted-foreground">
                      (erste {protokoll.fehler_details.length} von {protokoll.zeilen_fehlerhaft})
                    </span>
                  )}
                </div>
                <ul className="space-y-1 font-mono text-xs">
                  {protokoll.fehler_details.map((zeile, idx) => (
                    <li key={idx}>{zeile}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Importhistorie</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Datei</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Importiert</TableHead>
                <TableHead>Übersprungen</TableHead>
                <TableHead>Fehlerhaft</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {historie.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{h.import_datum}</TableCell>
                  <TableCell>
                    <Link
                      to={`/import/${h.id}`}
                      className="text-blue-600 underline-offset-2 hover:underline"
                    >
                      {h.dateiname}
                    </Link>
                  </TableCell>
                  <TableCell>{h.datumsbereich ?? "—"}</TableCell>
                  <TableCell>{h.zeilen_importiert}</TableCell>
                  <TableCell>{h.zeilen_uebersprungen}</TableCell>
                  <TableCell>{h.zeilen_fehlerhaft}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => loeschen(h.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {historie.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Noch keine Importe.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
