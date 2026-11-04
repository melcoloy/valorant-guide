// Page Maps : liste des maps compétitives + vue détaillée d'une map
// (minimap annotée, agents conseillés, compo type, lineups).
import { getMaps, getAgents, getMeta, getLineups } from "./api.js";
import {
  initPage, echapper, afficherChargement, afficherErreur,
  grouperParRole, lireAncre, ecrireAncre,
} from "./ui.js";
import { creerMinimap, legendeLineups } from "./minimap.js";

initPage("maps");

const contenu = document.getElementById("contenu");
let maps = [], agents = [], meta = { maps: {} }, lineups = [];

async function demarrer() {
  afficherChargement(contenu);
  try {
    [maps, agents, meta, lineups] = await Promise.all([
      getMaps(),
      getAgents(),
      getMeta().catch(() => ({ maps: {} })),
      getLineups().then((d) => d.lineups).catch(() => []),
    ]);
  } catch (e) {
    afficherErreur(contenu, e);
    return;
  }
  router();
  window.addEventListener("hashchange", router);
}

function router() {
  const { id } = lireAncre();
  const map = id && maps.find((m) => m.nom.toLowerCase() === id.toLowerCase());
  if (map) dessinerDetail(map);
  else dessinerListe();
  window.scrollTo(0, 0);
}

function dessinerListe() {
  document.title = "Maps · Valo Atlas";
  contenu.innerHTML = `
    <div class="titre-page">
      <div class="surtitre">Encyclopédie</div>
      <h1>Maps</h1>
      <p>Les maps du mode compétitif. Ouvre une map pour voir sa minimap avec le nom de chaque zone, les agents conseillés et les lineups.</p>
    </div>
    <div class="grille grille-large">
      ${maps
        .map(
          (m) => `
        <a class="carte carte-map" href="#${encodeURIComponent(m.nom)}">
          <div class="visuel"><img src="${m.splash}" alt="" loading="lazy"></div>
          <div class="infos">
            <span class="nom">${echapper(m.nom)}</span>
            <span class="badge">${echapper(m.sites)}</span>
          </div>
        </a>`
        )
        .join("")}
    </div>`;
}

function dessinerDetail(map) {
  document.title = `${map.nom} · Valo Atlas`;
  const infos = meta.maps?.[map.nom];
  const lineupsMap = lineups.filter((l) => l.map === map.nom);
  const parNom = new Map(agents.map((a) => [a.nom, a]));

  contenu.innerHTML = `
    <a class="lien-retour" href="maps.html">← Toutes les maps</a>
    <div class="map-hero">
      <img src="${map.splash}" alt="">
      <div class="texte">
        <div class="surtitre">${echapper(map.sites)}${map.coordonnees ? ` · ${echapper(map.coordonnees)}` : ""}</div>
        <h1>${echapper(map.nom)}</h1>
        ${map.description ? `<p>${echapper(map.description)}</p>` : ""}
      </div>
    </div>

    <div class="deux-colonnes">
      <div class="panneau">
        <div class="minimap-options">
          <label><input type="checkbox" id="opt-callouts" checked> Noms des zones</label>
          <label><input type="checkbox" id="opt-lineups" ${lineupsMap.length ? "checked" : "disabled"}> Lineups (${lineupsMap.length})</label>
        </div>
        <div id="zone-minimap"></div>
        <div id="zone-legende"></div>
      </div>

      <div>
        <div class="panneau">
          <h2>Le style de la map</h2>
          ${
            infos
              ? `${infos.aConfirmer ? `<div class="note" style="margin-bottom:12px"><span class="badge badge-alerte">À confirmer</span>
                   Analyse déduite de la forme de la map, pas encore de l'expérience en jeu. Tu y joues ? Corrige-la dans <code>data/meta-maps.json</code>.</div>` : ""}
                 <p>${echapper(infos.resume)}</p>
                 <div class="carac">${(infos.caracteristiques || []).map((c) => `<span class="badge">${echapper(c)}</span>`).join("")}</div>`
              : `<p class="muet">Pas encore d'analyse pour cette map. Ajoute-la dans <code>data/meta-maps.json</code> !</p>`
          }
        </div>

        ${infos?.compo?.length ? `
        <div class="panneau">
          <h2>Compo type</h2>
          <div class="compo">
            ${infos.compo
              .map((nom) => {
                const a = parNom.get(nom);
                return `<a href="agents.html#${encodeURIComponent(nom)}">${a ? `<img src="${a.icone}" alt="">` : ""}${echapper(nom)}</a>`;
              })
              .join("")}
          </div>
        </div>` : ""}

        ${infos?.agents?.length ? `
        <div class="panneau">
          <h2>Agents conseillés</h2>
          ${dessinerRecommandations(infos.agents, parNom)}
        </div>` : ""}
      </div>
    </div>

    <div class="panneau" style="margin-top:20px">
      <h2>Lineups sur ${echapper(map.nom)}</h2>
      ${
        lineupsMap.length
          ? `<p>${lineupsMap.length} lineup(s) disponible(s).</p>
             <a class="btn btn-accent" href="lineups.html#map=${encodeURIComponent(map.nom)}">Voir les lineups de ${echapper(map.nom)}</a>`
          : `<p class="muet">Aucun lineup pour l'instant.</p>
             <a class="btn" href="lineups.html#map=${encodeURIComponent(map.nom)}&editeur=1">Proposer un lineup</a>`
      }
    </div>`;

  const minimap = creerMinimap(map);
  document.getElementById("zone-minimap").appendChild(minimap.element);
  const optLineups = document.getElementById("opt-lineups");
  const majLineups = () => {
    minimap.dessinerLineups(optLineups.checked ? lineupsMap : []);
    document.getElementById("zone-legende").replaceChildren(...(optLineups.checked ? [legendeLineups()] : []));
  };
  majLineups();
  optLineups.addEventListener("change", majLineups);
  document.getElementById("opt-callouts").addEventListener("change", (e) => minimap.afficherCallouts(e.target.checked));
}

// Recommandations regroupées par rôle (le rôle vient de l'API, pas du JSON)
function dessinerRecommandations(recos, parNom) {
  const avecAgent = recos.map((r) => ({ ...r, agent: parNom.get(r.nom) })).filter((r) => r.agent);
  const groupes = grouperParRole(avecAgent.map((r) => ({ ...r.agent, reco: r })));
  return [...groupes]
    .filter(([, liste]) => liste.length)
    .map(
      ([role, liste]) => `
      <div class="role-bloc">
        <h4><img src="${liste[0].role?.icone || ""}" alt="">${echapper(role)}</h4>
        ${liste
          .map(
            (a) => `
          <a class="reco" href="agents.html#${encodeURIComponent(a.nom)}">
            <img src="${a.icone}" alt="">
            <div><strong>${echapper(a.nom)}</strong><span>${echapper(a.reco.pourquoi)}</span></div>
          </a>`
          )
          .join("")}
      </div>`
    )
    .join("");
}

demarrer();
