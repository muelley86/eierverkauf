"""Zeitraumabhängiger Verlauf für die Dashboard-Grafik (seit v1.16.0).

Tageswerte werden in Buckets (Tag, Woche, Monat) zusammengefasst. Buckets
liegen **relativ zu ``von``**, damit der um ein Jahr verschobene
Vorjahreszeitraum positionsgleich daneben gelegt werden kann. Die Bucket-Logik
(``bucket_verlauf``, ``waehle_granularitaet``, ``verlauf_label``) ist rein;
``zeitraum_verlauf`` lädt die Tageswerte über ``data.queries``. Genutzt von
der Übersicht (Grafik, Sparklines), der Seite „Zeitraumvergleich" und deren
Export.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Literal, Optional

from utils.formatierung import monatsname

from . import queries

Granularitaet = Literal["tag", "woche", "monat"]

MAX_TAGE_TAGESWERTE = 62      # bis ~2 Monate: ein Balken pro Tag
MAX_TAGE_WOCHENWERTE = 183    # bis ~6 Monate: ein Balken pro Woche
TAGE_PRO_WOCHE = 7

# Je Bucket aufsummierte Tageswerte. ``eier_umsatz`` = Umsatz nur aus
# Positionen mit Eier-Stückzahl (Basis für Umsatz je Ei).
SUMMEN_FELDER = ("eier", "umsatz", "eier_umsatz")


def waehle_granularitaet(von: date, bis: date) -> Granularitaet:
    """Wählt die Auflösung anhand der Zeitraumlänge (inklusive beider Enden)."""
    tage = (bis - von).days + 1
    if tage <= MAX_TAGE_TAGESWERTE:
        return "tag"
    if tage <= MAX_TAGE_WOCHENWERTE:
        return "woche"
    return "monat"


def _monats_index(d: date, von: date) -> int:
    return (d.year - von.year) * 12 + (d.month - von.month)


def _bucket_index(d: date, von: date, granularitaet: Granularitaet) -> int:
    if granularitaet == "tag":
        return (d - von).days
    if granularitaet == "woche":
        return (d - von).days // TAGE_PRO_WOCHE
    return _monats_index(d, von)


def _bucket_start(index: int, von: date, granularitaet: Granularitaet) -> date:
    if granularitaet == "tag":
        return von + timedelta(days=index)
    if granularitaet == "woche":
        return von + timedelta(days=index * TAGE_PRO_WOCHE)
    if index == 0:
        return von
    monate = von.month - 1 + index
    return date(von.year + monate // 12, monate % 12 + 1, 1)


def bucket_verlauf(
    tageswerte: list[dict],
    von: date,
    bis: date,
    granularitaet: Granularitaet,
) -> list[dict]:
    """Fasst ``[{datum, eier, umsatz, eier_umsatz}]`` zu lückenlosen Buckets zusammen.

    Werte außerhalb ``[von, bis]`` werden ignoriert; leere Buckets erhalten 0.
    Die Eingabe wird nicht verändert.
    """
    anzahl = _bucket_index(bis, von, granularitaet) + 1
    summen = {feld: [0.0] * anzahl for feld in SUMMEN_FELDER}
    for wert in tageswerte:
        tag = date.fromisoformat(wert["datum"])
        if not von <= tag <= bis:
            continue
        i = _bucket_index(tag, von, granularitaet)
        for feld in SUMMEN_FELDER:
            summen[feld][i] += float(wert.get(feld) or 0)
    return [
        {
            "start": _bucket_start(i, von, granularitaet).isoformat(),
            **{feld: summen[feld][i] for feld in SUMMEN_FELDER},
        }
        for i in range(anzahl)
    ]


def verlauf_label(start_iso: str, granularitaet: Granularitaet) -> str:
    """Beschriftung eines Buckets für Exporte ('03.11.2026', 'ab 03.11.2026', 'Nov 2025')."""
    start = date.fromisoformat(start_iso)
    if granularitaet == "monat":
        return f"{monatsname(start.month)[:3]} {start.year}"
    tag = start.strftime("%d.%m.%Y")
    return f"ab {tag}" if granularitaet == "woche" else tag


def ein_jahr_zurueck(d: Optional[date]) -> Optional[date]:
    """Schiebt ein Datum um genau ein Jahr zurück. 29.02. → 28.02."""
    if d is None:
        return None
    try:
        return d.replace(year=d.year - 1)
    except ValueError:
        # Schaltjahr-29.02. — auf 28.02. im Vorjahr zurückfallen.
        return d.replace(year=d.year - 1, day=28)


def _effektiver_zeitraum(von: Optional[date], bis: Optional[date]) -> Optional[tuple[date, date]]:
    """Füllt fehlende Grenzen mit dem Datenbereich auf; ``None`` ohne Daten."""
    if von and bis:
        return von, bis
    min_datum, max_datum = queries.datenbereich()
    if min_datum is None or max_datum is None:
        return None
    return von or date.fromisoformat(min_datum), bis or date.fromisoformat(max_datum)


def _buckets(von: date, bis: date, granularitaet: Granularitaet) -> list[dict]:
    return bucket_verlauf(
        queries.tageswerte(von.isoformat(), bis.isoformat()), von, bis, granularitaet
    )


def _zeitraum_dict(von: date, bis: date) -> dict:
    return {"von": von.isoformat(), "bis": bis.isoformat()}


def zeitraum_verlauf(
    von: Optional[date],
    bis: Optional[date],
    granularitaet: Optional[Granularitaet] = None,
) -> dict:
    """Verlauf im Zeitraum plus positionsgleicher Vorjahreszeitraum.

    Basis für Dashboard-Grafik (Auflösung automatisch) und Seite
    „Zeitraumvergleich" (fest ``"monat"``). Ohne Zeitraum-Filter läuft der
    Verlauf über den gesamten Bestand und ``vorjahr_*`` /
    ``vorjahreszeitraum`` sind ``None``.

    Raises:
        ValueError: wenn ``von`` nach ``bis`` liegt.
    """
    if von and bis and von > bis:
        raise ValueError("„von“ liegt nach „bis“.")
    zeitraum = _effektiver_zeitraum(von, bis)
    if zeitraum is None:
        return {"granularitaet": granularitaet or "monat", "punkte": [],
                "zeitraum": None, "vorjahreszeitraum": None}
    start, ende = zeitraum
    if start > ende:
        raise ValueError("Zeitraum enthält keine Daten.")

    granularitaet = granularitaet or waehle_granularitaet(start, ende)
    aktuell = _buckets(start, ende, granularitaet)
    mit_vorjahr = bool(von or bis)
    vj_start, vj_ende = ein_jahr_zurueck(start), ein_jahr_zurueck(ende)
    vorjahr = _buckets(vj_start, vj_ende, granularitaet) if mit_vorjahr else []

    def _vj(i: int, feld: str) -> Optional[float]:
        if not mit_vorjahr:
            return None
        return vorjahr[i][feld] if i < len(vorjahr) else 0.0

    return {
        "granularitaet": granularitaet,
        "zeitraum": _zeitraum_dict(start, ende),
        "vorjahreszeitraum": _zeitraum_dict(vj_start, vj_ende) if mit_vorjahr else None,
        "punkte": [
            {**punkt, **{f"vorjahr_{feld}": _vj(i, feld) for feld in SUMMEN_FELDER}}
            for i, punkt in enumerate(aktuell)
        ],
    }


def zeitraumvergleich_zeilen(verlauf: dict) -> list[dict]:
    """Flache Tabellenzeilen für den Zeitraumvergleich-Export (Excel/PDF)."""
    return [_export_zeile(p, verlauf["granularitaet"]) for p in verlauf["punkte"]]


def _export_zeile(punkt: dict, granularitaet: Granularitaet) -> dict:
    vorjahr = punkt["vorjahr_eier"] or 0.0
    vorjahr_umsatz = punkt["vorjahr_umsatz"] or 0.0
    return {
        "zeitraum": verlauf_label(punkt["start"], granularitaet),
        "vorjahr": vorjahr,
        "jahr": punkt["eier"],
        "differenz": punkt["eier"] - vorjahr,
        "vorjahr_umsatz": vorjahr_umsatz,
        "jahr_umsatz": punkt["umsatz"],
        "differenz_umsatz": punkt["umsatz"] - vorjahr_umsatz,
    }
