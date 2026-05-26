import { SVGProps } from "react";

/** Schlichtes Bauernhof-Gebaeude mit Giebeldach und Tor. */
export function Barn({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 140 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Hauptkorpus */}
      <path d="M20 50 L20 108 L120 108 L120 50" />
      {/* Giebeldach */}
      <path d="M14 50 L70 12 L126 50 Z" fill="currentColor" fillOpacity="0.08" />
      {/* Dachfirst-Linie */}
      <path d="M14 50 L126 50" />
      {/* Scheunentor (Doppeltuer) */}
      <rect x="58" y="64" width="24" height="44" />
      <path d="M70 64 L70 108" />
      <path d="M58 86 L82 86" opacity="0.5" />
      {/* Diagonale Tor-Versteifungen */}
      <path d="M58 108 L70 64 M82 108 L70 64" opacity="0.45" />
      {/* Fenster */}
      <rect x="32" y="68" width="14" height="14" />
      <path d="M39 68 L39 82 M32 75 L46 75" opacity="0.45" />
      <rect x="94" y="68" width="14" height="14" />
      <path d="M101 68 L101 82 M94 75 L108 75" opacity="0.45" />
      {/* Heuluke */}
      <path d="M64 30 L76 30 L76 42 L64 42 Z" />
      {/* Wetterhahn auf Dachspitze */}
      <path d="M70 12 L70 4 M66 6 L74 6" opacity="0.6" />
      {/* Bodenlinie */}
      <path d="M8 108 L132 108" />
    </svg>
  );
}
