"""CSV-Import: Parsing, Eiermenge-Berechnung, Artikelnormierung, DB-Insert.

Robustheit:
- Die Kopfzeile wird automatisch in den ersten 30 Zeilen gesucht (nach den
  Schlüsselwörtern Datum/Nummer/Kunde/Menge). Anzahl der Metazeilen davor
  ist egal.
- Die ersten 15 Spalten werden positionsbasiert auf kanonische Namen
  umbenannt — Bezeichnungen wie `#`, `#.1`, `#2` für die Pack-Code-Spalte
  spielen daher keine Rolle.
- Pro fehlerhafte Zeile wird ein konkreter Grund samt Zeilennummer
  protokolliert und an die UI durchgereicht.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

import pandas as pd

from .db import get_conn

# Spaltenreihenfolge gemäß Spezifikation. Die ersten N Spalten der CSV werden
# nach dem Lesen auf diese Namen umbenannt (positionsbasiert).
CANONICAL_COLUMNS: list[str] = [
    "Datum",          # 0
    "Nummer",         # 1  Rechnungsnummer
    "Kundennummer",   # 2  in der CSV: "#"
    "Kunde",          # 3  Kundenname
    "Mitarbeiter",    # 4  (wird ignoriert)
    "Menge",          # 5
    "Einheit",        # 6  stk / PACK / kg / leer
    "PackCode",       # 7  in der CSV: "#.1" oder "#2" — 110/111 oder leer
    "Beschreibung",   # 8
    "Preis",          # 9  "Preis/Einh."
    "Mwst",           # 10
    "Diesel",         # 11 "Diesel/Einh."
    "RabattRg",       # 12 "Rabatt Rg."
    "RabattPos",      # 13 "Rabatt Pos."
    "Gesamt",         # 14
]

# Schlüsselwörter, die in der Kopfzeile vorkommen müssen — für die
# automatische Header-Erkennung.
_HEADER_KEYWORDS = ("Datum", "Nummer", "Kunde", "Menge")

# Maximale Anzahl Fehlerdetails, die ans Frontend zurückgemeldet werden.
_FEHLER_DETAILS_MAX = 50


@dataclass
class ImportErgebnis:
    import_id: int
    zeilen_importiert: int
    zeilen_uebersprungen: int
    zeilen_fehlerhaft: int
    datumsbereich: str
    dateiname: str
    fehler_details: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "import_id": self.import_id,
            "zeilen_importiert": self.zeilen_importiert,
            "zeilen_uebersprungen": self.zeilen_uebersprungen,
            "zeilen_fehlerhaft": self.zeilen_fehlerhaft,
            "datumsbereich": self.datumsbereich,
            "dateiname": self.dateiname,
            "fehler_details": list(self.fehler_details),
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
    """Akzeptiert sowohl 'DD.MM.YY' als auch 'DD.MM.YYYY' -> 'YYYY-MM-DD'.

    Zweistellige Jahre werden immer als 20YY interpretiert (Eierverkäufe
    sind 21. Jh.).
    """
    if value is None:
        return None
    s = str(value).strip()
    if not s or s.lower() == "nan":
        return None
    # Vierstellig zuerst (präziser).
    try:
        dt = datetime.strptime(s, "%d.%m.%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass
    # Zweistellig — strptime nutzt POSIX-Cutoff (00–68 → 20XX, 69–99 → 19XX).
    # Wir zwingen alles ins 21. Jh.
    try:
        dt = datetime.strptime(s, "%d.%m.%y")
        if dt.year < 2000:
            dt = dt.replace(year=dt.year + 100)
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

def _finde_header_zeile(file_path: str | Path) -> int:
    """Sucht die Kopfzeile in den ersten 30 Zeilen und liefert ihren 0-basierten Index.

    Erkennt sie daran, dass `Datum`, `Nummer`, `Kunde` und `Menge` alle in
    derselben Zeile auftauchen. Wirft `ValueError`, wenn nichts gefunden wird.
    """
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as fp:
        for idx, line in enumerate(fp):
            if idx >= 30:
                break
            if all(kw in line for kw in _HEADER_KEYWORDS):
                return idx
    raise ValueError(
        "Kopfzeile nicht gefunden. Erwartet eine Zeile mit den Spalten "
        f"{', '.join(_HEADER_KEYWORDS)} in den ersten 30 Zeilen der CSV."
    )


def parse_csv(file_path: str | Path) -> pd.DataFrame:
    """Liest die CSV mit Semikolon-Trennzeichen und UTF-8-BOM.

    Die Anzahl der Metazeilen vor der Kopfzeile wird automatisch ermittelt
    (siehe `_finde_header_zeile`). Anschließend werden die ersten
    `len(CANONICAL_COLUMNS)` Spalten positionsbasiert auf kanonische Namen
    umbenannt, sodass Eigenheiten wie `#`/`#.1`/`#2` in der Pack-Code-Spalte
    irrelevant sind.
    """
    header_idx = _finde_header_zeile(file_path)
    df = pd.read_csv(
        str(file_path),
        sep=";",
        encoding="utf-8-sig",
        skiprows=header_idx,
        dtype=str,
        engine="python",
        on_bad_lines="skip",
    )
    df.columns = [str(c).strip() for c in df.columns]
    # Positionsbasiert umbenennen (überschreibt was-auch-immer in der Quelle).
    n = min(len(CANONICAL_COLUMNS), len(df.columns))
    df = df.rename(columns={df.columns[i]: CANONICAL_COLUMNS[i] for i in range(n)})
    # Komplett leere Zeilen entfernen (Pandas liest manchmal eine Schluss-Leerzeile mit).
    df = df.dropna(how="all").reset_index(drop=True)
    return df


def vorschau(file_path: str | Path, n: int = 10) -> list[dict]:
    """Liefert die ersten `n` geparsten Zeilen als Liste von Dicts (für Vorschau-UI)."""
    df = parse_csv(file_path)
    return df.head(n).fillna("").to_dict(orient="records")


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------

def _row_to_record(row: pd.Series) -> Tuple[Optional[dict], Optional[str]]:
    """Wandelt eine CSV-Zeile in einen Verkaufspositionen-Record um.

    Rückgabe: ``(record, None)`` bei Erfolg, ``(None, grund)`` bei Fehler.
    """
    datum_raw = row.get("Datum")
    datum = parse_german_date(datum_raw)
    if datum is None:
        return None, f"Datum '{datum_raw}' nicht erkannt (erwartet DD.MM.YY oder DD.MM.YYYY)"

    menge_raw = row.get("Menge")
    menge = parse_german_number(menge_raw)
    if menge is None:
        return None, f"Menge '{menge_raw}' nicht numerisch"

    kundennummer = (str(row.get("Kundennummer") or "")).strip()
    if not kundennummer:
        return None, "Kundennummer fehlt"
    kundenname = (str(row.get("Kunde") or "")).strip()
    if not kundenname:
        return None, "Kundenname fehlt"

    einheit_raw = (str(row.get("Einheit") or "")).strip()
    einheit = einheit_raw if einheit_raw else None

    pack_code_raw = (str(row.get("PackCode") or "")).strip()
    pack_code: Optional[int] = None
    if pack_code_raw and pack_code_raw.lower() != "nan":
        try:
            pack_code = int(float(pack_code_raw))
        except ValueError:
            # Pack-Code unleserlich — Zeile importieren wir trotzdem (eier_stueck
            # bleibt None). Kein harter Fehler.
            pack_code = None

    beschreibung = (str(row.get("Beschreibung") or "")).strip()
    eier = berechne_eier(menge, einheit, pack_code)
    artikel_code = normiere_artikel(einheit, pack_code, beschreibung)
    groesse = extrahiere_groesse(beschreibung)
    preis = parse_german_number(row.get("Preis"))
    gesamt = parse_german_number(row.get("Gesamt"))
    rechnungsnummer = (str(row.get("Nummer") or "")).strip() or None

    return (
        {
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
        },
        None,
    )


def import_csv(file_path: str | Path, dateiname: str) -> ImportErgebnis:
    """Parst eine CSV-Datei und schreibt die Verkaufspositionen in die DB.

    Duplikate (gemäß UNIQUE-Constraint) werden via INSERT OR IGNORE übersprungen
    und gezählt — kein Fehler. Fehlerhafte Zeilen werden gezählt UND die ersten
    `_FEHLER_DETAILS_MAX` Gründe samt Zeilennummer protokolliert.
    """
    df = parse_csv(file_path)
    records: list[dict] = []
    fehlerhaft = 0
    fehler_details: list[str] = []

    for pandas_idx, row in df.iterrows():
        rec, grund = _row_to_record(row)
        if rec is None:
            fehlerhaft += 1
            if len(fehler_details) < _FEHLER_DETAILS_MAX:
                # +2: pandas-Index ist 0-basiert auf Daten, plus eine Zeile für
                # den Header — entspricht der ungefähren Zeilennummer in Excel.
                csv_zeile = int(pandas_idx) + 2
                fehler_details.append(f"Zeile {csv_zeile}: {grund}")
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
        fehler_details=fehler_details,
    )


__all__ = [
    "ImportErgebnis",
    "parse_german_number", "parse_german_date",
    "berechne_eier", "normiere_artikel", "extrahiere_groesse",
    "parse_csv", "vorschau", "import_csv",
]
