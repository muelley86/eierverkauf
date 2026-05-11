"""CSV-Import: Parsing, Eiermenge-Berechnung, Artikelnormierung, DB-Insert."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd

from .db import get_conn

# Erwartete Spaltennamen in Zeile 8 der CSV (nach skiprows=7).
ERWARTETE_SPALTEN = [
    "Datum", "Nummer", "#", "Kunde", "Mitarbeiter",
    "Menge", "Einheit", "#.1", "Beschreibung",
    "Preis/Einh.", "Mwst.", "Diesel/Einh.",
    "Rabatt Rg.", "Rabatt Pos.", "Gesamt",
]


@dataclass
class ImportErgebnis:
    import_id: int
    zeilen_importiert: int
    zeilen_uebersprungen: int
    zeilen_fehlerhaft: int
    datumsbereich: str
    dateiname: str

    def as_dict(self) -> dict:
        return {
            "import_id": self.import_id,
            "zeilen_importiert": self.zeilen_importiert,
            "zeilen_uebersprungen": self.zeilen_uebersprungen,
            "zeilen_fehlerhaft": self.zeilen_fehlerhaft,
            "datumsbereich": self.datumsbereich,
            "dateiname": self.dateiname,
        }


# ---------------------------------------------------------------------------
# Parsing-Hilfsfunktionen
# ---------------------------------------------------------------------------

def parse_german_number(value: object) -> Optional[float]:
    """'1.080,000' -> 1080.0  |  '12,50' -> 12.5  |  leer/NaN -> None."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and pd.isna(value):
            return None
        return float(value)
    s = str(value).strip()
    if not s or s.lower() in ("nan", "none", "-"):
        return None
    # Punkte sind Tausendertrenner, Komma ist Dezimaltrenner.
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def parse_german_date(value: object) -> Optional[str]:
    """'DD.MM.YY' -> 'YYYY-MM-DD' (alle Jahre als 20YY interpretiert)."""
    if value is None:
        return None
    s = str(value).strip()
    if not s or s.lower() == "nan":
        return None
    try:
        dt = datetime.strptime(s, "%d.%m.%y")
        # strptime ergibt 19YY bei großen Werten; auf 20YY normalisieren.
        if dt.year < 2000:
            dt = dt.replace(year=dt.year + 100)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        # Fallback: vierstelliges Jahr.
        try:
            dt = datetime.strptime(s, "%d.%m.%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            return None


def berechne_eier(menge: float, einheit: Optional[str], pack_code: Optional[int]) -> Optional[int]:
    """Anzahl Eier aus Menge + Einheit + Pack-Code ableiten.

    PACK 110 -> Menge x 10  (10er-Verpackung)
    PACK 111 -> Menge x 6   (6er-Verpackung)
    stk      -> Menge x 1
    kg       -> None (keine Stückzahl-Aussage)
    """
    if menge is None:
        return None
    e = (einheit or "").strip()
    if e.upper() == "PACK":
        if pack_code == 110:
            return int(menge * 10)
        if pack_code == 111:
            return int(menge * 6)
        return None
    if e.lower() == "stk":
        return int(menge)
    if e.lower() == "kg":
        return None
    # Default (leere Einheit): Stückzahl annehmen.
    return int(menge)


def normiere_artikel(einheit: Optional[str], pack_code: Optional[int], beschreibung: str) -> str:
    """Liefert einheitlichen Artikel-Code gemäß Spezifikation."""
    b = (beschreibung or "").lower()
    e = (einheit or "").strip()
    if pack_code == 110:
        return "10er Kvp"
    if pack_code == 111:
        return "6er Kvp"
    if e.lower() == "kg":
        return "Gewicht (kg)"
    if e.lower() == "stk":
        if "180 lose" in b or "180lose" in b:
            return "Lose 180"
        if "unsortiert" in b:
            return "Lose unsortiert"
        if "20" in b and "180" not in b:
            return "Lose 20"
    return "Sonstige"


_GROESSEN_RE = re.compile(r"\b(XL|L|M|S)\b", re.IGNORECASE)


def extrahiere_groesse(beschreibung: str) -> Optional[str]:
    if not beschreibung:
        return None
    m = _GROESSEN_RE.search(beschreibung)
    return m.group(1).upper() if m else None


# ---------------------------------------------------------------------------
# CSV-Parsing
# ---------------------------------------------------------------------------

def parse_csv(file_path: str | Path) -> pd.DataFrame:
    """Liest die CSV mit Semikolon-Trennzeichen, UTF-8-BOM und 7 Metazeilen."""
    df = pd.read_csv(
        str(file_path),
        sep=";",
        encoding="utf-8-sig",
        skiprows=7,
        dtype=str,
        engine="python",
        on_bad_lines="skip",
    )
    df.columns = [c.strip() for c in df.columns]
    return df


def vorschau(file_path: str | Path, n: int = 10) -> list[dict]:
    """Liefert die ersten `n` geparsten Zeilen als Liste von Dicts (für Vorschau-UI)."""
    df = parse_csv(file_path)
    return df.head(n).fillna("").to_dict(orient="records")


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------

def _row_to_record(row: pd.Series) -> Optional[dict]:
    """Wandelt eine CSV-Zeile in den Verkaufspositionen-Record. Liefert None bei unbrauchbarer Zeile."""
    datum = parse_german_date(row.get("Datum"))
    menge = parse_german_number(row.get("Menge"))
    if datum is None or menge is None:
        return None
    kundennummer = (str(row.get("#") or "")).strip()
    kundenname = (str(row.get("Kunde") or "")).strip()
    if not kundennummer or not kundenname:
        return None
    einheit_raw = (str(row.get("Einheit") or "")).strip()
    einheit = einheit_raw if einheit_raw else None
    pack_code_raw = (str(row.get("#.1") or "")).strip()
    pack_code: Optional[int] = None
    if pack_code_raw and pack_code_raw.lower() != "nan":
        try:
            pack_code = int(float(pack_code_raw))
        except ValueError:
            pack_code = None
    beschreibung = (str(row.get("Beschreibung") or "")).strip()
    eier = berechne_eier(menge, einheit, pack_code)
    artikel_code = normiere_artikel(einheit, pack_code, beschreibung)
    groesse = extrahiere_groesse(beschreibung)
    preis = parse_german_number(row.get("Preis/Einh."))
    gesamt = parse_german_number(row.get("Gesamt"))
    rechnungsnummer = (str(row.get("Nummer") or "")).strip() or None
    return {
        "rechnungsdatum": datum,
        "rechnungsnummer": rechnungsnummer,
        "kundennummer": kundennummer,
        "kundenname": kundenname,
        "menge": menge,
        "einheit": einheit,
        "pack_code": pack_code,
        "eier_stueck": eier,
        "artikel_code": artikel_code,
        "groesse": groesse,
        "beschreibung": beschreibung,
        "preis_einheit": preis,
        "gesamt": gesamt,
    }


def import_csv(file_path: str | Path, dateiname: str) -> ImportErgebnis:
    """Parst eine CSV-Datei und schreibt die Verkaufspositionen in die DB.

    Duplikate (gemäß UNIQUE-Constraint) werden via INSERT OR IGNORE übersprungen
    und gezählt — kein Fehler.
    """
    df = parse_csv(file_path)
    records: list[dict] = []
    fehlerhaft = 0
    for _, row in df.iterrows():
        rec = _row_to_record(row)
        if rec is None:
            fehlerhaft += 1
            continue
        records.append(rec)

    # Datumsbereich für die Import-Tabelle
    daten = sorted(r["rechnungsdatum"] for r in records)
    datumsbereich = f"{daten[0]} – {daten[-1]}" if daten else "—"

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO imports
                 (import_datum, dateiname, datumsbereich,
                  zeilen_importiert, zeilen_uebersprungen, zeilen_fehlerhaft)
               VALUES (?, ?, ?, 0, 0, ?)""",
            (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), dateiname, datumsbereich, fehlerhaft),
        )
        import_id = int(cur.lastrowid)

        importiert = 0
        uebersprungen = 0
        for rec in records:
            cur.execute(
                """INSERT OR IGNORE INTO verkaufspositionen
                     (import_id, rechnungsdatum, rechnungsnummer, kundennummer, kundenname,
                      menge, einheit, pack_code, eier_stueck, artikel_code, groesse,
                      beschreibung, preis_einheit, gesamt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    import_id,
                    rec["rechnungsdatum"], rec["rechnungsnummer"],
                    rec["kundennummer"], rec["kundenname"],
                    rec["menge"], rec["einheit"], rec["pack_code"], rec["eier_stueck"],
                    rec["artikel_code"], rec["groesse"], rec["beschreibung"],
                    rec["preis_einheit"], rec["gesamt"],
                ),
            )
            if cur.rowcount == 1:
                importiert += 1
            else:
                uebersprungen += 1

        cur.execute(
            "UPDATE imports SET zeilen_importiert = ?, zeilen_uebersprungen = ? WHERE id = ?",
            (importiert, uebersprungen, import_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return ImportErgebnis(
        import_id=import_id,
        zeilen_importiert=importiert,
        zeilen_uebersprungen=uebersprungen,
        zeilen_fehlerhaft=fehlerhaft,
        datumsbereich=datumsbereich,
        dateiname=dateiname,
    )


__all__ = [
    "ImportErgebnis",
    "parse_german_number", "parse_german_date",
    "berechne_eier", "normiere_artikel", "extrahiere_groesse",
    "parse_csv", "vorschau", "import_csv",
]
