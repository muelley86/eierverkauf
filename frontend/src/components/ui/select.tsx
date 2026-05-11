import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Einfaches natives Select für unsere Anwendungsfälle (Jahr-Auswahl, Sort-Wahl).
 * Bewusst kein Radix-Select, weil wir die zusätzliche Komplexität nicht brauchen.
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export { Select };
