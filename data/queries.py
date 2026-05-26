"""Alle SQL-Abfragen für Auswertungen. Reine Datenzugriffsschicht."""
from __future__ import annotations

from typing import Optional

from .db import get_conn

# Filter-Helper -------------------------------------------------------------

def _zeitraum_filter(von: Optional[str], bis: Optional[str], prefix: str = "WHERE") -> tuple[str, list]:
    """Liefert SQL-Snippet '<prefix> rechnungsdatum BETWEEN ? AND ?' + Parameter."""
    if von and bis:
        return f" {prefix} rechnungsdatum BETWEEN ? AND ? ", [von, bis]
    if von:
        return f" {prefix} rechnungsdatum >= ? ", [von]
    if bis:
        return f" {prefix} rechnungsdatum <= ? ", [bis]
    return "", []


def _row_to_dict(row) -> dict:
    return {k: row[k] for k in row.keys()}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

def dashboard_kpis(von: Optional[str], bis: Optional[str]) -> dict:
    """KPI-Kacheln: Gesamteier, Umsatz, Anzahl Kunden, Anzahl Positionen."""
    wh, params = _zeitraum_filter(von, bis)
    sql = f"""
        SELECT
            COALESCE(SUM(eier_stueck), 0)              AS gesamt_eier,
            COALESCE(SUM(gesamt), 0)                   AS umsatz,
            COUNT(DISTINCT kundennummer)               AS anzahl_kunden,
            COUNT(*)                                   AS anzahl_positionen
        FROM verkaufspositionen
        {wh}
    """
    conn = get_conn()
    try:
        row = conn.execute(sql, params).fetchone()
        return _row_to_dict(row) if row else {}
    finally:
        conn.close()


def top5_kunden(von: Optional[str], bis: Optional[str]) -> list[dict]:
    wh, params = _zeitraum_filter(von, bis)
    sql = f"""
        SELECT kundennummer, kundenname,
               COALESCE(SUM(eier_stueck), 0) AS eier,
               COALESCE(SUM(gesamt), 0)      AS umsatz
        FROM verkaufspositionen
        {wh}
        GROUP BY kundennummer, kundenname
        ORDER BY eier DESC
        LIMIT 5
    """
    conn = get_conn()
    try:
        return [_row_to_dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def top5_artikel(von: Optional[str], bis: Optional[str]) -> list[dict]:
    wh, params = _zeitraum_filter(von, bis)
    sql = f"""
        SELECT artikel_code,
               COALESCE(SUM(eier_stueck), 0) AS eier,
               COALESCE(SUM(menge), 0)       AS menge,
               COALESCE(SUM(gesamt), 0)      AS umsatz
        FROM verkaufspositionen
        {wh}
        GROUP BY artikel_code
        ORDER BY eier DESC
        LIMIT 5
    """
    conn = get_conn()
    try:
        return [_row_to_dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Kunden
# ---------------------------------------------------------------------------

def kunden_uebersicht(von: Optional[str], bis: Optional[str]) -> list[dict]:
    wh, params = _zeitraum_filter(von, bis)
    sql = f"""
        SELECT kundennummer, kundenname,
               COALESCE(SUM(eier_stueck), 0) AS eier,
               COALESCE(SUM(gesamt), 0)      AS umsatz,
               COUNT(*)                       AS positionen,
               MAX(rechnungsdatum)            AS letzter_kauf
        FROM verkaufspositionen
        {wh}
        GROUP BY kundennummer, kundenname
        ORDER BY eier DESC
    """
    conn = get_conn()
    try:
        return [_row_to_dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def kunde_monate(kundennummer: str, von: Optional[str], bis: Optional[str]) -> list[dict]:
    wh, params = _zeitraum_filter(von, bis, prefix="AND")
    sql = f"""
        SELECT substr(rechnungsdatum, 1, 7) AS monat,
               COALESCE(SUM(eier_stueck), 0) AS eier,
               COALESCE(SUM(gesamt), 0)      AS umsatz,
               COUNT(*)                       AS positionen
        FROM verkaufspositionen
        WHERE kundennummer = ?
        {wh}
        GROUP BY monat
        ORDER BY monat
    """
    conn = get_conn()
    try:
        return [_row_to_dict(r) for r in conn.execute(sql, [kundennummer, *params]).fetchall()]
    finally:
        conn.close()


def kunde_jahresvergleich(kundennummer: str, jahr: int) -> list[dict]:
    """12 Zeilen (Monat 1..12) mit Werten Jahr + Vorjahr."""
    sql = """
        SELECT CAST(substr(rechnungsdatum, 6, 2) AS INTEGER) AS monat,
               CAST(substr(rechnungsdatum, 1, 4) AS INTEGER) AS jahr,
               COALESCE(SUM(eier_stueck), 0) AS eier,
               COALESCE(SUM(gesamt), 0)      AS umsatz
        FROM verkaufspositionen
        WHERE kundennummer = ?
          AND substr(rechnungsdatum, 1, 4) IN (?, ?)
        GROUP BY monat, jahr
        ORDER BY monat, jahr
    """
    conn = get_conn()
    try:
        rows = conn.execute(sql, [kundennummer, str(jahr), str(jahr - 1)]).fetchall()
    finally:
        conn.close()

    daten: dict[int, dict] = {m: {"monat": m, "jahr": 0.0, "vorjahr": 0.0,
                                  "jahr_umsatz": 0.0, "vorjahr_umsatz": 0.0,
                                  "differenz": 0.0, "differenz_umsatz": 0.0} for m in range(1, 13)}
    for r in rows:
        m = r["monat"]
        if r["jahr"] == jahr:
            daten[m]["jahr"] = float(r["eier"])
            daten[m]["jahr_umsatz"] = float(r["umsatz"])
        else:
            daten[m]["vorjahr"] = float(r["eier"])
            daten[m]["vorjahr_umsatz"] = float(r["umsatz"])
    for d in daten.values():
        d["differenz"] = d["jahr"] - d["vorjahr"]
        d["differenz_umsatz"] = d["jahr_umsatz"] - d["vorjahr_umsatz"]
    return list(daten.values())


# ---------------------------------------------------------------------------
# Artikel
# ---------------------------------------------------------------------------

def artikel_uebersicht(von: Optional[str], bis: Optional[str]) -> list[dict]:
    wh, params = _zeitraum_filter(von, bis)
    sql = f"""
        SELECT artikel_code,
               COALESCE(SUM(menge), 0)       AS menge,
               COALESCE(SUM(eier_stueck), 0) AS eier,
               COALESCE(SUM(gesamt), 0)      AS umsatz,
               COUNT(*)                       AS positionen
        FROM verkaufspositionen
        {wh}
        GROUP BY artikel_code
        ORDER BY umsatz DESC
    """
    conn = get_conn()
    try:
        return [_row_to_dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def artikel_monate(code: str, von: Optional[str], bis: Optional[str]) -> list[dict]:
    wh, params = _zeitraum_filter(von, bis, prefix="AND")
    sql = f"""
        SELECT substr(rechnungsdatum, 1, 7) AS monat,
               COALESCE(SUM(menge), 0)       AS menge,
               COALESCE(SUM(eier_stueck), 0) AS eier,
               COALESCE(SUM(gesamt), 0)      AS umsatz
        FROM verkaufspositionen
        WHERE artikel_code = ?
        {wh}
        GROUP BY monat
        ORDER BY monat
    """
    conn = get_conn()
    try:
        return [_row_to_dict(r) for r in conn.execute(sql, [code, *params]).fetchall()]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Belege
# ---------------------------------------------------------------------------

def belege_uebersicht(von: Optional[str], bis: Optional[str]) -> list[dict]:
    """Aggregat pro Rechnung: Eier, Umsatz, Positionen. Sortiert nach Eier DESC.

    Gruppierung schließt ``rechnungsdatum`` ein, weil der UNIQUE-Constraint ab
    v1.0.4 das Datum mit umfasst — derselbe Rechnungsnummer-String an einem
    anderen Tag wird bewusst als separater Beleg geführt.
    """
    wh, params = _zeitraum_filter(von, bis)
    sql = f"""
        SELECT rechnungsnummer,
               rechnungsdatum,
               kundennummer,
               kundenname,
               COALESCE(SUM(eier_stueck), 0) AS eier,
               COALESCE(SUM(gesamt), 0)      AS umsatz,
               COUNT(*)                       AS positionen
        FROM verkaufspositionen
        {wh}
        GROUP BY rechnungsnummer, rechnungsdatum, kundennummer, kundenname
        ORDER BY eier DESC, rechnungsdatum DESC
    """
    conn = get_conn()
    try:
        return [_row_to_dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def beleg_positionen(rechnungsnummer: str, rechnungsdatum: str) -> list[dict]:
    """Einzelne Positionen eines Belegs (gleiche Rechnungsnummer + gleiches Datum)."""
    sql = """
        SELECT artikel_code, beschreibung, menge, einheit, pack_code,
               eier_stueck, preis_einheit, gesamt
        FROM verkaufspositionen
        WHERE rechnungsnummer = ? AND rechnungsdatum = ?
        ORDER BY id
    """
    conn = get_conn()
    try:
        return [_row_to_dict(r) for r in conn.execute(sql, (rechnungsnummer, rechnungsdatum)).fetchall()]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Ranking & Jahresvergleich
# ---------------------------------------------------------------------------

def ranking(von: Optional[str], bis: Optional[str], sort: str = "menge") -> list[dict]:
    wh, params = _zeitraum_filter(von, bis)
    order_col = "umsatz" if sort == "umsatz" else "eier"
    sql = f"""
        SELECT kundennummer, kundenname,
               COALESCE(SUM(eier_stueck), 0) AS eier,
               COALESCE(SUM(gesamt), 0)      AS umsatz
        FROM verkaufspositionen
        {wh}
        GROUP BY kundennummer, kundenname
        ORDER BY {order_col} DESC
    """
    conn = get_conn()
    try:
        return [_row_to_dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def jahresvergleich(jahr: int) -> list[dict]:
    """Gesamt-Jahresvergleich Monat 1..12, Jahr vs. Vorjahr."""
    sql = """
        SELECT CAST(substr(rechnungsdatum, 6, 2) AS INTEGER) AS monat,
               CAST(substr(rechnungsdatum, 1, 4) AS INTEGER) AS jahr,
               COALESCE(SUM(eier_stueck), 0) AS eier,
               COALESCE(SUM(gesamt), 0)      AS umsatz
        FROM verkaufspositionen
        WHERE substr(rechnungsdatum, 1, 4) IN (?, ?)
        GROUP BY monat, jahr
        ORDER BY monat, jahr
    """
    conn = get_conn()
    try:
        rows = conn.execute(sql, [str(jahr), str(jahr - 1)]).fetchall()
    finally:
        conn.close()
    daten: dict[int, dict] = {m: {"monat": m, "jahr": 0.0, "vorjahr": 0.0,
                                  "jahr_umsatz": 0.0, "vorjahr_umsatz": 0.0,
                                  "differenz": 0.0, "differenz_umsatz": 0.0} for m in range(1, 13)}
    for r in rows:
        m = r["monat"]
        if r["jahr"] == jahr:
            daten[m]["jahr"] = float(r["eier"])
            daten[m]["jahr_umsatz"] = float(r["umsatz"])
        else:
            daten[m]["vorjahr"] = float(r["eier"])
            daten[m]["vorjahr_umsatz"] = float(r["umsatz"])
    for d in daten.values():
        d["differenz"] = d["jahr"] - d["vorjahr"]
        d["differenz_umsatz"] = d["jahr_umsatz"] - d["vorjahr_umsatz"]
    return list(daten.values())


# ---------------------------------------------------------------------------
# Import-Verwaltung
# ---------------------------------------------------------------------------

def import_historie() -> list[dict]:
    sql = "SELECT * FROM imports ORDER BY id DESC"
    conn = get_conn()
    try:
        return [_row_to_dict(r) for r in conn.execute(sql).fetchall()]
    finally:
        conn.close()


def import_loeschen(import_id: int) -> int:
    """Löscht einen Import inkl. zugehöriger Verkaufspositionen (CASCADE)."""
    conn = get_conn()
    try:
        cur = conn.execute("DELETE FROM imports WHERE id = ?", (import_id,))
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def import_eintrag(import_id: int) -> Optional[dict]:
    """Einzelner Import-Eintrag (gleicher Shape wie ein Element aus ``import_historie``)."""
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM imports WHERE id = ?", (import_id,)).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def protokoll_zeilen(import_id: int, status: str) -> list[dict]:
    """Liefert alle Protokoll-Zeilen eines Imports mit gegebenem Status.

    ``status`` ist entweder ``'fehler'`` oder ``'duplikat'``. Sortiert nach
    CSV-Zeilennummer.
    """
    sql = """
        SELECT csv_zeile, grund, rohdaten
        FROM import_zeilen_protokoll
        WHERE import_id = ? AND status = ?
        ORDER BY csv_zeile
    """
    conn = get_conn()
    try:
        return [_row_to_dict(r) for r in conn.execute(sql, (import_id, status)).fetchall()]
    finally:
        conn.close()


def stammdaten_kunde(kundennummer: str) -> Optional[dict]:
    sql = """
        SELECT kundennummer, kundenname,
               MIN(rechnungsdatum) AS erster_kauf,
               MAX(rechnungsdatum) AS letzter_kauf,
               COUNT(*)            AS positionen
        FROM verkaufspositionen
        WHERE kundennummer = ?
        GROUP BY kundennummer, kundenname
    """
    conn = get_conn()
    try:
        row = conn.execute(sql, (kundennummer,)).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


__all__ = [
    "dashboard_kpis", "top5_kunden", "top5_artikel",
    "kunden_uebersicht", "kunde_monate", "kunde_jahresvergleich",
    "artikel_uebersicht", "artikel_monate",
    "belege_uebersicht", "beleg_positionen",
    "ranking", "jahresvergleich",
    "import_historie", "import_loeschen", "import_eintrag", "protokoll_zeilen",
    "stammdaten_kunde",
]
