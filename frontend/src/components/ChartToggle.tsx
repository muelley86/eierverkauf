import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChartModus = "bar" | "line";

interface ChartToggleProps {
  /** Render-Prop, das den aktuellen Modus erhält. */
  render: (modus: ChartModus) => ReactNode;
  initial?: ChartModus;
}

/** Segmented-Control im Editorial-Stil — ersetzt das alte Tabs-Toggle. */
export function ChartToggle({ render, initial = "bar" }: ChartToggleProps) {
  const [modus, setModus] = useState<ChartModus>(initial);
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-rule bg-background p-1">
        {(["bar", "line"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModus(m)}
            className={cn(
              "px-4 py-1.5 text-xs font-mono uppercase tracking-[0.1em] rounded-full transition",
              modus === m
                ? "bg-yolk text-ink"
                : "text-muted-foreground hover:text-ink",
            )}
          >
            {m === "bar" ? "Balken" : "Linie"}
          </button>
        ))}
      </div>
      {render(modus)}
    </div>
  );
}
