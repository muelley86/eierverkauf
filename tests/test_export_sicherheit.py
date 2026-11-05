"""Sicherheitstests für PDF- und Excel-Export.

Kundennamen, Kunden- und Rechnungsnummern stammen ungefiltert aus der
hochgeladenen CSV. Sie dürfen im PDF weder als HTML interpretiert werden
(WeasyPrint würde sonst z. B. lokale Dateien als Anhang einbetten) noch im
Excel-Export als Formel landen.
"""
import re
import zlib
from io import BytesIO

import pytest
from openpyxl import load_workbook

from export.excel_export import build_excel
from export.pdf_export import baue_pdf_html, build_pdf, pdf_url_fetcher

MARKER = "EIER-MARKER-4711"


def _kunde(name: str, nummer: str = "10001") -> dict:
    return {"kundennummer": nummer, "kundenname": name, "eier": 10, "umsatz": 3.0, "positionen": 1}


def _pdf_inhalt_entpackt(pdf: bytes) -> bytes:
    """Alle Flate-Streams entpackt + Rohbytes, um eingebettete Daten zu finden."""
    teile = [pdf]
    for treffer in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", pdf, re.S):
        try:
            teile.append(zlib.decompress(treffer.group(1)))
        except zlib.error:
            pass
    return b"".join(teile)


@pytest.fixture()
def weasyprint_verfuegbar():
    try:
        import weasyprint  # noqa: F401
    except OSError as exc:  # GTK/Pango fehlt (z. B. Windows)
        pytest.skip(f"WeasyPrint nicht lauffähig: {exc}")


# --- PDF ------------------------------------------------------------------

def test_pdf_html_maskiert_markup_im_kundennamen():
    html = baue_pdf_html("kunden", None, None, [_kunde('<b>Hof</b> & "Co"')])

    assert "&lt;b&gt;Hof&lt;/b&gt; &amp; &quot;Co&quot;" in html
    assert "<b>Hof</b>" not in html


def test_pdf_html_maskiert_kundennummer_und_rechnungsnummer():
    beleg = {"rechnungsdatum": "2025-03-01", "rechnungsnummer": "<i>R1</i>",
             "kundenname": "A", "positionen": 1, "eier": 1, "umsatz": 1.0}

    html = baue_pdf_html("belege", None, None, [beleg])

    assert "&lt;i&gt;R1&lt;/i&gt;" in html


@pytest.mark.parametrize("url", ["file:///etc/hostname", "http://192.168.1.1/", "https://example.org/x.png"])
def test_url_fetcher_lehnt_datei_und_netzwerk_urls_ab(weasyprint_verfuegbar, url):
    fetcher = pdf_url_fetcher()

    with pytest.raises(ValueError):
        fetcher(url)


def test_url_fetcher_erlaubt_data_urls(weasyprint_verfuegbar):
    fetcher = pdf_url_fetcher()

    fetcher("data:text/plain;base64,SGFsbG8=")  # wirft nicht


def test_pdf_bettet_keine_lokale_datei_ein(weasyprint_verfuegbar, tmp_path):
    datei = tmp_path / "geheim.txt"
    datei.write_text(MARKER)
    name = f'<a rel="attachment" href="file://{datei}">x</a>'

    pdf = build_pdf("kunden", None, None, [_kunde(name)])

    assert MARKER.encode() not in _pdf_inhalt_entpackt(pdf)


def test_pdf_ranking_mit_dollarzeichen_im_kundennamen_bricht_nicht_ab(weasyprint_verfuegbar):
    # matplotlib interpretiert "$...$" als Mathtext; ungültiger Mathtext
    # führte zu einer Exception und damit zu einem 500 beim PDF-Export.
    daten = [_kunde(r"Hof $\frac{ AG $"), _kunde("Normal", "10002")]

    pdf = build_pdf("ranking", None, None, daten)

    assert pdf.startswith(b"%PDF")


# --- Excel ----------------------------------------------------------------

@pytest.mark.parametrize("wert", ["=1+1", '=HYPERLINK("http://x/","Klick")', "+1", "-A1", "@SUMME(A1)"])
def test_excel_schreibt_formelartigen_text_als_text(wert):
    xlsx = build_excel("kunden", None, None, [_kunde(wert, nummer=wert)])

    ws = load_workbook(BytesIO(xlsx)).active
    for zelle in (ws["A4"], ws["B4"]):
        assert zelle.data_type == "s"
        assert zelle.value == wert


def test_excel_zahlen_bleiben_zahlen():
    xlsx = build_excel("kunden", None, None, [_kunde("Hof")])

    ws = load_workbook(BytesIO(xlsx)).active

    assert ws["C4"].data_type == "n"
    assert ws["C4"].value == 10
