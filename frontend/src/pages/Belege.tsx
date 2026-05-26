import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/DataTable";
import { PageHeader, Panel } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useZeitraum } from "@/context/ZeitraumContext";
import {
  BelegeZeile,
  BelegPosition,
  exportExcelUrl,
  getBelege,
  getBelegPositionen,
} from "@/api/client";
import { formatDatum, formatEuro, formatZahl } from "@/lib/formatierung";

function einheitLabel(einheit: string | null, packCode: number | null): string {
  if (!einheit) return "—";
  const e = einheit.toUpperCase();
  if (e === "PACK" && packCode === 110) return "PACK (10er)";
  if (e === "PACK" && packCode === 111) return "PACK (6er)";
  return einheit;
}

export default function Belege() {
  const { von, bis } = useZeitraum();
  const [daten, setDaten] = useState<BelegeZeile[]>([]);
  const [loading, setLoading] = useState(true);
  const [ausgewaehlt, setAusgewaehlt] = useState<BelegeZeile | null>(null);
  const [positionen, setPositionen] = useState<BelegPosition[]>([]);
  const [positionenLaden, setPositionenLaden] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    setLoading(true);
    getBelege({ von, bis })
      .then((d) => {
        if (!abgebrochen) setDaten(d);
      })
      .catch((e) =>
        toast.error("Belege konnten nicht geladen werden", { description: String(e) }),
      )
      .finally(() => {
        if (!abgebrochen) setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [von, bis]);

  useEffect(() => {
    if (!ausgewaehlt) {
      setPositionen([]);
      return;
    }
    let abgebrochen = false;
    setPositionenLaden(true);
    getBelegPositionen(ausgewaehlt.rechnungsnummer, ausgewaehlt.rechnungsdatum)
      .then((p) => {
        if (!abgebrochen) setPositionen(p);
      })
      .catch((e) =>
        toast.error("Positionen konnten nicht geladen werden", { description: String(e) }),
      )
      .finally(() => {
        if (!abgebrochen) setPositionenLaden(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [ausgewaehlt]);

  const columns = useMemo<ColumnDef<BelegeZeile>[]>(
    () => [
      {
        accessorKey: "rechnungsdatum",
        header: "Datum",
        meta: { mobilePriority: "secondary", mobileLabel: "Datum" },
        cell: (i) => (
          <span className="font-mono text-xs text-muted-foreground">
            {formatDatum(i.getValue<string>())}
          </span>
        ),
      },
      {
        accessorKey: "rechnungsnummer",
        header: "Beleg-Nr.",
        meta: { mobilePriority: "secondary", mobileLabel: "Beleg-Nr." },
        cell: (i) => (
          <span className="font-mono text-xs text-ink">{i.getValue<string>() ?? "—"}</span>
        ),
      },
      {
        accessorKey: "kundennummer",
        header: "Kunden-Nr.",
        meta: { mobilePriority: "secondary", mobileLabel: "Kd.-Nr." },
        cell: (i) => (
          <span className="font-mono text-xs text-muted-foreground">
            {i.getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "kundenname",
        header: "Kunde",
        meta: { mobilePriority: "primary" },
        cell: (i) => <span className="text-ink">{i.getValue<string>()}</span>,
      },
      {
        accessorKey: "positionen",
        header: "Pos.",
        sortingFn: "basic",
        meta: { mobilePriority: "secondary", mobileLabel: "Pos." },
        cell: (i) => (
          <span className="font-mono tabular-nums text-muted-foreground">
            {formatZahl(i.getValue<number>())}
          </span>
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
          <span className="font-mono tabular-nums text-sage">
            {formatEuro(i.getValue<number>())}
          </span>
        ),
      },
    ],
    [],
  );

  const exportUrl = exportExcelUrl({ typ: "belege", von, bis });

  return (
    <div className="space-y-8 max-w-[1400px]">
      <PageHeader
        eyebrow="Belege"
        title="Eiermengen je Beleg"
        subtitle={`${daten.length} Belege im gewählten Zeitraum. Klick auf eine Zeile zeigt die Einzelpositionen.`}
        exportHref={exportUrl}
      />
      <Panel eyebrow="Tabelle" title="Alle Belege">
        {loading ? (
          <Skeleton className="h-96" />
        ) : (
          <DataTable
            columns={columns}
            data={daten}
            filterPlatzhalter="Nach Beleg-Nr. oder Kunde filtern…"
            initialSorting={[{ id: "eier", desc: true }]}
            onRowClick={(z) => setAusgewaehlt(z)}
          />
        )}
      </Panel>

      <Dialog open={ausgewaehlt !== null} onOpenChange={(o) => !o && setAusgewaehlt(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="eyebrow">Beleg-Detail</div>
            <DialogTitle>
              {ausgewaehlt?.rechnungsnummer ?? "—"}{" "}
              <span className="text-muted-foreground font-mono text-base font-normal">
                · {formatDatum(ausgewaehlt?.rechnungsdatum)}
              </span>
            </DialogTitle>
            <DialogDescription>
              {ausgewaehlt?.kundenname}{" "}
              <span className="font-mono text-xs">
                ({ausgewaehlt?.kundennummer})
              </span>{" "}
              · {formatZahl(ausgewaehlt?.positionen ?? 0)} Positionen ·{" "}
              {formatZahl(ausgewaehlt?.eier ?? 0)} Eier ·{" "}
              {formatEuro(ausgewaehlt?.umsatz ?? 0)}
            </DialogDescription>
          </DialogHeader>

          {positionenLaden ? (
            <Skeleton className="h-64" />
          ) : positionen.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">Keine Positionen gefunden.</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-rule">
              <Table>
                <TableHeader>
                  <TableRow className="border-rule hover:bg-transparent">
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Artikel
                    </TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Beschreibung
                    </TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground text-right">
                      Menge
                    </TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Einheit
                    </TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground text-right">
                      Eier
                    </TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground text-right">
                      Preis
                    </TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground text-right">
                      Gesamt
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positionen.map((p, idx) => (
                    <TableRow key={idx} className="border-rule">
                      <TableCell className="text-sm text-ink">{p.artikel_code ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.beschreibung ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm font-mono tabular-nums text-right">
                        {formatZahl(p.menge, p.menge % 1 === 0 ? 0 : 2)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {einheitLabel(p.einheit, p.pack_code)}
                      </TableCell>
                      <TableCell className="text-sm font-mono tabular-nums text-right">
                        {p.eier_stueck === null ? "—" : formatZahl(p.eier_stueck)}
                      </TableCell>
                      <TableCell className="text-sm font-mono tabular-nums text-right text-muted-foreground">
                        {formatEuro(p.preis_einheit)}
                      </TableCell>
                      <TableCell className="text-sm font-mono tabular-nums text-right text-sage">
                        {formatEuro(p.gesamt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
