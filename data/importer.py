"""CSV-Import: Parsing, Eiermenge-Berechnung, Artikelnormierung, DB-Insert.

Robustheit:
- Die Kopfzeile wird automatisch in den ersten 30 Zeilen gesucht (nach den
  Schlüsselwörtern Datum/Nummer/Kunde/Menge). Anzahl der Metazeilen davor
  ist egal.
- Die kanonischen Spalten werden **anhand des Header-Textes** zugeordnet
  (Substring-Match, case-insensitive). Für `#`/`#.1`/`#2` greift ein
  Positions-Fallback (erstes Vorkommen = Kundennummer, zweites = PackCode).
  Dadurch ist die Reihenfolge nicht mehr fix vorgegeben.
- Pro fehlerhafte oder übersprungene Zeile wird ein Eintrag in
  ``import_zeilen_protokoll`` persistiert (CSV-Zeilennummer, Grund, Rohdaten).
  Über die Detail-Seite ``/import/:id`` nachträglich einsehbar.
- Fehlende *kritische* Header (Datum, Kunde, Menge, Einheit, Beschreibung,
  Kundennummer) brechen den Import sofort mit klarer Fehlermeldung ab.
  Fehlende *wichtige* Header (Gesamt, Nummer, PackCode) werden als Warnung
  in ``ImportErgebnis.header_warnungen`` zurückgemeldet.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

import pandas as pd

from .db import get_conn

# Substring-Keywords je kanonischem Namen (alle lowercase). Erste Übereinstimmung
# mit einer noch nicht zugeordneten Quellspalte gewinnt.
#
# Reihenfolge dieser dict-Einträge = Verarbeitungs-Priorität. Spezifischere
# kanonische Namen müssen VOR ihren weniger spezifischen Geschwistern stehen
# (z.B. "Kundennummer" vor "Nummer", "Kundennummer" vor "Kunde"), damit das
# Substring-Matching nicht versehentlich die falsche Spalte beansprucht.
HEADER_PATTERNS: dict[str, list[str]] = {
    "Datum":         ["datum"],
    # Kundennummer ZUERST: ein Header "Kundennummer" enthält "nummer" und würde
    # sonst von "Nummer" beansprucht.
    "Kundennummer":  ["kundennummer", "kunden-nr", "kunden nr", "kunden_nr",
                      "kdn-nr", "kdn-nummer", "kdnnr", "kdnr"],
    "Nummer":        ["rechnungsnummer", "rechnungsnr", "rg-nr", "rg.nr",
                      "belegnr", "beleg-nr", "nummer"],
    "Kunde":         ["kundenname", "kunde", "name"],
    "Mitarbeiter":   ["mitarb", "vertreter"],
    "Menge":         ["menge", "anzahl"],
    "Einheit":       ["einheit", "einh"],
    # PackCode: in der Quelle oft nur "#.1"/"#2" (literal) — positionsbasierter
    # Fallback unten greift das zweite literale "#". Header-Keywords decken
    # benannte Varianten ab.
    "PackCode":      ["pack-code", "packcode", "pack", "art-nr", "artikelnr",
                      "artikelnummer"],
    "Beschreibung":  ["beschreibung", "bezeichnung", "artikel"],
    "Preis":         ["preis"],
    "Mwst":          ["mwst", "ust"],
    "Diesel":        ["diesel"],
    "RabattRg":      ["rabatt rg", "rabatt rech", "rabatt-rg"],
    "RabattPos":     ["rabatt pos", "rabatt-pos"],
    "Gesamt":        ["gesamt", "betrag", "summe"],
}

# Kanonische Namen, ohne die der Import nicht funktionieren kann — fehlt einer,
# Abbruch mit ValueError.
REQUIRED_CANONICALS: set[str] = {
    "Datum", "Kundennummer", "Kunde", "Menge", "Einheit", "Beschreibung",
}

# Kanonische Namen, deren Fehlen den Import nicht verhindert, aber zur Warnung
# im UI führen (z.B. kein Umsatz ohne "Gesamt", keine Eierberechnung ohne
# "PackCode" für PACK-Zeilen).
WICHTIGE_CANONICALS: set[str] = {"Gesamt", "Nummer", "PackCode"}

# Schlüsselwörter, die in der Kopfzeile vorkommen müssen — für die
# automatische Header-Erkennung (Suche nach der Header-Zeile in den
# ersten 30 Zeilen).
_HEADER_KEYWORDS = ("Datum", "Nummer", "Kunde", "Menge")

# Maximale Anzahl Fehlerdetails, die direkt in der Upload-Response landen
# (Backward-Compat zur Anzeige in Import.tsx). Vollständige Protokoll-Daten
# stehen über GET /imports/{id} zur Verfügung.
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
    header_warnungen: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "import_id": self.import_id,
            "zeilen_importiert": self.zeilen_importiert,
            "zeilen_uebersprungen": self.zeilen_uebersprungen,
            "zeilen_fehlerhaft": self.zeilen_fehlerhaft,
            "datumsbereich": self.datumsbereich,
            "dateiname": self.dateiname,
            "fehler_details": list(self.fehler_details),
            "header_warnungen": list(self.header_warnungen),
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

    Erkennt sie daran, dass ``datum``, ``nummer``, ``kunde`` und ``menge``
    (case-insensitive) alle in derselben Zeile auftauchen. Wirft
    ``ValueError``, wenn nichts gefunden wird.
    """
    keywords_lower = [kw.lower() for kw in _HEADER_KEYWORDS]
    with open(file_path, "r", encoding="utf-8-sig", errors="replace") as fp:
        for idx, line in enumerate(fp):
            if idx >= 30:
                break
            line_lower = line.lower()
            if all(kw in line_lower for kw in keywords_lower):
                return idx
    raise ValueError(
        "Kopfzeile nicht gefunden. Erwartet eine Zeile mit den Spalten "
        f"{', '.join(_HEADER_KEYWORDS)} in den ersten 30 Zeilen der CSV."
    )


def _zuordne_spalten(headers: list[str]) -> Tuple[dict[int, str], list[str]]:
    """Mappt CSV-Spaltenindex → kanonischer Name anhand der Header-Texte.

    Strategie:
      1. Pandas hängt bei doppelten Spaltennamen automatisch ``.1``, ``.2`` an
         (``#`` → ``#``, ``#.1``). Manche Exports verwenden auch ``#2``.
         Wir behandeln **literale "#"-Spalten** positionsbasiert:
         erstes "#" = Kundennummer (falls noch nicht gemappt),
         zweites "#" = PackCode (falls noch nicht gemappt).
      2. Anschließend Header-Name-Matching: pro kanonischem Namen die erste
         noch unbenutzte Quellspalte suchen, deren Header eines der
         Keywords als Substring enthält (case-insensitive).
      3. Fehlt ein REQUIRED_CANONICAL danach → ValueError mit Diagnose.
         Fehlen WICHTIGE_CANONICALS → Warnung.

    Returns:
        (mapping, warnungen)
        mapping:    {csv_spalten_index: canonical_name}
        warnungen:  Liste menschenlesbarer Warnungen (für UI-Anzeige)
    """
    mapping: dict[int, str] = {}
    benutzte_indizes: set[int] = set()
    benutzte_canonicals: set[str] = set()

    # Lowercase-Variante für Substring-Matching, Original behalten für Diagnose.
    norm = [h.strip().lower() for h in headers]
    raw = [h.strip() for h in headers]

    # --- Schritt 1: literale "#"-Spalten positionsbasiert behandeln. ---
    # Pandas duplicates: 1. "#" bleibt "#", 2. wird zu "#.1". Beide auf "#"
    # normalisieren für das Matching. Auch "#2" (literal) abdecken.
    hash_indices = [
        i for i, h in enumerate(raw)
        if h == "#" or h == "#.1" or h == "#2"
    ]
    if len(hash_indices) >= 1 and "Kundennummer" not in benutzte_canonicals:
        idx = hash_indices[0]
        mapping[idx] = "Kundennummer"
        benutzte_indizes.add(idx)
        benutzte_canonicals.add("Kundennummer")
    if len(hash_indices) >= 2 and "PackCode" not in benutzte_canonicals:
        idx = hash_indices[1]
        mapping[idx] = "PackCode"
        benutzte_indizes.add(idx)
        benutzte_canonicals.add("PackCode")

    # --- Schritt 2: Header-Name-Matching. ---
    # Reihenfolge: zuerst spezifischere Patterns (Kundennummer vor Kunde).
    for canonical, patterns in HEADER_PATTERNS.items():
        if canonical in benutzte_canonicals:
            continue
        for i, h_lower in enumerate(norm):
            if i in benutzte_indizes:
                continue
            if not h_lower:
                continue
            for pat in patterns:
                if pat in h_lower:
                    mapping[i] = canonical
                    benutzte_indizes.add(i)
                    benutzte_canonicals.add(canonical)
                    break
            if canonical in benutzte_canonicals:
                break

    # --- Schritt 3: Validierung. ---
    fehlende_required = REQUIRED_CANONICALS - benutzte_canonicals
    if fehlende_required:
        raise ValueError(
            "Folgende Pflicht-Spalten konnten in der CSV-Kopfzeile nicht "
            f"erkannt werden: {sorted(fehlende_required)}. "
            f"Tatsächlich gefundene Header: {raw}. "
            "Bitte stellen Sie sicher, dass der CSV-Export diese Spalten enthält."
        )

    warnungen: list[str] = []
    for c in sorted(WICHTIGE_CANONICALS - benutzte_canonicals):
        if c == "Gesamt":
            warnungen.append(
                "Spalte 'Gesamt' nicht im Header gefunden — Umsatzwerte "
                "können nicht importiert werden (Umsatz erscheint als 0 €). "
                f"Tatsächlich erkannte Header: {raw}"
            )
        elif c == "Nummer":
            warnungen.append(
                "Spalte 'Nummer' (Rechnungsnummer) nicht im Header gefunden — "
                "Duplikaterkennung greift möglicherweise zu großzügig, da "
                "die Rechnungsnummer als Teil des UNIQUE-Schlüssels fehlt."
            )
        elif c == "PackCode":
            warnungen.append(
                "Spalte für Pack-Code (Artikelnummer) nicht im Header gefunden — "
                "Eier-Stückzahl für PACK-Zeilen kann nicht berechnet werden."
            )

    return mapping, warnungen


def parse_csv(file_path: str | Path) -> Tuple[pd.DataFrame, list[str]]:
    """Liest die CSV und liefert (DataFrame mit kanonischen Spaltennamen, Header-Warnungen).

    Die Anzahl der Metazeilen vor der Kopfzeile wird automatisch ermittelt
    (siehe ``_finde_header_zeile``). Anschließend werden die Spalten anhand
    ihrer Header-Texte den kanonischen Namen zugeordnet (siehe
    ``_zuordne_spalten``).
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
    mapping, warnungen = _zuordne_spalten(list(df.columns))
    # Rename: gemappte Spalten erhalten den kanonischen Namen; ungemappte
    # Spalten behalten ihren Original-Header (werden in _row_to_record nicht
    # abgefragt). Eindeutigkeit ist garantiert, weil _zuordne_spalten jede
    # Quellspalte höchstens einmal vergibt.
    rename_dict = {df.columns[i]: canonical for i, canonical in mapping.items()}
    df = df.rename(columns=rename_dict)
    # Komplett leere Zeilen entfernen (Pandas liest manchmal eine Schluss-Leerzeile mit).
    df = df.dropna(how="all").reset_index(drop=True)

    # Trailing-Zusammenfassung am Datei-Ende abschneiden: Die letzte Zeile mit
    # parseesbarem Datum markiert das Ende der Daten-Sektion. Alle weiteren
    # Zeilen (Saldo, Gesamtsumme, Statistik etc.) sind eine erwartete
    # Strukturkomponente jedes Warenwirtschafts-Exports und werden
    # stillschweigend ignoriert — sonst würden sie als „fehlerhaft" gezählt.
    if "Datum" in df.columns and len(df) > 0:
        date_valid = df["Datum"].apply(lambda v: parse_german_date(v) is not None)
        if date_valid.any():
            last_valid = int(date_valid[date_valid].index.max())
            if last_valid + 1 < len(df):
                n_dropped = len(df) - (last_valid + 1)
                df = df.iloc[: last_valid + 1].copy().reset_index(drop=True)
                print(
                    f"[parse_csv] {n_dropped} trailing Zeile(n) nach der letzten "
                    f"Datumszeile ignoriert (vermutlich Zusammenfassung)."
                )

    return df, warnungen


def vorschau(file_path: str | Path, n: int = 10) -> list[dict]:
    """Liefert die ersten `n` geparsten Zeilen als Liste von Dicts (für Vorschau-UI)."""
    df, _ = parse_csv(file_path)
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


def _rohdaten(row: pd.Series, columns: list[str]) -> str:
    """Pipe-getrennte Zusammenfassung einer CSV-Zeile für Diagnose-Anzeige."""
    parts = []
    for c in columns:
        v = row.get(c)
        if v is None or (isinstance(v, float) and pd.isna(v)):
            parts.append("")
        else:
            parts.append(str(v).strip())
    return " | ".join(parts)


def import_csv(file_path: str | Path, dateiname: str) -> ImportErgebnis:
    """Parst eine CSV-Datei und schreibt die Verkaufspositionen in die DB.

    Duplikate (gemäß UNIQUE-Constraint) werden via INSERT OR IGNORE übersprungen
    und gezählt — kein Fehler. Fehlerhafte Zeilen werden gezählt und die ersten
    ``_FEHLER_DETAILS_MAX`` Gründe samt Zeilennummer in der Response gemeldet.
    Vollständige Detail-Daten (alle Fehler + alle Duplikate, mit Rohdaten)
    werden in ``import_zeilen_protokoll`` persistiert.
    """
    header_idx = _finde_header_zeile(file_path)
    df, header_warnungen = parse_csv(file_path)
    spalten = list(df.columns)

    # CSV-Zeilennummer = pandas-Index + header_idx + 2
    #   header_idx ist 0-basiert und zeigt auf die Header-Zeile.
    #   +1 für 1-basierte Zeilenzählung (wie in Excel),
    #   +1 weil pandas-Daten unter dem Header beginnen.
    def csv_zeilennr(pandas_idx: int) -> int:
        return int(pandas_idx) + header_idx + 2

    records: list[Tuple[int, dict]] = []   # (csv_zeile, record)
    fehlerhaft = 0
    fehler_details: list[str] = []
    # Persistierte Detail-Zeilen, vor dem DB-Insert gesammelt:
    protokoll_fehler: list[Tuple[int, str, str]] = []   # (csv_zeile, grund, rohdaten)

    for pandas_idx, row in df.iterrows():
        rec, grund = _row_to_record(row)
        zeile = csv_zeilennr(pandas_idx)
        if rec is None:
            fehlerhaft += 1
            rohdaten = _rohdaten(row, spalten)
            protokoll_fehler.append((zeile, grund or "Unbekannter Fehler", rohdaten))
            if len(fehler_details) < _FEHLER_DETAILS_MAX:
                fehler_details.append(f"Zeile {zeile}: {grund}")
            continue
        records.append((zeile, rec))

    # Datumsbereich für die Import-Tabelle
    daten = sorted(r["rechnungsdatum"] for _, r in records)
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
        protokoll_duplikat: list[Tuple[int, str, str]] = []

        for zeile, rec in records:
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
                # Bei INSERT OR IGNORE: rowcount=0 → Duplikat-Treffer.
                # Schlüssel ab v1.0.4: (rechnungsdatum, rechnungsnummer, kundennummer,
                # menge, einheit, pack_code, beschreibung).
                grund = (
                    f"Duplikat (Datum {rec.get('rechnungsdatum')}, "
                    f"R-Nr {rec.get('rechnungsnummer') or '∅'}, "
                    f"Kd {rec.get('kundennummer')}, Menge {rec.get('menge')}, "
                    f"{rec.get('einheit') or '—'}, "
                    f"Pack {rec.get('pack_code') or '—'}, "
                    f"{(rec.get('beschreibung') or '')[:40]})"
                )
                # Rohdaten aus dem rec (statt aus dem df, da df nach Reset reindiziert)
                rohdaten = " | ".join(
                    str(rec.get(k) or "") for k in (
                        "rechnungsdatum", "rechnungsnummer", "kundennummer", "kundenname",
                        "menge", "einheit", "pack_code", "beschreibung",
                        "preis_einheit", "gesamt",
                    )
                )
                protokoll_duplikat.append((zeile, grund, rohdaten))

        # Protokoll-Zeilen persistieren (alle Fehler + alle Duplikate).
        protokoll_rows = (
            [(import_id, z, "fehler", g, r) for z, g, r in protokoll_fehler]
            + [(import_id, z, "duplikat", g, r) for z, g, r in protokoll_duplikat]
        )
        if protokoll_rows:
            cur.executemany(
                """INSERT INTO import_zeilen_protokoll
                     (import_id, csv_zeile, status, grund, rohdaten)
                   VALUES (?, ?, ?, ?, ?)""",
                protokoll_rows,
            )

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
        header_warnungen=header_warnungen,
    )


__all__ = [
    "ImportErgebnis",
    "parse_german_number", "parse_german_date",
    "berechne_eier", "normiere_artikel", "extrahiere_groesse",
    "parse_csv", "vorschau", "import_csv",
]
