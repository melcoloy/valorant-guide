// ==========================================================================
// Page Armes : analyse chiffrée à partir des statistiques du jeu.
//
// Vocabulaire :
//   - PV : points de vie de la cible (100 + bouclier : 0, 25 ou 50)
//   - balles pour tuer = arrondi supérieur de (PV / dégâts par balle)
//   - TTK (time to kill) = temps entre la 1re et la dernière balle
//                        = (balles - 1) / cadence de tir
//   - DPS = dégâts par seconde = dégâts par balle × cadence
// ==========================================================================
import { getArmes } from "./api.js";
import { initPage, echapper, afficherChargement, afficherErreur, nombreFr } from "./ui.js";
import { graphiqueCourbes, graphiqueBarres } from "./graphiques.js";

initPage("armes");

const contenu = document.getElementById("contenu");
const ZONES = { tete: "Tête", corps: "Corps", jambes: "Jambes" };
const BOUCLIERS = [
  { pv: 150, nom: "Bouclier lourd (150 PV)" },
  { pv: 125, nom: "Bouclier léger (125 PV)" },
  { pv: 100, nom: "Sans bouclier (100 PV)" },
];
const PENETRATION = { Low: "Faible", Medium: "Moyenne", High: "Forte" };
const COULEURS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
const MAX_COMPAREES = 4;

const etat = {
  distance: 15,
  pv: 150,
  zone: "corps",
  tri: { cle: "ttk", sens: 1 },
  // Emplacements de couleur fixes : une arme garde sa couleur tant qu'elle est sélectionnée
  comparees: ["Vandal", "Phantom", "Spectre", "Sheriff"],
};

let armes = [];
const nettoyages = [];

// --- Calculs -----------------------------------------------------------------

function palier(arme, distance) {
  return arme.portees.find((p) => distance >= p.debut && distance < p.fin) || arme.portees[arme.portees.length - 1];
}

// Dégâts d'un tir à une distance donnée (fusils à pompe : tous les plombs touchent)
function degats(arme, distance, zone) {
  const p = palier(arme, distance);
  return p ? p[zone] * arme.plombs : 0;
}

function analyser(arme) {
  const dmg = degats(arme, etat.distance, etat.zone);
  const balles = dmg > 0 ? Math.ceil(etat.pv / dmg) : Infinity;
  const possible = balles <= arme.chargeur;
  return {
    arme,
    dmg,
    tete: degats(arme, etat.distance, "tete"),
    corps: degats(arme, etat.distance, "corps"),
    jambes: degats(arme, etat.distance, "jambes"),
    balles,
    ttk: possible ? ((balles - 1) / arme.cadence) * 1000 : null, // en millisecondes
    dps: dmg * arme.cadence,
  };
}

const formatTTK = (ms) => (ms === null ? "—" : ms === 0 ? "instantané" : `${nombreFr(ms)} ms`);

// --- Rendu -------------------------------------------------------------------

async function demarrer() {
  afficherChargement(contenu);
  try {
    armes = await getArmes();
  } catch (e) {
    afficherErreur(contenu, e);
    return;
  }
  etat.comparees = etat.comparees.filter((n) => armes.some((a) => a.nom === n));

  contenu.innerHTML = `
    <div class="panneau reglages" style="margin-bottom:20px">
      <label class="etiquette">Distance : <span class="valeur-curseur" id="v-distance"></span>
        <input type="range" id="r-distance" min="0" max="50" step="1" value="${etat.distance}">
      </label>
      <label class="etiquette">Cible
        <select class="champ" id="r-pv">${BOUCLIERS.map((b) => `<option value="${b.pv}">${b.nom}</option>`).join("")}</select>
      </label>
      <label class="etiquette">Zone visée
        <select class="champ" id="r-zone">${Object.entries(ZONES).map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>
      </label>
    </div>

    <div class="constats" id="constats"></div>

    <div class="panneau">
      <h2>Dégâts par tir selon la distance</h2>
      <p class="muet" id="sous-titre-courbes"></p>
      <div class="puces" id="choix-armes" role="group" aria-label="Armes à comparer" style="margin-bottom:12px"></div>
      <div class="legende" id="legende-courbes"></div>
      <div id="g-courbes"></div>
    </div>

    <div class="panneau">
      <h2>Temps pour tuer</h2>
      <p class="muet" id="sous-titre-barres"></p>
      <div id="g-barres"></div>
    </div>

    <div class="panneau">
      <h2>Toutes les statistiques</h2>
      <p class="muet" id="sous-titre-table"></p>
      <div class="table-defile"><table class="donnees" id="table"></table></div>
      <details class="methode">
        <summary>Comment sont faits les calculs ?</summary>
        <p>Les statistiques (dégâts par zone et par distance, cadence, chargeur, prix) viennent de valorant-api.com.
        Le nombre de balles pour tuer est l'arrondi supérieur de PV ÷ dégâts par balle. Le TTK est le temps entre la
        première et la dernière balle : (balles − 1) ÷ cadence. On suppose que toutes les balles touchent la zone choisie,
        sans recul ni imprécision. Pour les fusils à pompe, on suppose que tous les plombs touchent. Si le chargeur ne
        suffit pas pour tuer, le TTK est noté « — ».</p>
      </details>
    </div>`;

  const rDistance = document.getElementById("r-distance");
  const rPv = document.getElementById("r-pv");
  const rZone = document.getElementById("r-zone");
  rPv.value = etat.pv;
  rZone.value = etat.zone;
  rDistance.addEventListener("input", () => { etat.distance = Number(rDistance.value); tout(); });
  rPv.addEventListener("change", () => { etat.pv = Number(rPv.value); tout(); });
  rZone.addEventListener("change", () => { etat.zone = rZone.value; tout(); });

  document.getElementById("choix-armes").addEventListener("click", (e) => {
    const bouton = e.target.closest("button");
    if (!bouton) return;
    basculerArme(bouton.dataset.arme);
    dessinerCourbes();
  });

  tout();
}

function basculerArme(nom) {
  const i = etat.comparees.indexOf(nom);
  if (i >= 0) {
    etat.comparees[i] = null; // libère l'emplacement (et sa couleur)
  } else {
    const libre = etat.comparees.indexOf(null);
    if (libre >= 0) etat.comparees[libre] = nom;
    else if (etat.comparees.length < MAX_COMPAREES) etat.comparees.push(nom);
    else etat.comparees[0] = nom; // remplace la plus ancienne
  }
}

function tout() {
  document.getElementById("v-distance").textContent = `${etat.distance} m`;
  const analyses = armes.map(analyser);
  dessinerConstats(analyses);
  dessinerCourbes();
  dessinerBarres(analyses);
  dessinerTable(analyses);
}

function contexte() {
  return `à ${etat.distance} m, ${ZONES[etat.zone].toLowerCase()}, cible à ${etat.pv} PV`;
}

function dessinerConstats(analyses) {
  const unCoup = analyses.filter((a) => a.balles === 1).map((a) => a.arme.nom);
  const possibles = analyses.filter((a) => a.ttk !== null && a.balles > 1).sort((a, b) => a.ttk - b.ttk);
  const plusRapide = possibles[0];
  const economiques = analyses.filter((a) => a.ttk !== null && a.arme.prix > 0 && a.arme.prix < 2000).sort((a, b) => a.ttk - b.ttk || a.arme.prix - b.arme.prix);
  const eco = economiques[0];

  // Le grand débat : Vandal ou Phantom ? (balles pour tuer à la tête)
  const v = armes.find((a) => a.nom === "Vandal");
  const p = armes.find((a) => a.nom === "Phantom");
  let debat = "";
  if (v && p) {
    const bv = Math.ceil(etat.pv / degats(v, etat.distance, "tete"));
    const bp = Math.ceil(etat.pv / degats(p, etat.distance, "tete"));
    debat = `
      <div class="constat">
        <div class="libelle">Vandal ou Phantom ? (tête, ${etat.distance} m)</div>
        <div class="valeur">Vandal ${bv} balle${bv > 1 ? "s" : ""} · Phantom ${bp} balle${bp > 1 ? "s" : ""}</div>
        <div class="detail">${
          bv < bp
            ? "Le Vandal tue en moins de balles à la tête à cette distance."
            : bv === bp
            ? `Égalité à la tête ; la Phantom tire plus vite (${nombreFr(p.cadence, 2)} contre ${nombreFr(v.cadence, 2)} balles/s).`
            : "La Phantom tue en moins de balles à la tête ici."
        }</div>
      </div>`;
  }

  document.getElementById("constats").innerHTML = `
    <div class="constat">
      <div class="libelle">Tuent en une seule balle</div>
      <div class="valeur">${unCoup.length ? echapper(unCoup.join(", ")) : "Aucune arme"}</div>
      <div class="detail">${contexte()}</div>
    </div>
    <div class="constat">
      <div class="libelle">TTK le plus court (plusieurs balles)</div>
      <div class="valeur">${plusRapide ? `${echapper(plusRapide.arme.nom)} · ${formatTTK(plusRapide.ttk)}` : "—"}</div>
      <div class="detail">${plusRapide ? `${plusRapide.balles} balles à ${nombreFr(plusRapide.dmg, 1)} dégâts` : ""}</div>
    </div>
    <div class="constat">
      <div class="libelle">Meilleure arme à moins de 2 000 crédits</div>
      <div class="valeur">${eco ? `${echapper(eco.arme.nom)} · ${formatTTK(eco.ttk)}` : "—"}</div>
      <div class="detail">${eco ? `${nombreFr(eco.arme.prix)} crédits, ${eco.balles} balle${eco.balles > 1 ? "s" : ""}` : ""}</div>
    </div>
    ${debat}`;
}

function dessinerCourbes() {
  nettoyages.splice(0).forEach((f) => f());
  const choix = document.getElementById("choix-armes");
  choix.innerHTML = armes
    .map((a) => {
      const slot = etat.comparees.indexOf(a.nom);
      return `<button class="puce" data-arme="${echapper(a.nom)}" aria-pressed="${slot >= 0}">${
        slot >= 0 ? `<span class="pastille" style="background:${COULEURS[slot]}"></span>` : ""
      }${echapper(a.nom)}</button>`;
    })
    .join("");

  const series = etat.comparees
    .map((nom, slot) => {
      const a = armes.find((x) => x.nom === nom);
      if (!a) return null;
      return {
        nom: a.nom,
        couleur: COULEURS[slot],
        paliers: a.portees.map((p) => ({ debut: p.debut, fin: p.fin, valeur: p[etat.zone] * a.plombs })),
      };
    })
    .filter(Boolean);

  document.getElementById("sous-titre-courbes").textContent =
    `Zone : ${ZONES[etat.zone].toLowerCase()}. Choisis jusqu'à ${MAX_COMPAREES} armes à comparer. La ligne rouge marque la distance choisie (${etat.distance} m).`;
  document.getElementById("legende-courbes").innerHTML = series
    .map((s) => `<span><i style="background:${s.couleur}"></i>${echapper(s.nom)}</span>`)
    .join("");

  const cible = document.getElementById("g-courbes");
  if (!series.length) {
    cible.innerHTML = `<div class="vide">Sélectionne au moins une arme.</div>`;
    return;
  }
  nettoyages.push(
    graphiqueCourbes(cible, series, {
      xMax: 50,
      unite: "m",
      titreX: "Distance (mètres)",
      marqueurX: etat.distance,
      description: `Dégâts par tir selon la distance pour ${series.map((s) => s.nom).join(", ")}`,
    })
  );
}

let nettoyageBarres = null;
function dessinerBarres(analyses) {
  nettoyageBarres?.();
  const tries = [...analyses].sort((a, b) => (a.ttk ?? Infinity) - (b.ttk ?? Infinity) || a.arme.prix - b.arme.prix);
  document.getElementById("sous-titre-barres").textContent =
    `En millisecondes, ${contexte()}. Plus la barre est courte, plus l'arme tue vite.`;
  nettoyageBarres = graphiqueBarres(
    document.getElementById("g-barres"),
    tries.map((a) => ({
      nom: a.arme.nom,
      valeur: a.ttk,
      etiquette: `${formatTTK(a.ttk)} · ${a.balles} balle${a.balles > 1 ? "s" : ""}`,
      details: [
        ["Prix", `${nombreFr(a.arme.prix)} crédits`],
        ["Dégâts par tir", nombreFr(a.dmg, 1)],
        ["Balles pour tuer", String(a.balles)],
        ["TTK", formatTTK(a.ttk)],
        ["Chargeur", String(a.arme.chargeur)],
      ],
    })),
    {
      titreX: "ms",
      texteNul: "ne tue pas avec un chargeur",
      description: `Temps pour tuer de chaque arme ${contexte()}`,
    }
  );
}

const COLONNES = [
  { cle: "nom", titre: "Arme", val: (a) => a.arme.nom },
  { cle: "categorie", titre: "Catégorie", val: (a) => a.arme.categorie },
  { cle: "prix", titre: "Prix", val: (a) => a.arme.prix, aff: (a) => nombreFr(a.arme.prix) },
  { cle: "cadence", titre: "Cadence (/s)", val: (a) => a.arme.cadence, aff: (a) => nombreFr(a.arme.cadence, 2) },
  { cle: "chargeur", titre: "Chargeur", val: (a) => a.arme.chargeur },
  { cle: "tete", titre: "Tête", val: (a) => a.tete, aff: (a) => nombreFr(a.tete, 1) },
  { cle: "corps", titre: "Corps", val: (a) => a.corps, aff: (a) => nombreFr(a.corps, 1) },
  { cle: "jambes", titre: "Jambes", val: (a) => a.jambes, aff: (a) => nombreFr(a.jambes, 1) },
  { cle: "balles", titre: "Balles pour tuer", val: (a) => a.balles, aff: (a) => (Number.isFinite(a.balles) ? a.balles : "—") },
  { cle: "ttk", titre: "TTK", val: (a) => a.ttk ?? Infinity, aff: (a) => formatTTK(a.ttk) },
  { cle: "dps", titre: "DPS", val: (a) => a.dps, aff: (a) => nombreFr(a.dps) },
  { cle: "penetration", titre: "Pénétration", val: (a) => a.arme.penetration, aff: (a) => PENETRATION[a.arme.penetration] || a.arme.penetration },
];

function dessinerTable(analyses) {
  document.getElementById("sous-titre-table").textContent =
    `Dégâts à ${etat.distance} m ; balles, TTK et DPS pour la zone « ${ZONES[etat.zone].toLowerCase()} » contre ${etat.pv} PV. Clique sur un titre de colonne pour trier.`;
  const col = COLONNES.find((c) => c.cle === etat.tri.cle);
  const tries = [...analyses].sort((a, b) => {
    const va = col.val(a), vb = col.val(b);
    const r = typeof va === "string" ? va.localeCompare(vb, "fr") : va - vb;
    return r * etat.tri.sens;
  });
  const table = document.getElementById("table");
  table.innerHTML = `
    <thead><tr>${COLONNES.map((c) => {
      const actif = c.cle === etat.tri.cle;
      const sens = actif ? (etat.tri.sens === 1 ? "ascending" : "descending") : "none";
      return `<th scope="col" aria-sort="${sens}"><button data-cle="${c.cle}">${c.titre}${actif ? (etat.tri.sens === 1 ? " ▲" : " ▼") : ""}</button></th>`;
    }).join("")}</tr></thead>
    <tbody>${tries
      .map(
        (a) => `<tr>
          <td><div class="cellule-arme"><img src="${a.arme.icone}" alt="" loading="lazy">${echapper(a.arme.nom)}</div></td>
          ${COLONNES.slice(1).map((c) => `<td>${echapper(c.aff ? c.aff(a) : c.val(a))}</td>`).join("")}
        </tr>`
      )
      .join("")}</tbody>`;
  table.querySelectorAll("thead button").forEach((b) =>
    b.addEventListener("click", () => {
      const cle = b.dataset.cle;
      etat.tri = { cle, sens: etat.tri.cle === cle ? -etat.tri.sens : 1 };
      dessinerTable(analyses.map((a) => a)); // même données, nouvel ordre
    })
  );
}

demarrer();
