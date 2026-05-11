"""Server-seitige Formatierungs-Helfer (deutsche Zahlen, Monatsnamen)."""
from __future__ import annotations

MONATSNAMEN_DE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
]


def monatsname(nr: int) -> str:
    """1 -> 'Januar', ..., 12 -> 'Dezember'."""
    if 1 <= nr <= 12:
        return MONATSNAMEN_DE[nr - 1]
    return str(nr)


def formatiere_zahl(wert: float | int | None, dezimal: int = 0) -> str:
    """Deutsche Zahl mit Tausenderpunkt und Komma als Dezimaltrenner."""
    if wert is None:
        return "—"
    formatted = f"{wert:,.{dezimal}f}"
    # 1,234,567.89 -> 1.234.567,89
    return formatted.replace(",", "X").replace(".", ",").replace("X", ".")


def formatiere_euro(wert: float | int | None) -> str:
    if wert is None:
        return "—"
    return f"{formatiere_zahl(wert, 2)} €"


__all__ = ["monatsname", "formatiere_zahl", "formatiere_euro", "MONATSNAMEN_DE"]
