import { Moon, Sun } from "lucide-react";
import { useFarbschema } from "@/lib/farbschema";
import { cn } from "@/lib/utils";

/**
 * Hell/Dunkel-Umschalter auf der Anthrazit-Fläche.
 * `zeile`: Sidebar (Text + Schalter), `icon`: runde Taste in der mobilen Kopfzeile.
 */
export function FarbschemaUmschalter({ variante }: { variante: "zeile" | "icon" }) {
  const { schema, umschalten } = useFarbschema();
  const dunkel = schema === "dunkel";
  const beschriftung = dunkel ? "Helles Design einschalten" : "Dunkles Design einschalten";

  if (variante === "icon") {
    return (
      <button
        type="button"
        onClick={umschalten}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-chrome-foreground transition hover:bg-white/10 active:scale-95"
        aria-label={beschriftung}
        title={beschriftung}
      >
        {dunkel ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dunkel}
      onClick={umschalten}
      className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 text-sm text-chrome-foreground/75 transition hover:bg-white/[0.06] hover:text-chrome-foreground"
    >
      <Moon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-left">Dunkles Design</span>
      <span
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          dunkel ? "bg-brand" : "bg-white/20",
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none",
            dunkel ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
