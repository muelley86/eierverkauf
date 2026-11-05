"""Zeitraumabhängiger Verlauf für die Dashboard-Grafik (seit v1.16.0).

Reine Funktionen ohne DB-Zugriff: Tageswerte werden in Buckets (Tag, Woche,
Monat) zusammengefasst. Buckets liegen **relativ zu ``von``**, damit der um ein
Jahr verschobene Vorjahreszeitraum positionsgleich daneben gelegt werden kann.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

Granularitaet = Literal["tag", "woche", "monat"]

MAX_TAGE_TAGESWERTE = 62      # bis ~2 Monate: ein Balken pro Tag
MAX_TAGE_WOCHENWERTE = 183    # bis ~6 Monate: ein Balken pro Woche
TAGE_PRO_WOCHE = 7


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
    """Fasst ``[{datum, eier, umsatz}]`` zu lückenlosen Buckets zusammen.

    Werte außerhalb ``[von, bis]`` werden ignoriert; leere Buckets erhalten 0.
    Die Eingabe wird nicht verändert.
    """
    anzahl = _bucket_index(bis, von, granularitaet) + 1
    eier = [0.0] * anzahl
    umsatz = [0.0] * anzahl
    for wert in tageswerte:
        tag = date.fromisoformat(wert["datum"])
        if not von <= tag <= bis:
            continue
        i = _bucket_index(tag, von, granularitaet)
        eier[i] += float(wert["eier"] or 0)
        umsatz[i] += float(wert["umsatz"] or 0)
    return [
        {
            "start": _bucket_start(i, von, granularitaet).isoformat(),
            "eier": eier[i],
            "umsatz": umsatz[i],
        }
        for i in range(anzahl)
    ]
