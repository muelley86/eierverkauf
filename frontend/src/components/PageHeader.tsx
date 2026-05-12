import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZeitraumFilter } from "@/components/ZeitraumFilter";

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { to: string; label: string };
  /** Zusätzliche Action-Buttons links neben dem Zeitraumfilter. */
  actions?: ReactNode;
  /** Zeitraumfilter rechts ausblenden (z. B. auf Import-Seiten). Default: sichtbar. */
  withZeitraumFilter?: boolean;
  /**
   * Wenn gesetzt, wird rechts ein dezenter Download-Pfeil neben dem
   * Zeitraumfilter gerendert (Mockup-Akzent für Datenexport).
   */
  exportHref?: string;
  className?: string;
}

/** Einheitlicher Editorial-Header für Seiten und Detailansichten. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  back,
  actions,
  withZeitraumFilter = true,
  exportHref,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-10 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="space-y-2">
        {back && (
          <Link
            to={back.to}
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.12em] text-muted-foreground hover:text-ink transition"
          >
            <ArrowLeft className="h-3 w-3" /> {back.label}
          </Link>
        )}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="font-display text-5xl md:text-6xl text-ink leading-[1.05] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground max-w-xl pt-1">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {withZeitraumFilter && <ZeitraumFilter />}
        {exportHref && (
          <a
            href={exportHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-surface text-muted-foreground hover:text-ink hover:bg-yolk/10 transition"
            aria-label="Daten exportieren"
          >
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Karten-Wrapper im Editorial-Stil — Surface + Rule-Border. */
export function Panel({
  title,
  eyebrow,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-xl border border-rule bg-surface", className)}
    >
      {(title || eyebrow || actions) && (
        <header className="flex flex-wrap items-end justify-between gap-3 px-6 pt-5 pb-4 border-b border-rule">
          <div>
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            {title && (
              <h3 className="font-display text-2xl text-ink leading-tight">{title}</h3>
            )}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}
