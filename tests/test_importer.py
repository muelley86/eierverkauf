"""Tests für Eiermengen-Berechnung und Artikelnormierung (data/importer.py).

Regression v1.4.0: Der Eier-Faktor (×10/×6) darf nur bei Einheit PACK greifen.
stk-Positionen zählen bereits einzelne Eier — auch wenn ihr PackCode 110/111
sie dem Artikel „10er/6er Kvp" zuordnet.
"""
from data.importer import berechne_eier, normiere_artikel

# Entspricht den Seed-Werten aus data/db.py (_EIER_KONFIG_DEFAULTS).
KONFIG: dict[str, int | None] = {
    "10er Kvp": 10,
    "6er Kvp": 6,
    "Lose 180": 1,
    "Lose 20": 1,
    "Lose unsortiert": 1,
    "Gewicht (kg)": None,
    "Sonstige": 1,
}


# ---------------------------------------------------------------------------
# berechne_eier — Einheit PACK: Menge zählt Verpackungen → Faktor anwenden
# ---------------------------------------------------------------------------

def test_pack_10er_kvp_multipliziert_menge_mit_faktor():
    assert berechne_eier(36, "PACK", "10er Kvp", KONFIG) == 360


def test_pack_6er_kvp_multipliziert_menge_mit_faktor():
    assert berechne_eier(60, "PACK", "6er Kvp", KONFIG) == 360


def test_pack_mit_unbekanntem_artikel_liefert_none():
    assert berechne_eier(5, "PACK", "Fantasie-Artikel", KONFIG) is None


def test_pack_mit_faktor_none_liefert_none():
    assert berechne_eier(5, "PACK", "Gewicht (kg)", KONFIG) is None


def test_pack_ohne_artikel_code_liefert_none():
    assert berechne_eier(5, "PACK", None, KONFIG) is None


# ---------------------------------------------------------------------------
# berechne_eier — Einheit stk/leer: Menge zählt bereits einzelne Eier
# ---------------------------------------------------------------------------

def test_stk_mit_10er_kvp_zaehlt_menge_bereits_als_eier():
    # Regression v1.4.0: 180 stk mit PackCode 110 sind 180 Eier, nicht 1800.
    assert berechne_eier(180, "stk", "10er Kvp", KONFIG) == 180


def test_stk_mit_6er_kvp_zaehlt_menge_bereits_als_eier():
    assert berechne_eier(48, "stk", "6er Kvp", KONFIG) == 48


def test_leere_einheit_zaehlt_menge_als_eier():
    assert berechne_eier(25, "", "Sonstige", KONFIG) == 25
    assert berechne_eier(25, None, "Sonstige", KONFIG) == 25


# ---------------------------------------------------------------------------
# berechne_eier — Einheit kg: keine Stückzahl-Aussage
# ---------------------------------------------------------------------------

def test_kg_liefert_keine_stueckzahl():
    assert berechne_eier(500, "kg", "Gewicht (kg)", KONFIG) is None


def test_kg_liefert_auch_mit_kvp_artikel_keine_stueckzahl():
    # kg schlägt den Artikel-Faktor — Gewicht sagt nichts über Stückzahl.
    assert berechne_eier(500, "kg", "10er Kvp", KONFIG) is None


# ---------------------------------------------------------------------------
# berechne_eier — Randfälle
# ---------------------------------------------------------------------------

def test_menge_none_liefert_none():
    assert berechne_eier(None, "PACK", "10er Kvp", KONFIG) is None


def test_einheit_gross_kleinschreibung_egal():
    assert berechne_eier(25, "pack", "10er Kvp", KONFIG) == 250
    assert berechne_eier(30, "STK", "6er Kvp", KONFIG) == 30


# ---------------------------------------------------------------------------
# normiere_artikel — Kvp-Artikel werden je Abrechnungsart getrennt (v1.5.0):
# PACK-Positionen behalten den Basis-Code, stk-/leer-Positionen bekommen
# den Suffix „(stk)", damit die Artikel-Auswertung Einheiten nicht mischt.
# ---------------------------------------------------------------------------

def test_pack_code_110_ist_10er_kvp():
    assert normiere_artikel("PACK", 110, "110 Bio-Eier 10er Kvp Größe L") == "10er Kvp"


def test_pack_code_111_ist_6er_kvp():
    assert normiere_artikel("PACK", 111, "111 Bio-Eier 6er Kvp Größe M") == "6er Kvp"


def test_stk_mit_pack_code_110_ist_eigener_stk_artikel():
    # Pro Stück fakturierte 10er-Kvp-Ware erscheint als eigene Artikel-Zeile.
    assert normiere_artikel("stk", 110, "110 Bio-Eier 10er Kvp Größe L") == "10er Kvp (stk)"


def test_stk_mit_pack_code_111_ist_eigener_stk_artikel():
    assert normiere_artikel("stk", 111, "111 Bio-Eier 6er Kvp Größe M") == "6er Kvp (stk)"


def test_leere_einheit_mit_pack_code_zaehlt_als_stk_artikel():
    assert normiere_artikel("", 110, "110 Bio-Eier 10er Kvp Größe L") == "10er Kvp (stk)"
    assert normiere_artikel(None, 111, "111 Bio-Eier 6er Kvp Größe M") == "6er Kvp (stk)"


def test_einheit_pack_gross_kleinschreibung_egal_fuer_kvp():
    assert normiere_artikel("pack", 110, "110 Bio-Eier 10er Kvp Größe L") == "10er Kvp"
    assert normiere_artikel("Pack", 111, "111 Bio-Eier 6er Kvp Größe M") == "6er Kvp"


def test_kg_ohne_pack_code_ist_gewicht():
    assert normiere_artikel("kg", None, "Bio-Eier Größe M") == "Gewicht (kg)"


def test_stk_180_lose():
    assert normiere_artikel("stk", None, "Bio-Eier 180 lose Größe S") == "Lose 180"


def test_stk_unsortiert():
    assert normiere_artikel("stk", None, "Bio-Eier lose unsortiert") == "Lose unsortiert"


def test_fallback_sonstige():
    assert normiere_artikel("stk", None, "Suppenhühner") == "Sonstige"
