import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZeitraumFilter } from "@/components/ZeitraumFilter";
import { KundenFilter } from "@/components/KundenFilter";

interface PageHeaderProps {
  /** Bereichsname über dem Titel (z. B. „Kunden"). */
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { to: string; label: string };
  /** Zusätzliche Action-Buttons links neben dem Zeitraumfilter. */
  actions?: ReactNode;
  /** Zeitraumfilter rechts ausblenden (z. B. auf Import-Seiten). Default: sichtbar. */
  withZeitraumFilter?: boolean;
  /** Kundenfilter (Mehrfachauswahl) links neben dem Zeitraum einblenden. Default: aus. */
  withKundenFilter?: boolean;
  /** Wenn gesetzt, erscheint rechts ein Download-Button für den Datenexport. */
  exportHref?: string;
  className?: string;
}

/** Einheitlicher Seitenkopf: Titel links, Zeitraum + Export rechts (mobil darunter). */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  back,
  actions,
  withZeitraumFilter = true,
  withKundenFilter = false,
  exportHref,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 md:mb-8 flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {back && (
          <Link
            to={back.to}
            className="mb-2 inline-flex min-h-[32px] items-center gap-1.5 text-sm text-muted-foreground transition hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> {back.label}
          </Link>
        )}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="break-words text-2xl leading-tight text-ink sm:text-3xl lg:text-[2.25rem]">
          {title}
        </h1>
        {subtitle && <p className="max-w-xl pt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:shrink-0">
        {actions}
        {withKundenFilter && <KundenFilter />}
        {withZeitraumFilter && <ZeitraumFilter />}
        {exportHref && (
          <a
            href={exportHref}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-rule bg-surface text-muted-foreground transition hover:bg-brand/20 hover:text-ink active:scale-95"
            aria-label="Als Excel exportieren"
            title="Als Excel exportieren"
          >
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Einziger Karten-Wrapper der App — weiße Fläche, feine Linie, große Rundung. */
export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-rule bg-surface", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
          {title && <h2 className="text-base leading-tight text-ink sm:text-lg">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}
