import { SVGProps } from "react";

/** Schmale Weizenaehre mit Halm und einzelnen Aehrenkoernern. */
export function Wheat({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 60 140"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Halm */}
      <path d="M30 12 L30 138" />
      {/* Aehrenspitze */}
      <path d="M30 10 L30 22" />
      <path d="M30 4 L26 16 M30 4 L34 16" opacity="0.65" />
      {/* Aehrenkoerner — paarweise links/rechts mit leichten Versaetzen */}
      {[20, 32, 44, 56, 68, 80, 92, 104].map((y) => (
        <g key={y}>
          <ellipse cx="22" cy={y} rx="6" ry="3.5" transform={`rotate(-30 22 ${y})`} fill="currentColor" fillOpacity="0.2" />
          <ellipse cx="38" cy={y} rx="6" ry="3.5" transform={`rotate(30 38 ${y})`} fill="currentColor" fillOpacity="0.2" />
          {/* Granne */}
          <path d={`M22 ${y - 4} L 14 ${y - 12}`} opacity="0.55" />
          <path d={`M38 ${y - 4} L 46 ${y - 12}`} opacity="0.55" />
        </g>
      ))}
      {/* Blatt am Halm */}
      <path d="M30 116 C 18 122, 12 130, 14 136 C 22 132, 28 124, 30 118" opacity="0.5" />
    </svg>
  );
}
