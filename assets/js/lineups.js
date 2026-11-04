// Page Lineups : filtres + liste + minimap, et un éditeur pour proposer
// de nouveaux lineups (génère l'entrée JSON à ajouter dans data/lineups.json).
import { getMaps, getAgents, getLineups } from "./api.js";
import {
  initPage, echapper, afficherChargement, afficherErreur, lireAncre, ecrireAncre, URL_DEPOT,
} from "./ui.js";
import { creerMinimap, legendeLineups } from "./minimap.js";

initPage("lineups");

const contenu = document.getElementById("contenu");
const CAMPS = { attaque: "Attaque", defense: "Défense" };
const SITES = ["A", "B", "C", "Mid"];

let maps = [], agents = [], lineups = [];
let parNomAgent = new Map();
const etat = { map: "", agent: "", camp: "", site: "", actif: null, editeur: false };
let minimap = null;

async function demarrer() {
  afficherChargement(contenu);
  try {
    [maps, agents, lineups] = await Promise.all([getMaps(), getAgents(), getLineups().then((d) => d.lineups)]);
  } catch (e) {
    afficherErreur(contenu, e);
    return;
  }
  parNomAgent = new Map(agents.map((a) => [a.nom, a]));

  // État initial à partir de l'URL (ex. lineups.html#map=Ascent&agent=Sova)
  const ancre = lireAncre();
  etat.agent = parNomAgent.has(ancre.agent) ? ancre.agent : "";
  etat.camp = ancre.camp || "";
  etat.site = ancre.site || "";
  etat.editeur = ancre.editeur === "1";
  const mapDemandee = maps.find((m) => m.nom === ancre.map);
  const premiereAvecLineups = maps.find((m) => lineups.some((l) => l.map === m.nom && (!etat.agent || l.agent === etat.agent)));
  etat.map = (mapDemandee || premiereAvecLineups || maps[0]).nom;

  dessinerSquelette();
  dessinerMinimap();
  dessinerColonne();
}

function dessinerSquelette() {
  const nb = (nomMap) => lineups.filter((l) => l.map === nomMap).length;
  contenu.innerHTML = `
    <div class="barre-outils">
      <label class="etiquette">Map
        <select class="champ" id="f-map">
          ${maps.map((m) => `<option value="${echapper(m.nom)}">${echapper(m.nom)} (${nb(m.nom)})</option>`).join("")}
        </select>
      </label>
      <label class="etiquette">Agent
        <select class="champ" id="f-agent">
          <option value="">Tous</option>
          ${agents.map((a) => `<option value="${echapper(a.nom)}">${echapper(a.nom)}</option>`).join("")}
        </select>
      </label>
      <label class="etiquette">Camp
        <select class="champ" id="f-camp">
          <option value="">Tous</option>
          ${Object.entries(CAMPS).map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}
        </select>
      </label>
      <label class="etiquette">Site
        <select class="champ" id="f-site">
          <option value="">Tous</option>
          ${SITES.map((s) => `<option value="${s}">${s}</option>`).join("")}
        </select>
      </label>
      <button class="btn btn-accent" id="b-editeur" style="margin-left:auto"></button>
    </div>
    <div class="disposition-lineups">
      <div id="colonne"></div>
      <div class="colonne-carte">
        <div class="panneau">
          <div class="minimap-options">
            <label><input type="checkbox" id="opt-callouts" checked> Noms des zones</label>
          </div>
          <div id="zone-minimap"></div>
          <div id="zone-legende"></div>
        </div>
      </div>
    </div>`;

  const lier = (id, cle) => {
    const champ = document.getElementById(id);
    champ.value = etat[cle];
    champ.addEventListener("change", () => {
      etat[cle] = champ.value;
      etat.actif = null;
      if (cle === "map") {
        brouillon.depuis = brouillon.vers = null; // les points n'ont plus de sens sur une autre map
        dessinerMinimap();
      }
      dessinerColonne();
    });
  };
  lier("f-map", "map");
  lier("f-agent", "agent");
  lier("f-camp", "camp");
  lier("f-site", "site");

  document.getElementById("b-editeur").addEventListener("click", () => {
    etat.editeur = !etat.editeur;
    etat.actif = null;
    dessinerColonne();
  });
  document.getElementById("opt-callouts").addEventListener("change", (e) => minimap?.afficherCallouts(e.target.checked));
}

function mapCourante() {
  return maps.find((m) => m.nom === etat.map);
}

function dessinerMinimap() {
  minimap = creerMinimap(mapCourante(), { afficherCallouts: document.getElementById("opt-callouts").checked });
  document.getElementById("zone-minimap").replaceChildren(minimap.element);
  document.getElementById("zone-legende").replaceChildren(legendeLineups());
}

function lineupsFiltres() {
  return lineups.filter(
    (l) =>
      l.map === etat.map &&
      (!etat.agent || l.agent === etat.agent) &&
      (!etat.camp || l.camp === etat.camp) &&
      (!etat.site || l.site === etat.site)
  );
}

function dessinerColonne() {
  ecrireAncre({ map: etat.map, agent: etat.agent, camp: etat.camp, site: etat.site, editeur: etat.editeur ? "1" : "" });
  document.getElementById("b-editeur").textContent = etat.editeur ? "← Retour aux lineups" : "+ Proposer un lineup";
  if (etat.editeur) return dessinerEditeur();
  minimap.modeEdition(null);

  const liste = lineupsFiltres();
  minimap.dessinerLineups(liste, etat.actif);
  const colonne = document.getElementById("colonne");

  if (!liste.length) {
    colonne.innerHTML = `
      <div class="vide">
        Aucun lineup pour ces filtres sur ${echapper(etat.map)}.<br>
        Sois le premier à en proposer un avec le bouton « Proposer un lineup » !
      </div>`;
    return;
  }

  colonne.innerHTML = `<div class="liste-lineups">${liste.map(carteLineup).join("")}</div>`;
  colonne.querySelectorAll(".carte-lineup").forEach((carte) => {
    const activer = () => {
      etat.actif = etat.actif === carte.dataset.id ? null : carte.dataset.id;
      colonne.querySelectorAll(".carte-lineup").forEach((c) => c.classList.toggle("actif", c.dataset.id === etat.actif));
      minimap.dessinerLineups(liste, etat.actif);
    };
    carte.addEventListener("click", (e) => {
      if (!e.target.closest("a")) activer();
    });
    carte.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activer();
      }
    });
  });
}

function carteLineup(l) {
  const agent = parNomAgent.get(l.agent);
  const cap = agent?.capacites.find((c) => c.slot === l.slot);
  return `
    <article class="carte-lineup${l.id === etat.actif ? " actif" : ""}" data-id="${echapper(l.id)}" tabindex="0" aria-label="${echapper(l.titre)}">
      <div class="haut">
        ${agent ? `<img src="${agent.icone}" alt="">` : ""}
        ${cap?.icone ? `<img class="cap" src="${cap.icone}" alt="">` : ""}
        <div>
          <h3>${echapper(l.titre)}</h3>
          <div class="sous">${echapper(l.agent)}${cap ? ` · <span class="touche">${cap.touche}</span> ${echapper(cap.nom)}` : ""}</div>
        </div>
      </div>
      <div class="badges">
        <span class="badge badge-accent">${CAMPS[l.camp] || echapper(l.camp)}</span>
        <span class="badge">Site ${echapper(l.site)}</span>
        ${l.exemple ? `<span class="badge badge-alerte" title="Entrée d'exemple : position approximative">Exemple</span>` : ""}
      </div>
      <ol>${(l.etapes || []).map((e) => `<li>${echapper(e)}</li>`).join("")}</ol>
      <div class="meta-lineup">
        ${l.video ? `<a href="${echapper(l.video)}" target="_blank" rel="noopener">▶ Voir la vidéo</a>` : ""}
        ${l.auteur ? `<span>Proposé par ${echapper(l.auteur)}</span>` : ""}
      </div>
    </article>`;
}

// --- Éditeur ---------------------------------------------------------------

const brouillon = { agent: "", slot: "", camp: "attaque", site: "A", titre: "", etapes: "", video: "", auteur: "", depuis: null, vers: null };

function dessinerEditeur() {
  const colonne = document.getElementById("colonne");
  if (!brouillon.agent) brouillon.agent = etat.agent || agents[0].nom;

  colonne.innerHTML = `
    <div class="panneau editeur" style="margin-top:0">
      <h2>Proposer un lineup</h2>
      <p class="muet">Remplis le formulaire, place les deux points sur la minimap, puis copie le résultat dans <code>data/lineups.json</code>.</p>
      <div class="formulaire">
        <label class="etiquette">Agent
          <select class="champ" data-champ="agent">${agents.map((a) => `<option>${echapper(a.nom)}</option>`).join("")}</select>
        </label>
        <label class="etiquette">Compétence
          <select class="champ" data-champ="slot" id="e-slot"></select>
        </label>
        <label class="etiquette">Camp
          <select class="champ" data-champ="camp">${Object.entries(CAMPS).map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>
        </label>
        <label class="etiquette">Site
          <select class="champ" data-champ="site">${SITES.map((s) => `<option>${s}</option>`).join("")}</select>
        </label>
        <label class="etiquette pleine-largeur">Titre
          <input class="champ" data-champ="titre" placeholder="Ex. : Flèche de reco sur le site B depuis B Main">
        </label>
        <label class="etiquette pleine-largeur">Étapes (une par ligne)
          <textarea class="champ" data-champ="etapes" placeholder="Se placer contre la caisse…&#10;Viser le coin de l'antenne…&#10;Tirer avec 2 rebonds, pleine charge."></textarea>
        </label>
        <label class="etiquette">Lien vidéo (optionnel)
          <input class="champ" data-champ="video" type="url" placeholder="https://…">
        </label>
        <label class="etiquette">Ton pseudo
          <input class="champ" data-champ="auteur" placeholder="pseudo GitHub">
        </label>
      </div>
      <p class="etape-clic" id="consigne"></p>
      <p><button class="btn" id="e-reset">Replacer les points</button></p>
      <h3>Entrée à copier</h3>
      <pre id="e-json"></pre>
      <p style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-accent" id="e-copier">Copier le JSON</button>
        <a class="btn" href="${URL_DEPOT}/edit/main/data/lineups.json" target="_blank" rel="noopener">Ouvrir lineups.json sur GitHub</a>
      </p>
    </div>`;

  colonne.querySelectorAll("[data-champ]").forEach((champ) => {
    const cle = champ.dataset.champ;
    if (cle !== "slot") champ.value = brouillon[cle];
    champ.addEventListener("input", () => {
      brouillon[cle] = champ.value;
      if (cle === "agent") remplirCompetences();
      majApercu();
    });
  });
  remplirCompetences();

  document.getElementById("e-reset").addEventListener("click", () => {
    brouillon.depuis = brouillon.vers = null;
    majApercu();
  });
  document.getElementById("e-copier").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(document.getElementById("e-json").textContent);
      e.target.textContent = "Copié !";
    } catch {
      e.target.textContent = "Sélectionne le texte et copie-le à la main";
    }
    setTimeout(() => (e.target.textContent = "Copier le JSON"), 2000);
  });

  // Clic sur la minimap : 1er clic = position, 2e clic = cible, puis on recommence.
  minimap.modeEdition((point) => {
    if (!brouillon.depuis || brouillon.vers) {
      brouillon.depuis = point;
      brouillon.vers = null;
    } else {
      brouillon.vers = point;
    }
    majApercu();
  });
  majApercu();
}

function remplirCompetences() {
  const agent = parNomAgent.get(brouillon.agent);
  const select = document.getElementById("e-slot");
  const caps = (agent?.capacites || []).filter((c) => c.slot !== "Passive");
  select.innerHTML = caps.map((c) => `<option value="${c.slot}">${c.touche} · ${echapper(c.nom)}</option>`).join("");
  if (!caps.some((c) => c.slot === brouillon.slot)) brouillon.slot = caps[0]?.slot || "";
  select.value = brouillon.slot;
}

function idDepuis(texte) {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function majApercu() {
  const consigne = document.getElementById("consigne");
  consigne.innerHTML = !brouillon.depuis
    ? "① Clique sur la minimap pour placer <strong>ta position</strong>."
    : !brouillon.vers
    ? "② Clique maintenant sur <strong>le point visé</strong> (là où la compétence atterrit)."
    : "✓ Les deux points sont placés. Un nouveau clic recommence.";

  const apercu = [];
  if (brouillon.depuis) apercu.push({ id: "apercu", depuis: brouillon.depuis, vers: brouillon.vers });
  minimap.dessinerLineups(apercu, null);

  const entree = {
    id: idDepuis(`${etat.map}-${brouillon.agent}-${brouillon.titre || "lineup"}`),
    map: etat.map,
    agent: brouillon.agent,
    slot: brouillon.slot,
    camp: brouillon.camp,
    site: brouillon.site,
    titre: brouillon.titre,
    etapes: brouillon.etapes.split("\n").map((e) => e.trim()).filter(Boolean),
    depuis: brouillon.depuis,
    vers: brouillon.vers,
    video: brouillon.video,
    auteur: brouillon.auteur,
  };
  document.getElementById("e-json").textContent = JSON.stringify(entree, null, 2);
}

demarrer();
