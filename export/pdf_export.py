"""PDF-Export mit WeasyPrint: HTML-Template + matplotlib-Chart als PNG (base64)."""
from __future__ import annotations

import base64
from io import BytesIO
from typing import Optional, Sequence

import matplotlib

matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt  # noqa: E402

from utils.formatierung import formatiere_euro, formatiere_zahl, monatsname  # noqa: E402

# Spaltendefinitionen analog Excel-Export (Format-Funktion statt openpyxl-Codes).
SPALTEN_PDF: dict[str, list[tuple[str, str, str]]] = {
    "kunden": [
        ("Kundennummer", "kundennummer", "text"),
        ("Kundenname", "kundenname", "text"),
        ("Eier", "eier", "int"),
        ("Umsatz", "umsatz", "euro"),
        ("Positionen", "positionen", "int"),
    ],
    "artikel": [
        ("Artikel", "artikel_code", "text"),
        ("Menge", "menge", "dec"),
        ("Eier", "eier", "int"),
        ("Umsatz", "umsatz", "euro"),
    ],
    "ranking": [
        ("Kundennummer", "kundennummer", "text"),
        ("Kundenname", "kundenname", "text"),
        ("Eier", "eier", "int"),
        ("Umsatz", "umsatz", "euro"),
    ],
    "belege": [
        ("Datum", "rechnungsdatum", "text"),
        ("Beleg-Nr.", "rechnungsnummer", "text"),
        ("Kunde", "kundenname", "text"),
        ("Pos.", "positionen", "int"),
        ("Eier", "eier", "int"),
        ("Umsatz", "umsatz", "euro"),
    ],
    "kunde_monate": [
        ("Monat", "monat", "text"),
        ("Eier", "eier", "int"),
        ("Umsatz", "umsatz", "euro"),
    ],
    "artikel_monate": [
        ("Monat", "monat", "text"),
        ("Menge", "menge", "dec"),
        ("Eier", "eier", "int"),
        ("Umsatz", "umsatz", "euro"),
    ],
    "jahresvergleich": [
        ("Monat", "monat", "monat"),
        ("Eier (Jahr)", "jahr", "int"),
        ("Eier (Vorjahr)", "vorjahr", "int"),
        ("Diff.", "differenz", "int"),
        ("Umsatz", "jahr_umsatz", "euro"),
    ],
}


def _fmt(wert: object, kind: str) -> str:
    if wert is None or wert == "":
        return "—"
    if kind == "int" and isinstance(wert, (int, float)):
        return formatiere_zahl(wert, 0)
    if kind == "dec" and isinstance(wert, (int, float)):
        return formatiere_zahl(wert, 2)
    if kind == "euro" and isinstance(wert, (int, float)):
        return formatiere_euro(wert)
    if kind == "monat" and isinstance(wert, (int, float)):
        return monatsname(int(wert))
    return str(wert)


def _chart_png_base64(typ: str, daten: Sequence[dict]) -> Optional[str]:
    """Erzeugt einen Übersichts-Chart und kodiert ihn als base64-PNG."""
    if not daten:
        return None
    fig, ax = plt.subplots(figsize=(9, 4))
    if typ == "jahresvergleich":
        monate = [monatsname(int(d["monat"]))[:3] for d in daten]
        jahr = [d.get("jahr", 0) for d in daten]
        vorjahr = [d.get("vorjahr", 0) for d in daten]
        x = range(len(monate))
        ax.bar(x, jahr, width=0.6, label="Jahr", color="#2563eb")
        ax.plot(x, vorjahr, marker="o", color="#94a3b8", label="Vorjahr")
        ax.set_xticks(list(x))
        ax.set_xticklabels(monate)
        ax.legend()
        ax.set_ylabel("Eier (Stück)")
    elif typ in ("kunde_monate", "artikel_monate"):
        monate = [str(d.get("monat", "")) for d in daten]
        eier = [d.get("eier", 0) for d in daten]
        ax.bar(monate, eier, color="#2563eb")
        ax.set_ylabel("Eier (Stück)")
        plt.xticks(rotation=45, ha="right")
    elif typ == "ranking":
        top = list(daten)[:10]
        namen = [d.get("kundenname", "") for d in top][::-1]
        eier = [d.get("eier", 0) for d in top][::-1]
        ax.barh(namen, eier, color="#16a34a")
        ax.set_xlabel("Eier (Stück)")
    else:
        # Generisch: erste numerische Spalte als Säulenchart.
        keys = [k for k in daten[0].keys() if isinstance(daten[0][k], (int, float))]
        if not keys:
            plt.close(fig)
            return None
        key = keys[0]
        labels = [str(d.get("kundenname") or d.get("artikel_code") or "") for d in daten[:10]]
        werte = [d.get(key, 0) for d in daten[:10]]
        ax.bar(labels, werte, color="#2563eb")
        plt.xticks(rotation=45, ha="right")
        ax.set_ylabel(key)

    ax.grid(True, axis="y", linestyle="--", alpha=0.3)
    fig.tight_layout()
    buf = BytesIO()
    fig.savefig(buf, format="png", dpi=120)
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8">
<title>{titel}</title>
<style>
  @page {{ size: A4 landscape; margin: 1.5cm; }}
  body {{ font-family: 'Helvetica', sans-serif; color: #1f2937; }}
  h1 {{ color: #1e3a8a; font-size: 18pt; margin-bottom: 0.2em; }}
  .meta {{ color: #475569; font-size: 10pt; margin-bottom: 1em; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 9pt; }}
  th {{ background: #1e3a8a; color: white; padding: 0.4em; text-align: left; }}
  td {{ border-bottom: 1px solid #e5e7eb; padding: 0.3em; }}
  tr:nth-child(even) td {{ background: #f8fafc; }}
  .chart {{ margin: 1em 0; text-align: center; }}
  .chart img {{ max-width: 100%; }}
  .footer {{ position: fixed; bottom: 0; right: 0; font-size: 8pt; color: #94a3b8; }}
</style></head>
<body>
  <h1>{titel}</h1>
  <div class="meta">Zeitraum: {zeitraum} &middot; Erstellt: {erstellt}</div>
  {chart_html}
  <table>
    <thead><tr>{kopfzeile}</tr></thead>
    <tbody>{zeilen}</tbody>
  </table>
  <div class="footer">Kerba Bio-Ei GbR &middot; Eierverkauf-Auswertung</div>
</body></html>
"""


def build_pdf(typ: str, von: Optional[str], bis: Optional[str], daten: Sequence[dict],
              titel: Optional[str] = None) -> bytes:
    """Erzeugt ein PDF-Dokument aus den Daten."""
    from datetime import datetime
    from weasyprint import HTML  # lokaler Import → Fehler nur bei tatsächlicher Nutzung

    spalten = SPALTEN_PDF.get(typ)
    if spalten is None:
        # Fallback: alle keys aus erstem Eintrag, als Text.
        keys = list(daten[0].keys()) if daten else []
        spalten = [(k.capitalize(), k, "text") for k in keys]

    zeitraum = f"{von or '–'} bis {bis or '–'}" if (von or bis) else "Gesamtzeitraum"
    titel_text = titel or f"Auswertung: {typ.capitalize()}"
    kopfzeile = "".join(f"<th>{name}</th>" for name, _, _ in spalten)
    zeilen_html = "".join(
        "<tr>" + "".join(f"<td>{_fmt(eintrag.get(key), kind)}</td>" for _, key, kind in spalten) + "</tr>"
        for eintrag in daten
    )
    chart_b64 = _chart_png_base64(typ, daten)
    chart_html = (
        f'<div class="chart"><img src="data:image/png;base64,{chart_b64}" alt="Diagramm"/></div>'
        if chart_b64 else ""
    )
    html = _HTML_TEMPLATE.format(
        titel=titel_text,
        zeitraum=zeitraum,
        erstellt=datetime.now().strftime("%d.%m.%Y %H:%M"),
        chart_html=chart_html,
        kopfzeile=kopfzeile,
        zeilen=zeilen_html or "<tr><td colspan='99'>Keine Daten</td></tr>",
    )
    return HTML(string=html).write_pdf()


__all__ = ["build_pdf", "SPALTEN_PDF"]
