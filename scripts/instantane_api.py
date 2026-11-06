#!/usr/bin/env python3
"""Enregistre une copie de secours des données de valorant-api.com.

Usage :
    python scripts/instantane_api.py

Le site lit normalement les agents, les maps et les armes directement sur
valorant-api.com. Si l'API est en panne, il se rabat sur les copies
enregistrées dans data/api/. Ce script les met à jour : relance-le après
chaque patch (nouvel agent, nouvelle map, équilibrage des armes).

On garde le format de l'API (pour que le site les traite exactement comme
une vraie réponse), mais seulement les champs dont le site a besoin : les
skins des armes, par exemple, pèseraient plusieurs mégaoctets.
"""

import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

for flux in (sys.stdout, sys.stderr):
    try:
        flux.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

RACINE = Path(__file__).resolve().parent.parent
DOSSIER = RACINE / "data" / "api"
BASE = "https://valorant-api.com/v1"
LANGUE = "fr-FR"

# Fichier de secours → (chemin de l'API, champs à garder pour chaque élément)
SOURCES = {
    "agents": (
        f"agents?isPlayableCharacter=true&language={LANGUE}",
        ["uuid", "displayName", "description", "displayIcon", "fullPortrait", "bustPortrait",
         "background", "backgroundGradientColors", "role", "abilities"],
    ),
    "maps": (
        f"maps?language={LANGUE}",
        ["uuid", "displayName", "tacticalDescription", "narrativeDescription", "coordinates",
         "displayIcon", "splash", "listViewIcon", "callouts",
         "xMultiplier", "yMultiplier", "xScalarToAdd", "yScalarToAdd"],
    ),
    "weapons": (
        f"weapons?language={LANGUE}",
        ["uuid", "displayName", "displayIcon", "weaponStats", "shopData"],
    ),
}

# Pour les armes, seuls le prix et la catégorie de la boutique servent.
CHAMPS_BOUTIQUE = ["cost", "categoryText"]


def lire(chemin):
    requete = urllib.request.Request(f"{BASE}/{chemin}", headers={"User-Agent": "valo-atlas"})
    with urllib.request.urlopen(requete, timeout=30) as r:
        return json.load(r)["data"]


def alleger(element, champs):
    garde = {cle: element.get(cle) for cle in champs if cle in element}
    if isinstance(garde.get("shopData"), dict):
        garde["shopData"] = {cle: garde["shopData"].get(cle) for cle in CHAMPS_BOUTIQUE}
    return garde


def main():
    DOSSIER.mkdir(parents=True, exist_ok=True)
    for nom, (chemin, champs) in SOURCES.items():
        donnees = [alleger(e, champs) for e in lire(chemin)]
        fichier = DOSSIER / f"{nom}.json"
        fichier.write_text(
            json.dumps({"date": date.today().isoformat(), "data": donnees}, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        print(f"✓ {fichier.relative_to(RACINE).as_posix()} : {len(donnees)} élément(s), {fichier.stat().st_size // 1024} Ko")


if __name__ == "__main__":
    main()
