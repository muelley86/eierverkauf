"""Konfigurations-Layer für die Eier-pro-Artikel-Faktoren.

Stellt Lese-/Schreib-Zugriff auf die `artikel_eier_konfiguration`-Tabelle bereit
und führt beim Speichern eine rückwirkende Neuberechnung der
`verkaufspositionen.eier_stueck`-Spalte aus, damit das Dashboard sofort die neuen
Werte zeigt.
"""
from __future__ import annotations

import sqlite3


def lade_eier_konfig(conn: sqlite3.Connection) -> dict[str, int | None]:
    """Mapping artikel_code -> faktor (oder None)."""
    rows = conn.execute(
        "SELECT artikel_code, faktor FROM artikel_eier_konfiguration"
    ).fetchall()
    return {row["artikel_code"]: row["faktor"] for row in rows}


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
    neu_berechnet = 0
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
            if faktor is None:
                cur = conn.execute(
                    "UPDATE verkaufspositionen SET eier_stueck = NULL "
                    "WHERE artikel_code = ?",
                    (artikel_code,),
                )
            else:
                cur = conn.execute(
                    "UPDATE verkaufspositionen "
                    "SET eier_stueck = CAST(menge * ? AS INTEGER) "
                    "WHERE artikel_code = ?",
                    (faktor, artikel_code),
                )
            neu_berechnet += cur.rowcount
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return neu_berechnet


__all__ = ["lade_eier_konfig", "speichere_eier_konfig"]
