import { SVGProps } from "react";

/** Schraegansicht eines geoeffneten 10er-Eierkartons mit drei Eiern. */
export function EggCarton({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Karton-Korpus */}
      <path d="M8 52 L18 72 L102 72 L112 52 L8 52 Z" />
      <path d="M8 52 L112 52" />
      {/* Innere Mulden (5 x 2 angedeutet) */}
      <ellipse cx="24" cy="60" rx="8" ry="4" opacity="0.5" />
      <ellipse cx="44" cy="60" rx="8" ry="4" opacity="0.5" />
      <ellipse cx="60" cy="60" rx="8" ry="4" opacity="0.5" />
      <ellipse cx="76" cy="60" rx="8" ry="4" opacity="0.5" />
      <ellipse cx="96" cy="60" rx="8" ry="4" opacity="0.5" />
      {/* Drei Eier in den vorderen Mulden */}
      <ellipse cx="24" cy="50" rx="6" ry="8" fill="currentColor" fillOpacity="0.18" />
      <ellipse cx="60" cy="48" rx="6.5" ry="8.5" fill="currentColor" fillOpacity="0.22" />
      <ellipse cx="96" cy="50" rx="6" ry="8" fill="currentColor" fillOpacity="0.18" />
      {/* Aufgeklappter Deckel im Hintergrund */}
      <path d="M14 50 L18 22 L102 22 L106 50" opacity="0.65" />
      <path d="M14 50 L106 50" opacity="0.4" />
    </svg>
  );
}
