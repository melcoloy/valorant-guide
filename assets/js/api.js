// ==========================================================================
// api.js — récupère les données du jeu
//
// Source : https://valorant-api.com (API communautaire gratuite, sans clé).
// Les réponses sont simplifiées (on ne garde que ce dont le site a besoin)
// puis mises en cache dans le navigateur pour éviter de les retélécharger.
// ==========================================================================

const BASE = "https://valorant-api.com/v1";
const LANGUE = "fr-FR";
const DUREE_CACHE_MS = 12 * 60 * 60 * 1000; // 12 heures
const VERSION_CACHE = "v2"; // à incrémenter si le format des données change

// Touches par défaut associées à chaque emplacement de compétence.
export const TOUCHES = {
  Grenade: "C",
  Ability1: "Q",
  Ability2: "E",
  Ultimate: "X",
  Passive: "—",
};
const ORDRE_SLOTS = ["Grenade", "Ability1", "Ability2", "Ultimate", "Passive"];

// --- Cache (localStorage) --------------------------------------------------
// Toutes les lectures/écritures sont protégées : en navigation privée,
// localStorage peut être indisponible et le site doit marcher quand même.

function lireCache(cle) {
  try {
    const brut = localStorage.getItem(`valo-atlas:${VERSION_CACHE}:${cle}`);
    if (!brut) return null;
    const { date, donnees } = JSON.parse(brut);
    if (Date.now() - date > DUREE_CACHE_MS) return null;
    return donnees;
  } catch {
    return null;
  }
}

function ecrireCache(cle, donnees) {
  try {
    localStorage.setItem(
      `valo-atlas:${VERSION_CACHE}:${cle}`,
      JSON.stringify({ date: Date.now(), donnees })
    );
  } catch {
    /* quota dépassé ou stockage bloqué : on ignore */
  }
}

// Télécharge depuis l'API. Si elle est injoignable, on se rabat sur la copie
// de secours enregistrée dans data/api/ (voir scripts/instantane_api.py).
async function telecharger(chemin, secours) {
  try {
    const reponse = await fetch(`${BASE}/${chemin}`);
    if (!reponse.ok) throw new Error(`L'API a répondu ${reponse.status} pour ${chemin}`);
    const json = await reponse.json();
    return { donnees: json.data, depuisSecours: false };
  } catch (erreur) {
    console.warn(`valorant-api.com indisponible, utilisation de data/api/${secours}.json`, erreur);
    const reponse = await fetch(`data/api/${secours}.json`).catch(() => null);
    if (!reponse?.ok) throw erreur;
    const json = await reponse.json();
    // Prévient la page (ui.js affiche un bandeau) que les données peuvent dater un peu.
    window.dispatchEvent(new CustomEvent("valo-atlas:secours", { detail: { date: json.date } }));
    return { donnees: json.data, depuisSecours: true };
  }
}

// Évite de lancer deux fois le même téléchargement sur une même page.
// `transformer` simplifie la réponse brute de l'API.
const enCours = new Map();
function avecCache(cle, chemin, transformer) {
  if (enCours.has(cle)) return enCours.get(cle);
  const promesse = (async () => {
    const cache = lireCache(cle);
    if (cache) return cache;
    const { donnees: brut, depuisSecours } = await telecharger(chemin, cle);
    const donnees = transformer(brut);
    // On ne met pas en cache la copie de secours : à la prochaine visite,
    // on retentera l'API pour avoir des données à jour.
    if (!depuisSecours) ecrireCache(cle, donnees);
    return donnees;
  })();
  enCours.set(cle, promesse);
  return promesse;
}

// --- Agents ----------------------------------------------------------------

export function getAgents() {
  return avecCache("agents", `agents?isPlayableCharacter=true&language=${LANGUE}`, (brut) =>
    brut
      .map((a) => ({
        uuid: a.uuid,
        nom: a.displayName,
        description: a.description,
        icone: a.displayIcon,
        portrait: a.fullPortrait || a.bustPortrait || a.displayIcon,
        fond: a.background,
        couleurs: (a.backgroundGradientColors || []).map((c) => `#${c.slice(0, 6)}`),
        role: a.role
          ? { uuid: a.role.uuid, nom: a.role.displayName, icone: a.role.displayIcon, description: a.role.description }
          : null,
        capacites: (a.abilities || [])
          .filter((c) => c.displayName)
          .sort((x, y) => ORDRE_SLOTS.indexOf(x.slot) - ORDRE_SLOTS.indexOf(y.slot))
          .map((c) => ({
            slot: c.slot,
            touche: TOUCHES[c.slot] || "?",
            nom: c.displayName,
            description: c.description || "",
            icone: c.displayIcon,
          })),
      }))
      .sort((x, y) => x.nom.localeCompare(y.nom, "fr"))
  );
}

// --- Maps ------------------------------------------------------------------

// Transforme une position "dans le jeu" en position sur la minimap (0 → 1).
// Formule documentée par valorant-api.com : les axes x et y sont inversés.
export function versMinimap(map, location) {
  return {
    x: location.y * map.xMultiplier + map.xScalarToAdd,
    y: location.x * map.yMultiplier + map.yScalarToAdd,
  };
}

function nomCallout(c) {
  const zone = c.superRegionName;
  if (c.regionName === "Spawn") {
    return zone === "AttackerSide" ? "Spawn attaque" : "Spawn défense";
  }
  if (zone === "AttackerSide" || zone === "DefenderSide") return c.regionName;
  return `${zone} ${c.regionName}`;
}

export function getMaps() {
  return avecCache("maps", `maps?language=${LANGUE}`, (brut) =>
      brut
        // On ne garde que les maps compétitives (sites A/B ou A/B/C + minimap)
        .filter((m) => m.tacticalDescription && m.displayIcon && m.callouts && m.callouts.length)
        .map((m) => ({
          uuid: m.uuid,
          nom: m.displayName,
          sites: m.tacticalDescription,
          description: m.narrativeDescription,
          coordonnees: m.coordinates,
          minimap: m.displayIcon,
          splash: m.splash,
          vignette: m.listViewIcon,
          callouts: m.callouts.map((c) => ({
            nom: nomCallout(c),
            zone: c.superRegionName,
            spawn: c.regionName === "Spawn",
            ...versMinimap(m, c.location),
          })),
        }))
        .sort((x, y) => x.nom.localeCompare(y.nom, "fr"))
  );
}

// --- Armes -----------------------------------------------------------------

export function getArmes() {
  return avecCache("weapons", `weapons?language=${LANGUE}`, (brut) =>
    brut
      .filter((w) => w.weaponStats && w.shopData)
      .map((w) => {
        const s = w.weaponStats;
        return {
          uuid: w.uuid,
          nom: w.displayName,
          categorie: w.shopData.categoryText,
          prix: w.shopData.cost,
          icone: w.displayIcon,
          cadence: s.fireRate, // balles par seconde
          chargeur: s.magazineSize,
          rechargement: s.reloadTimeSeconds,
          // Fusils à pompe : plusieurs plombs par tir. L'API renvoie parfois -1 (= 1 plomb).
          plombs: s.shotgunPelletCount > 0 ? s.shotgunPelletCount : 1,
          penetration: (s.wallPenetration || "").split("::")[1] || "",
          portees: (s.damageRanges || []).map((r) => ({
            debut: r.rangeStartMeters,
            fin: r.rangeEndMeters,
            tete: r.headDamage,
            corps: r.bodyDamage,
            jambes: r.legDamage,
          })),
        };
      })
      .sort((x, y) => x.prix - y.prix || x.nom.localeCompare(y.nom, "fr"))
  );
}

// --- Données du projet (fichiers JSON dans /data) ---------------------------

export async function getDonneesLocales(fichier) {
  const reponse = await fetch(`data/${fichier}`, { cache: "no-cache" });
  if (!reponse.ok) throw new Error(`Impossible de lire data/${fichier}`);
  return reponse.json();
}

export const getMeta = () => getDonneesLocales("meta-maps.json");
export const getLineups = () => getDonneesLocales("lineups.json");
