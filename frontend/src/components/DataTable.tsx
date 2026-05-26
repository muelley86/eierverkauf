import { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Spalten-Metadaten zur Steuerung der Mobile-Card-Ansicht. Optional —
 * unkonfigurierte Spalten greifen auf eine Heuristik (Index-basiert) zurück.
 */
export interface MobileColumnMeta {
  /** Label-Text in der Mobile-Card (Default: Spalten-Header) */
  mobileLabel?: string;
  /**
   * Sichtbarkeit in der Card:
   *  - "primary": gross dargestellt (Titel oben / Wert rechts oben)
   *  - "secondary": als Label/Wert-Paar im Card-Body
   *  - "hidden": auf Mobile ausblenden
   */
  mobilePriority?: "primary" | "secondary" | "hidden";
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  filterPlatzhalter?: string;
  filterColumnId?: string;
  onRowClick?: (row: TData) => void;
  initialSorting?: SortingState;
  pageSize?: number;
}

export function DataTable<TData>({
  columns,
  data,
  filterPlatzhalter,
  filterColumnId,
  onRowClick,
  initialSorting,
  pageSize = 20,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className="space-y-4">
      {filterPlatzhalter && (
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={filterPlatzhalter}
            value={
              filterColumnId
                ? ((table.getColumn(filterColumnId)?.getFilterValue() as string) ?? "")
                : globalFilter
            }
            onChange={(e) => {
              if (filterColumnId) {
                table.getColumn(filterColumnId)?.setFilterValue(e.target.value);
              } else {
                setGlobalFilter(e.target.value);
              }
            }}
            className="pl-9 h-11 bg-surface border-rule font-mono text-xs"
          />
        </div>
      )}

      {/* Desktop/Tablet: klassische Tabelle ab md */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-rule bg-surface">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="border-rule hover:bg-transparent">
                {hg.headers.map((header) => {
                  const sortDir = header.column.getIsSorted();
                  const sortable = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground bg-background/40"
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={
                            sortable ? header.column.getToggleSortingHandler() : undefined
                          }
                          className={`flex items-center gap-1 ${sortable ? "cursor-pointer select-none hover:text-ink transition" : ""}`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDir === "asc" && <ArrowUp className="h-3 w-3 text-yolk" />}
                          {sortDir === "desc" && <ArrowDown className="h-3 w-3 text-yolk" />}
                        </button>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Keine Daten.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={`border-rule ${onRowClick ? "cursor-pointer hover:bg-yolk/5 transition" : ""}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Card-Liste unter md */}
      <div className="md:hidden space-y-2">
        {table.getRowModel().rows.length === 0 ? (
          <div className="rounded-lg border border-rule bg-surface p-8 text-center text-sm text-muted-foreground">
            Keine Daten.
          </div>
        ) : (
          table.getRowModel().rows.map((row) => {
            const visibleCells = row.getVisibleCells();
            // Heuristik: ohne meta-Hint => Spalte 0 = Title, Spalte 1 = Value, Rest = secondary.
            const cellsMeta = visibleCells.map((cell, idx) => {
              const meta = (cell.column.columnDef.meta as MobileColumnMeta | undefined) ?? {};
              let prio = meta.mobilePriority;
              if (!prio) {
                if (idx === 0) prio = "primary";
                else if (idx === 1) prio = "primary";
                else prio = "secondary";
              }
              return { cell, meta, prio };
            });
            const primaries = cellsMeta.filter((c) => c.prio === "primary");
            const secondaries = cellsMeta.filter((c) => c.prio === "secondary");
            return (
              <button
                key={row.id}
                type="button"
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                disabled={!onRowClick}
                className={cn(
                  "w-full text-left rounded-lg border border-rule bg-surface p-4 space-y-3 transition",
                  onRowClick
                    ? "hover:border-yolk hover:bg-yolk/[0.03] active:scale-[0.99] cursor-pointer"
                    : "cursor-default",
                )}
              >
                {primaries.length > 0 && (
                  <div className="flex items-start justify-between gap-3">
                    {primaries[0] && (
                      <div className="min-w-0 flex-1 font-display text-base text-ink leading-tight break-words">
                        {flexRender(primaries[0].cell.column.columnDef.cell, primaries[0].cell.getContext())}
                      </div>
                    )}
                    {primaries[1] && (
                      <div className="shrink-0 max-w-[45%] font-mono text-sm tabular-nums text-ink text-right break-words">
                        {flexRender(primaries[1].cell.column.columnDef.cell, primaries[1].cell.getContext())}
                      </div>
                    )}
                  </div>
                )}
                {secondaries.length > 0 && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {secondaries.map(({ cell, meta }) => {
                      const headerNode = cell.column.columnDef.header;
                      const label =
                        meta.mobileLabel ??
                        (typeof headerNode === "string" ? headerNode : cell.column.id);
                      return (
                        <div key={cell.id} className="flex justify-between gap-2 min-w-0">
                          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground truncate max-w-[45%] shrink-0">
                            {label}
                          </dt>
                          <dd className="min-w-0 font-mono text-xs text-ink tabular-nums text-right break-words">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Pagination — touch-fest */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} · {table.getFilteredRowModel().rows.length} Zeilen
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-rule min-h-[44px] min-w-[44px]"
            aria-label="Vorherige Seite"
          >
            <ChevronsLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Zurück</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-rule min-h-[44px] min-w-[44px]"
            aria-label="Nächste Seite"
          >
            <span className="hidden sm:inline">Weiter</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
