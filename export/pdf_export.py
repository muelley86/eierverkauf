"""PDF-Export mit WeasyPrint: HTML-Template + matplotlib-Chart als PNG (base64)."""
from __future__ import annotations

import base64
import html as html_lib
from functools import lru_cache
from io import BytesIO
from pathlib import Path
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
    "zeitraumvergleich": [
        ("Zeitraum", "zeitraum", "text"),
        ("Eier (Vorjahr)", "vorjahr", "int"),
        ("Eier (Zeitraum)", "jahr", "int"),
        ("Diff.", "differenz", "int"),
        ("Umsatz (Zeitraum)", "jahr_umsatz", "euro"),
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


def _label(wert: object) -> str:
    """Achsenbeschriftung: '$' maskieren, sonst parst matplotlib Mathtext.

    Kundennamen stammen aus der CSV; ungültiger Mathtext ("$\\frac{$") ließ
    den PDF-Export mit einer Exception abbrechen.
    """
    return str(wert).replace("$", r"\$")


# Buchenhof-Palette (www.buchenhof.de), synchron zu frontend/src/index.css
FARBE_ANTHRAZIT = "#353535"
FARBE_TEXT = "#313131"
FARBE_TEXT_LEISE = "#565B5B"
FARBE_GRUEN = "#B5D556"
FARBE_GRUEN_KRAEFTIG = "#76981C"
FARBE_VORJAHR = "#A6A9A9"
FARBE_LINIE = "#E6E7E4"
FARBE_ZEILE = "#F7F7F7"

LOGO_PFAD = Path(__file__).parent / "assets" / "buchenhof-baum.png"


@lru_cache(maxsize=1)
def _logo_data_url() -> str:
    """Baum-Logo als ``data:``-URL (der URL-Fetcher lässt nur ``data:`` zu)."""
    try:
        roh = LOGO_PFAD.read_bytes()
    except OSError:
        return ""
    return "data:image/png;base64," + base64.b64encode(roh).decode("ascii")


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
        ax.bar(x, jahr, width=0.6, label="Jahr", color=FARBE_GRUEN, edgecolor=FARBE_GRUEN_KRAEFTIG)
        ax.plot(x, vorjahr, marker="o", color=FARBE_VORJAHR, label="Vorjahr")
        ax.set_xticks(list(x))
        ax.set_xticklabels(monate)
        ax.legend()
        ax.set_ylabel("Eier (Stück)")
    elif typ == "zeitraumvergleich":
        labels = [_label(d.get("zeitraum", "")) for d in daten]
        x = range(len(labels))
        ax.bar(x, [d.get("jahr", 0) for d in daten], width=0.6, label="Zeitraum",
               color=FARBE_GRUEN, edgecolor=FARBE_GRUEN_KRAEFTIG)
        ax.plot(x, [d.get("vorjahr", 0) for d in daten], marker="o", color=FARBE_VORJAHR,
                label="Vorjahr")
        ax.set_xticks(list(x))
        ax.set_xticklabels(labels, rotation=45, ha="right")
        ax.legend()
        ax.set_ylabel("Eier (Stück)")
    elif typ in ("kunde_monate", "artikel_monate"):
        monate = [_label(d.get("monat", "")) for d in daten]
        eier = [d.get("eier", 0) for d in daten]
        ax.bar(monate, eier, color=FARBE_GRUEN, edgecolor=FARBE_GRUEN_KRAEFTIG)
        ax.set_ylabel("Eier (Stück)")
        plt.xticks(rotation=45, ha="right")
    elif typ == "ranking":
        top = list(daten)[:10]
        namen = [_label(d.get("kundenname", "")) for d in top][::-1]
        eier = [d.get("eier", 0) for d in top][::-1]
        ax.barh(namen, eier, color=FARBE_GRUEN, edgecolor=FARBE_GRUEN_KRAEFTIG)
        ax.set_xlabel("Eier (Stück)")
    else:
        # Generisch: erste numerische Spalte als Säulenchart.
        keys = [k for k in daten[0].keys() if isinstance(daten[0][k], (int, float))]
        if not keys:
            plt.close(fig)
            return None
        key = keys[0]
        labels = [_label(d.get("kundenname") or d.get("artikel_code") or "") for d in daten[:10]]
        werte = [d.get(key, 0) for d in daten[:10]]
        ax.bar(labels, werte, color=FARBE_GRUEN, edgecolor=FARBE_GRUEN_KRAEFTIG)
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
  body {{ font-family: 'Inter', 'DejaVu Sans', sans-serif; color: #313131; }}
  .kopf {{ display: flex; align-items: center; gap: 0.6em;
           border-bottom: 3px solid #B5D556; padding-bottom: 0.4em; margin-bottom: 0.6em; }}
  .logo {{ height: 1.6cm; }}
  .marke {{ color: #565B5B; font-size: 9pt; }}
  h1 {{ color: #313131; font-size: 18pt; margin: 0; }}
  .meta {{ color: #565B5B; font-size: 10pt; margin-bottom: 1em; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 9pt; }}
  th {{ background: #353535; color: white; padding: 0.4em; text-align: left; }}
  td {{ border-bottom: 1px solid #E6E7E4; padding: 0.3em; }}
  tr:nth-child(even) td {{ background: #F7F7F7; }}
  .chart {{ margin: 1em 0; text-align: center; }}
  .chart img {{ max-width: 100%; }}
  .footer {{ position: fixed; bottom: 0; right: 0; font-size: 8pt; color: #A6A9A9; }}
</style></head>
<body>
  <div class="kopf">
    {logo_html}
    <div><div class="marke">Buchenhof · Kerba Bio-Ei GbR</div><h1>{titel}</h1></div>
  </div>
  <div class="meta">Zeitraum: {zeitraum} &middot; Erstellt: {erstellt}</div>
  {chart_html}
  <table>
    <thead><tr>{kopfzeile}</tr></thead>
    <tbody>{zeilen}</tbody>
  </table>
  <div class="footer">Kerba Bio-Ei GbR &middot; Eierverkauf-Auswertung</div>
</body></html>
"""


def pdf_url_fetcher():
    """URL-Fetcher für WeasyPrint, der nur ``data:``-URLs auflöst.

    Der Standard-Fetcher liest ``file://``- und ``http(s)://``-Ressourcen —
    über eingeschleustes Markup ließen sich sonst lokale Server-Dateien als
    PDF-Anhang einbetten oder Requests ins LAN auslösen. Das einzige externe
    Element des Templates ist das Diagramm als ``data:``-PNG.

    WeasyPrint ≥ 67 erwartet eine ``URLFetcher``-Instanz, ältere Versionen
    eine Funktion; beide Varianten werden unterstützt.
    """
    try:
        from weasyprint.urls import URLFetcher
    except ImportError:  # WeasyPrint < 67
        from weasyprint import default_url_fetcher

        def fetcher(url: str, *args, **kwargs):
            if not url.startswith("data:"):
                raise ValueError(f"PDF-Export: Ressource nicht erlaubt: {url}")
            return default_url_fetcher(url, *args, **kwargs)

        return fetcher
    return URLFetcher(allowed_protocols={"data"})


def baue_pdf_html(typ: str, von: Optional[str], bis: Optional[str], daten: Sequence[dict],
                  titel: Optional[str] = None, filter_hinweis: Optional[str] = None) -> str:
    """Baut das HTML-Dokument für den PDF-Export; alle Textwerte maskiert."""
    from datetime import datetime

    esc = html_lib.escape
    spalten = SPALTEN_PDF.get(typ)
    if spalten is None:
        # Fallback: alle keys aus erstem Eintrag, als Text.
        keys = list(daten[0].keys()) if daten else []
        spalten = [(k.capitalize(), k, "text") for k in keys]

    zeitraum = f"{von or '–'} bis {bis or '–'}" if (von or bis) else "Gesamtzeitraum"
    if filter_hinweis:
        zeitraum = f"{zeitraum} · {filter_hinweis}"
    titel_text = titel or f"Auswertung: {typ.capitalize()}"
    kopfzeile = "".join(f"<th>{esc(name)}</th>" for name, _, _ in spalten)
    zeilen_html = "".join(
        "<tr>" + "".join(f"<td>{esc(_fmt(eintrag.get(key), kind))}</td>" for _, key, kind in spalten) + "</tr>"
        for eintrag in daten
    )
    chart_b64 = _chart_png_base64(typ, daten)
    chart_html = (
        f'<div class="chart"><img src="data:image/png;base64,{chart_b64}" alt="Diagramm"/></div>'
        if chart_b64 else ""
    )
    return _HTML_TEMPLATE.format(
        titel=esc(titel_text),
        zeitraum=esc(zeitraum),
        erstellt=datetime.now().strftime("%d.%m.%Y %H:%M"),
        chart_html=chart_html,
        logo_html=(f'<img class="logo" src="{_logo_data_url()}" alt="Buchenhof"/>'
                   if _logo_data_url() else ""),
        kopfzeile=kopfzeile,
        zeilen=zeilen_html or "<tr><td colspan='99'>Keine Daten</td></tr>",
    )


def build_pdf(typ: str, von: Optional[str], bis: Optional[str], daten: Sequence[dict],
              titel: Optional[str] = None, filter_hinweis: Optional[str] = None) -> bytes:
    """Erzeugt ein PDF-Dokument aus den Daten."""
    from weasyprint import HTML  # lokaler Import → Fehler nur bei tatsächlicher Nutzung

    html = baue_pdf_html(typ, von, bis, daten, titel, filter_hinweis)
    return HTML(string=html, url_fetcher=pdf_url_fetcher()).write_pdf()


__all__ = ["build_pdf", "baue_pdf_html", "pdf_url_fetcher", "SPALTEN_PDF"]
