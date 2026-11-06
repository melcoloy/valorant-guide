// ==========================================================================
// calculs-armes.js — calculs de la page Armes, sans lien avec la page
// (testés par tests/calculs-armes.test.js).
//
// Vocabulaire :
//   - PV : points de vie de la cible (100 + bouclier : 0, 25 ou 50)
//   - balles pour tuer = arrondi supérieur de (PV / dégâts par balle)
//   - TTK (time to kill) = temps entre la 1re et la dernière balle
//                        = (balles - 1) / cadence de tir
//   - DPS = dégâts par seconde = dégâts par balle × cadence
// ==========================================================================

// Palier de dégâts qui s'applique à une distance (au-delà du dernier : le dernier)
export function palier(arme, distance) {
  return arme.portees.find((p) => distance >= p.debut && distance < p.fin) || arme.portees[arme.portees.length - 1];
}

// Dégâts d'un tir à une distance donnée (fusils à pompe : tous les plombs touchent)
export function degats(arme, distance, zone) {
  const p = palier(arme, distance);
  return p ? p[zone] * arme.plombs : 0;
}

export function ballesPourTuer(dmg, pv) {
  return dmg > 0 ? Math.ceil(pv / dmg) : Infinity;
}

// Analyse complète d'une arme pour une situation { distance, pv, zone }
export function analyser(arme, { distance, pv, zone }) {
  const dmg = degats(arme, distance, zone);
  const balles = ballesPourTuer(dmg, pv);
  const possible = balles <= arme.chargeur;
  return {
    arme,
    dmg,
    tete: degats(arme, distance, "tete"),
    corps: degats(arme, distance, "corps"),
    jambes: degats(arme, distance, "jambes"),
    balles,
    ttk: possible ? ((balles - 1) / arme.cadence) * 1000 : null, // en millisecondes
    dps: dmg * arme.cadence,
  };
}
