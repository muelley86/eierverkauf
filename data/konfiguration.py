"""Konfigurations-Layer für die Eier-pro-Artikel-Faktoren.

Stellt Lese-/Schreib-Zugriff auf die `artikel_eier_konfiguration`-Tabelle bereit
und führt beim Speichern eine rückwirkende Neuberechnung der
`verkaufspositionen.eier_stueck`-Spalte aus, damit das Dashboard sofort die neuen
Werte zeigt.
"""
from __future__ import annotations

import sqlite3

# SQL-Spiegel von `berechne_eier()` in data/importer.py — beide müssen synchron
# bleiben! Die Einheit entscheidet, was `menge` zählt; der konfigurierbare
# Faktor greift nur bei Einheit PACK:
#   kg         → NULL (keine Stückzahl-Aussage)
#   PACK       → menge × faktor(artikel_code); Faktor NULL/unbekannt → NULL
#   stk / leer → menge × 1 (Menge zählt bereits einzelne Eier)
EIER_STUECK_CASE_SQL = """CASE
    WHEN LOWER(TRIM(COALESCE(einheit, ''))) = 'kg' THEN NULL
    WHEN UPPER(TRIM(COALESCE(einheit, ''))) = 'PACK' THEN
        (SELECT CAST(verkaufspositionen.menge * k.faktor AS INTEGER)
           FROM artikel_eier_konfiguration k
          WHERE k.artikel_code = verkaufspositionen.artikel_code)
    ELSE CAST(menge AS INTEGER)
END"""


def lade_eier_konfig(conn: sqlite3.Connection) -> dict[str, int | None]:
    """Mapping artikel_code -> faktor (oder None)."""
    rows = conn.execute(
        "SELECT artikel_code, faktor FROM artikel_eier_konfiguration"
    ).fetchall()
    return {row["artikel_code"]: row["faktor"] for row in rows}


def berechne_eier_stueck_neu(conn: sqlite3.Connection) -> int:
    """Berechnet `eier_stueck` für alle Belege aus der aktuellen Konfiguration neu.

    Returns:
        Anzahl der neu berechneten Zeilen in `verkaufspositionen`.

    Kein eigenes Commit — läuft in der Transaktion des Aufrufers.
    """
    cur = conn.execute(
        f"UPDATE verkaufspositionen SET eier_stueck = {EIER_STUECK_CASE_SQL}"
    )
    return cur.rowcount


def speichere_eier_konfig(
    conn: sqlite3.Connection,
    neu: dict[str, int | None],
) -> int:
    """Schreibt die übergebenen Faktoren und berechnet `eier_stueck` neu.

    Returns:
        Anzahl der neu berechneten Belege in `verkaufspositionen`.

    Eine Transaktion umschließt UPSERT + UPDATE, damit Konfig und Daten konsistent
    bleiben. Bei Fehler Rollback.
    """
    try:
        conn.execute("BEGIN")
        for artikel_code, faktor in neu.items():
            conn.execute(
                """INSERT INTO artikel_eier_konfiguration (artikel_code, faktor)
                   VALUES (?, ?)
                   ON CONFLICT(artikel_code) DO UPDATE SET
                     faktor = excluded.faktor,
                     aktualisiert_am = CURRENT_TIMESTAMP""",
                (artikel_code, faktor),
            )
        neu_berechnet = berechne_eier_stueck_neu(conn)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return neu_berechnet


__all__ = [
    "EIER_STUECK_CASE_SQL",
    "lade_eier_konfig",
    "berechne_eier_stueck_neu",
    "speichere_eier_konfig",
]
