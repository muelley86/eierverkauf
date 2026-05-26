import { SVGProps } from "react";

/** Geflochtener Korb mit Eiern, halb von oben gesehen. */
export function EggBasket({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 140 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Eier in der Mitte (vor dem vorderen Korbrand gezeichnet) */}
      <ellipse cx="50" cy="58" rx="9" ry="12" fill="currentColor" fillOpacity="0.18" />
      <ellipse cx="74" cy="56" rx="10" ry="13" fill="currentColor" fillOpacity="0.22" />
      <ellipse cx="92" cy="62" rx="8" ry="11" fill="currentColor" fillOpacity="0.18" />
      <ellipse cx="62" cy="50" rx="8" ry="10" fill="currentColor" fillOpacity="0.15" />
      {/* Henkel */}
      <path d="M30 60 C 30 24, 110 24, 110 60" />
      {/* Korb-Kontur */}
      <path d="M18 64 L24 102 L116 102 L122 64 Z" />
      {/* Oberer Korbrand (Ellipse) */}
      <ellipse cx="70" cy="64" rx="52" ry="8" />
      {/* Flecht-Muster auf der Korb-Vorderseite */}
      <path d="M26 72 L 114 72" opacity="0.5" />
      <path d="M28 82 L 112 82" opacity="0.5" />
      <path d="M30 92 L 110 92" opacity="0.5" />
      {/* Senkrechte Flecht-Linien */}
      <path d="M44 66 L 46 100 M60 66 L 62 100 M76 66 L 78 100 M92 66 L 94 100" opacity="0.4" />
    </svg>
  );
}
