"""Exporte im Buchenhof-Design (v1.16.0): Anthrazit-Kopf, grüner Akzent,
eingebettetes Baum-Logo nur als data:-URL. Alle Daten synthetisch.
"""
import re
from io import BytesIO

from openpyxl import load_workbook

from export.excel_export import build_excel
from export.pdf_export import baue_pdf_html

RANKING = [{"kundennummer": "10001", "kundenname": "Testkunde", "eier": 100,
            "umsatz": 24.8, "eier_umsatz": 24.8, "positionen": 1}]


def _farbe(cell) -> str:
    return cell.fill.start_color.rgb[-6:].upper()


def test_excel_kopfzeile_anthrazit_mit_gruenem_akzent():
    # Act
    ws = load_workbook(BytesIO(build_excel("ranking", None, None, RANKING))).active

    # Assert
    assert _farbe(ws.cell(row=3, column=1)) == "353535"
    assert _farbe(ws.cell(row=2, column=1)) == "B5D556"


def test_pdf_html_nutzt_buchenhof_palette_und_eingebettetes_logo():
    # Act
    html = baue_pdf_html("ranking", None, None, RANKING)

    # Assert
    assert "#353535" in html
    assert "#B5D556" in html.upper()
    assert "1e3a8a" not in html.lower()
    assert re.search(r'<img class="logo" src="data:image/png;base64,', html)
    assert "http://" not in html and "https://" not in html
