import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileRejection, useDropzone } from "react-dropzone";
import { AlertTriangle, FileSpreadsheet, Info, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/PageHeader";
import {
  deleteImport, getImportHistorie, ImportErgebnis, ImportProtokollEintrag,
  uploadImport, uploadVorschau, VorschauResponse,
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

  useEffect(() => { void ladeHistorie(); }, [ladeHistorie]);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setDatei(file);
    setProtokoll(null);
    setImportiert(false);
    setLoading(true);
    try {
      setVorschau(await uploadVorschau(file));
    } catch (e) {
      toast.error("Vorschau fehlgeschlagen", { description: String(e) });
      setVorschau(null);
    } finally { setLoading(false); }
  }, []);

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    const erste = rejections[0];
    if (!erste) return;
    toast.error("Datei abgelehnt", {
      description: `${erste.file.name}: ${erste.errors[0]?.message ?? "nicht akzeptiert."}`,
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
        toast.warning(`Keine Zeile importiert (${ergebnis.zeilen_fehlerhaft} fehlerhaft, ${ergebnis.zeilen_uebersprungen} Duplikate)`);
      } else {
        toast.success(
          `Import abgeschlossen: ${ergebnis.zeilen_importiert} Zeilen` +
            (ergebnis.zeilen_fehlerhaft > 0 ? ` — ${ergebnis.zeilen_fehlerhaft} fehlerhaft` : ""),
        );
      }
      await ladeHistorie();
    } catch (e) {
      toast.error("Import fehlgeschlagen", { description: String(e) });
    } finally { setLoading(false); }
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
    onDrop, onDropRejected,
    accept: {
      "text/csv": [".csv"],
      "text/plain": [".csv"],
      "application/vnd.ms-excel": [".csv"],
      "application/csv": [".csv"],
    },
    multiple: false,
  });

  return (
    <div className="space-y-8 max-w-[1400px]">
      <PageHeader
        eyebrow="Import"
        title="Neue CSV einlesen"
        subtitle="Semikolon-getrennt, UTF-8-BOM. Kopfzeile wird automatisch erkannt."
      />

      <Panel eyebrow="Upload" title="Datei wählen">
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition cursor-pointer ${
            isDragActive ? "border-yolk bg-yolk/5" : "border-rule hover:border-yolk/40 hover:bg-yolk/5"
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className={`h-10 w-10 mb-3 ${isDragActive ? "text-yolk" : "text-muted-foreground"}`} />
          <p className="font-display text-xl text-ink">
            {isDragActive ? "Loslassen zum Hochladen…" : "Datei hierher ziehen"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">oder klicken zum Auswählen</p>
        </div>
        {datei && (
          <div className="mt-5 flex items-center justify-between rounded-lg border border-rule bg-background/40 px-4 py-3">
            <div className="flex items-center gap-3 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-yolk" />
              <span className="font-mono">{datei.name}</span>
              <Badge variant="outline" className="border-rule font-mono text-[10px]">
                {(datei.size / 1024).toFixed(1)} KB
              </Badge>
            </div>
            <Button onClick={importieren} disabled={loading || importiert} className="bg-yolk text-ink hover:bg-yolk/90">
              {importiert ? "Importiert" : loading ? "Verarbeite…" : "Importieren"}
            </Button>
          </div>
        )}
      </Panel>

      {vorschau && (
        <Panel eyebrow="Vorschau" title={`Erste ${vorschau.anzahl} Zeilen`}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-rule">
                  {Object.keys(vorschau.zeilen[0] ?? {}).map((k) => (
                    <TableHead key={k} className="font-mono text-[10px] uppercase tracking-[0.12em]">{k}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vorschau.zeilen.map((zeile, idx) => (
                  <TableRow key={idx} className="border-rule">
                    {Object.keys(zeile).map((k) => (
                      <TableCell key={k} className="font-mono text-xs">{String(zeile[k] ?? "")}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}

      {protokoll && (
        <Panel eyebrow="Protokoll" title="Ergebnis">
          <div className="space-y-5">
            {protokoll.header_warnungen?.length > 0 && (
              <div className="rounded-lg border border-yolk/40 bg-yolk/10 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                  <Info className="h-4 w-4 text-yolk" />
                  Header-Warnungen
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground font-mono">
                  {protokoll.header_warnungen.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
            )}

            <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm">
              <dt className="eyebrow self-center">Datei</dt>
              <dd>
                <Link to={`/import/${protokoll.import_id}`} className="text-yolk hover:underline font-mono">
                  {protokoll.dateiname}
                </Link>
              </dd>
              <dt className="eyebrow self-center">Datumsbereich</dt>
              <dd className="font-mono text-xs">{protokoll.datumsbereich}</dd>
              <dt className="eyebrow self-center">Importiert</dt>
              <dd><Badge variant="success">{protokoll.zeilen_importiert}</Badge></dd>
              <dt className="eyebrow self-center">Übersprungen</dt>
              <dd><Badge variant="warning">{protokoll.zeilen_uebersprungen}</Badge></dd>
              <dt className="eyebrow self-center">Fehlerhaft</dt>
              <dd><Badge variant="destructive">{protokoll.zeilen_fehlerhaft}</Badge></dd>
            </dl>

            {protokoll.fehler_details.length > 0 && (
              <div className="rounded-lg border border-brick/30 bg-brick/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-brick">
                  <AlertTriangle className="h-4 w-4" />
                  Fehlerprotokoll
                  {protokoll.zeilen_fehlerhaft > protokoll.fehler_details.length && (
                    <span className="text-xs font-normal text-muted-foreground">
                      (erste {protokoll.fehler_details.length} von {protokoll.zeilen_fehlerhaft})
                    </span>
                  )}
                </div>
                <ul className="space-y-1 font-mono text-xs">
                  {protokoll.fehler_details.map((z, i) => <li key={i}>{z}</li>)}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      )}

      <Panel eyebrow="Historie" title="Frühere Importe">
        <Table>
          <TableHeader>
            <TableRow className="border-rule">
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Datum</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Datei</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Zeitraum</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Importiert</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Übersprungen</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em]">Fehlerhaft</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {historie.map((h) => (
              <TableRow key={h.id} className="border-rule">
                <TableCell className="font-mono text-xs">{h.import_datum}</TableCell>
                <TableCell>
                  <Link to={`/import/${h.id}`} className="text-yolk hover:underline font-mono">
                    {h.dateiname}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{h.datumsbereich ?? "—"}</TableCell>
                <TableCell className="font-mono tabular-nums">{h.zeilen_importiert}</TableCell>
                <TableCell className="font-mono tabular-nums text-muted-foreground">{h.zeilen_uebersprungen}</TableCell>
                <TableCell className={`font-mono tabular-nums ${h.zeilen_fehlerhaft > 0 ? "text-brick" : "text-muted-foreground"}`}>
                  {h.zeilen_fehlerhaft}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => loeschen(h.id)}>
                    <Trash2 className="h-4 w-4 text-brick" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {historie.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  Noch keine Importe.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
}
