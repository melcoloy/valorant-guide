#!/usr/bin/env python3
"""Vérifie les fichiers de données du projet (data/*.json).

Usage :
    python scripts/valider_donnees.py

Le script vérifie la structure de data/lineups.json et data/meta-maps.json.
S'il peut joindre valorant-api.com, il vérifie aussi que les noms d'agents
et de maps existent vraiment dans le jeu. Il s'arrête avec un code d'erreur
si quelque chose ne va pas : c'est ce que lance GitHub Actions à chaque
pull request.
"""

import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

# Sous Windows, la console utilise souvent un encodage (cp1252) qui ne sait pas
# écrire les symboles ✓ ✗ ⚠️ : on force l'UTF-8 pour que le script ne plante pas.
for flux in (sys.stdout, sys.stderr):
    try:
        flux.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

RACINE = Path(__file__).resolve().parent.parent
CAMPS = {"attaque", "defense"}
SITES = {"A", "B", "C", "Mid"}
SLOTS = {"Grenade", "Ability1", "Ability2", "Ultimate"}
ROLES = ["Contrôleur", "Initiateur", "Sentinelle", "Duelliste"]
MIN_PAR_ROLE = 2  # chaque map doit conseiller au moins 2 agents par rôle
JOURS_AVANT_RELECTURE = 90  # au-delà, on rappelle de relire la méta

erreurs = []


def erreur(message):
    erreurs.append(message)


def charger(nom):
    chemin = RACINE / "data" / nom
    try:
        return json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        erreur(f"{nom} : JSON invalide (ligne {e.lineno}, colonne {e.colno}) : {e.msg}")
        return None


def noms_du_jeu():
    """Récupère les agents (nom → rôle) et les maps depuis l'API (ou None si hors ligne)."""
    try:
        def lire(url):
            with urllib.request.urlopen(url, timeout=15) as r:
                return json.load(r)["data"]

        agents = {
            a["displayName"]: a["role"]["displayName"]
            for a in lire("https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=fr-FR")
        }
        maps = {m["displayName"] for m in lire("https://valorant-api.com/v1/maps") if m.get("tacticalDescription")}
        return agents, maps
    except Exception as e:  # pas de réseau : on saute cette vérification
        print(f"⚠️  valorant-api.com injoignable ({e}) : noms d'agents et de maps non vérifiés.")
        return None, None


def point_valide(p):
    return (
        isinstance(p, dict)
        and isinstance(p.get("x"), (int, float))
        and isinstance(p.get("y"), (int, float))
        and 0 <= p["x"] <= 1
        and 0 <= p["y"] <= 1
    )


def verifier_lineups(donnees, agents, maps):
    if not isinstance(donnees, dict) or not isinstance(donnees.get("lineups"), list):
        erreur('lineups.json : il faut un objet avec une liste "lineups".')
        return
    ids = set()
    for i, lu in enumerate(donnees["lineups"]):
        ou = f"lineups.json, lineup n°{i + 1} ({lu.get('id', 'sans id')})"
        for cle in ("id", "map", "agent", "slot", "camp", "site", "titre", "etapes", "depuis", "vers"):
            if cle not in lu or lu[cle] in ("", None, []):
                erreur(f"{ou} : le champ « {cle} » est manquant ou vide.")
        if lu.get("id") in ids:
            erreur(f"{ou} : l'id « {lu['id']} » existe déjà.")
        ids.add(lu.get("id"))
        if lu.get("camp") and lu["camp"] not in CAMPS:
            erreur(f"{ou} : camp « {lu['camp']} » invalide (attendu : {', '.join(sorted(CAMPS))}).")
        if lu.get("site") and lu["site"] not in SITES:
            erreur(f"{ou} : site « {lu['site']} » invalide (attendu : {', '.join(sorted(SITES))}).")
        if lu.get("slot") and lu["slot"] not in SLOTS:
            erreur(f"{ou} : slot « {lu['slot']} » invalide (attendu : {', '.join(sorted(SLOTS))}).")
        if "etapes" in lu and not isinstance(lu["etapes"], list):
            erreur(f"{ou} : « etapes » doit être une liste de phrases.")
        for cle in ("depuis", "vers"):
            if lu.get(cle) is not None and not point_valide(lu[cle]):
                erreur(f"{ou} : « {cle} » doit être {{\"x\": …, \"y\": …}} avec des valeurs entre 0 et 1.")
        video = lu.get("video", "")
        if video and not str(video).startswith("https://"):
            erreur(f"{ou} : le lien vidéo doit commencer par https://")
        if agents and lu.get("agent") and lu["agent"] not in agents:
            erreur(f"{ou} : agent « {lu['agent']} » inconnu (vérifie l'orthographe exacte).")
        if maps and lu.get("map") and lu["map"] not in maps:
            erreur(f"{ou} : map « {lu['map']} » inconnue.")
    print(f"✓ lineups.json : {len(donnees['lineups'])} lineup(s) vérifié(s).")


def verifier_meta(donnees, agents, maps):
    if not isinstance(donnees, dict) or not isinstance(donnees.get("maps"), dict):
        erreur('meta-maps.json : il faut un objet avec un dictionnaire "maps".')
        return
    try:
        mise_a_jour = date.fromisoformat(str(donnees.get("miseAJour")))
    except ValueError:
        erreur('meta-maps.json : « miseAJour » doit être une date au format AAAA-MM-JJ.')
    else:
        age = (date.today() - mise_a_jour).days
        if age > JOURS_AVANT_RELECTURE:
            # Simple rappel : ça ne fait pas échouer la vérification.
            print(f"⚠️  meta-maps.json n'a pas été relu depuis {age} jours : la méta a peut-être changé.")
    for nom_map, infos in donnees["maps"].items():
        ou = f"meta-maps.json, map « {nom_map} »"
        if maps and nom_map not in maps:
            erreur(f"{ou} : map inconnue (vérifie l'orthographe exacte).")
        if not isinstance(infos.get("resume"), str) or not infos["resume"].strip():
            erreur(f"{ou} : « resume » manquant.")
        if not isinstance(infos.get("caracteristiques", []), list):
            erreur(f"{ou} : « caracteristiques » doit être une liste.")
        noms = []
        for reco in infos.get("agents", []):
            if not reco.get("nom") or not reco.get("pourquoi"):
                erreur(f"{ou} : chaque agent conseillé doit avoir « nom » et « pourquoi ».")
                continue
            noms.append(reco["nom"])
            if agents and reco["nom"] not in agents:
                erreur(f"{ou} : agent « {reco['nom']} » inconnu.")
        if len(noms) != len(set(noms)):
            erreur(f"{ou} : un agent apparaît deux fois.")
        if agents:
            for role in ROLES:
                n = sum(1 for nom in noms if agents.get(nom) == role)
                if n < MIN_PAR_ROLE:
                    erreur(f"{ou} : {n} agent(s) {role.lower()}(s) conseillé(s), il en faut au moins {MIN_PAR_ROLE}.")
        if "aConfirmer" in infos and not isinstance(infos["aConfirmer"], bool):
            erreur(f"{ou} : « aConfirmer » doit valoir true ou false.")
        compo = infos.get("compo", [])
        if compo and len(compo) != 5:
            erreur(f"{ou} : la compo doit contenir 5 agents (elle en a {len(compo)}).")
        for nom in compo:
            if agents and nom not in agents:
                erreur(f"{ou} : agent « {nom} » de la compo inconnu.")
    print(f"✓ meta-maps.json : {len(donnees['maps'])} map(s) vérifiée(s).")


def main():
    agents, maps = noms_du_jeu()
    lineups = charger("lineups.json")
    meta = charger("meta-maps.json")
    if lineups is not None:
        verifier_lineups(lineups, agents, maps)
    if meta is not None:
        verifier_meta(meta, agents, maps)

    if erreurs:
        print(f"\n✗ {len(erreurs)} problème(s) trouvé(s) :")
        for e in erreurs:
            print(f"  - {e}")
        sys.exit(1)
    print("\nTout est bon !")


if __name__ == "__main__":
    main()
