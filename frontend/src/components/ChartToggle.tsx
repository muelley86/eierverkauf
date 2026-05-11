import { useState, ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ChartModus = "bar" | "line";

interface ChartToggleProps {
  /** Render-Prop, das den aktuellen Modus erhält. */
  render: (modus: ChartModus) => ReactNode;
  initial?: ChartModus;
}

export function ChartToggle({ render, initial = "bar" }: ChartToggleProps) {
  const [modus, setModus] = useState<ChartModus>(initial);
  return (
    <div className="space-y-3">
      <Tabs value={modus} onValueChange={(v) => setModus(v as ChartModus)}>
        <TabsList>
          <TabsTrigger value="bar">Balken</TabsTrigger>
          <TabsTrigger value="line">Linie</TabsTrigger>
        </TabsList>
      </Tabs>
      {render(modus)}
    </div>
  );
}
