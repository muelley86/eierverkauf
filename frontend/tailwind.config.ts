import type { Config } from "tailwindcss";

/** Farbe aus einer RGB-Kanal-Variable in index.css (unterstützt `/alpha`). */
const farbe = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  // Dunkelmodus über data-theme auf <html> (Umschalter + Systemeinstellung, lib/farbschema.ts).
  darkMode: ["selector", '[data-theme="dunkel"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // shadcn/ui-Semantik — Werte in index.css
        border: farbe("--border"),
        input: farbe("--input"),
        ring: farbe("--ring"),
        background: farbe("--background"),
        foreground: farbe("--foreground"),
        primary: { DEFAULT: farbe("--primary"), foreground: farbe("--primary-foreground") },
        secondary: { DEFAULT: farbe("--secondary"), foreground: farbe("--secondary-foreground") },
        destructive: { DEFAULT: farbe("--destructive"), foreground: farbe("--destructive-foreground") },
        muted: { DEFAULT: farbe("--muted"), foreground: farbe("--muted-foreground") },
        accent: { DEFAULT: farbe("--accent"), foreground: farbe("--accent-foreground") },
        popover: { DEFAULT: farbe("--popover"), foreground: farbe("--popover-foreground") },
        card: { DEFAULT: farbe("--card"), foreground: farbe("--card-foreground") },
        // Buchenhof-Tokens (bg-brand, text-brand-strong, bg-chrome …)
        brand: {
          DEFAULT: farbe("--brand"),
          strong: farbe("--brand-strong"),
          soft: farbe("--brand-soft"),
          foreground: farbe("--brand-foreground"),
        },
        chrome: { DEFAULT: farbe("--chrome"), foreground: farbe("--chrome-foreground") },
        canvas: farbe("--canvas"),
        surface: farbe("--surface"),
        ink: farbe("--ink"),
        rule: farbe("--rule"),
        positive: farbe("--positive"),
        negative: farbe("--negative"),
      },
      fontFamily: {
        sans: ["'Inter Variable'", "system-ui", "sans-serif"],
        display: ["'Inter Variable'", "system-ui", "sans-serif"],
        body: ["'Inter Variable'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
