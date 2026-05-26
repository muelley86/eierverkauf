import { SVGProps } from "react";

/** Stilisierte Henne im Profil, Linie. */
export function Hen({ className, ...props }: SVGProps<SVGSVGElement>) {
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
      {/* Koerper */}
      <path d="M22 80 C 22 56, 50 38, 82 42 C 104 45, 118 60, 116 78 C 114 96, 92 102, 70 100 C 42 98, 22 92, 22 80 Z" />
      {/* Schwanz */}
      <path d="M22 78 C 10 70, 6 50, 14 38 C 18 50, 20 64, 24 76" />
      <path d="M14 38 C 22 44, 26 56, 26 70" opacity="0.55" />
      {/* Kopf */}
      <circle cx="92" cy="38" r="14" />
      {/* Kamm */}
      <path d="M84 26 L86 18 M90 24 L92 14 M96 24 L98 16" />
      {/* Schnabel */}
      <path d="M104 38 L114 36 L104 42 Z" fill="currentColor" fillOpacity="0.4" />
      {/* Kehllappen */}
      <path d="M98 48 C 100 56, 96 58, 92 56" />
      {/* Auge */}
      <circle cx="94" cy="36" r="1.4" fill="currentColor" />
      {/* Beine */}
      <path d="M58 100 L 56 116 M 60 116 L 50 116 M 60 116 L 54 110" />
      <path d="M82 100 L 84 116 M 88 116 L 78 116 M 88 116 L 82 110" />
      {/* Fluegel-Andeutung */}
      <path d="M50 70 C 60 64, 78 64, 88 72 C 80 80, 64 82, 50 76 Z" opacity="0.5" />
    </svg>
  );
}
