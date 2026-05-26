import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  illustration?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Steuert die Hoehe / Padding: "panel" fuer Innerhalb von <Panel>, "page" als ganze Seite. */
  size?: "panel" | "page";
}

/**
 * Wiederverwendbarer Empty-State im Editorial-Stil — Illustration zentriert
 * mit warmem Yolk-Ton (currentColor), darunter Titel + Beschreibung + Action.
 */
export function EmptyState({
  illustration,
  title,
  description,
  action,
  className,
  size = "panel",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "panel" ? "py-10 px-4" : "py-20 px-6",
        className,
      )}
    >
      {illustration && (
        <div
          className={cn(
            "text-yolk/70 mb-6",
            size === "panel" ? "w-32 sm:w-40" : "w-48 sm:w-56",
          )}
          aria-hidden="true"
        >
          {illustration}
        </div>
      )}
      <h3 className="font-display text-xl sm:text-2xl text-ink leading-tight tracking-tight max-w-md">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
