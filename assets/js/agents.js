// Page Agents : grille filtrable + fiche détaillée de chaque agent.
import { getAgents, getMeta, getLineups } from "./api.js";
import {
  initPage, echapper, formaterDescription, afficherChargement, afficherErreur,
  ORDRE_ROLES, lireAncre, ecrireAncre,
} from "./ui.js";

initPage("agents");

const contenu = document.getElementById("contenu");
const champRecherche = document.getElementById("recherche");
const zoneFiltres = document.getElementById("filtres-roles");
const fiche = document.getElementById("fiche");

let agents = [];
let meta = { maps: {} };
let lineups = [];
let roleActif = null;

async function demarrer() {
  afficherChargement(contenu);
  try {
    // Les agents sont indispensables ; la méta et les lineups sont un bonus.
    [agents, meta, lineups] = await Promise.all([
      getAgents(),
      getMeta().catch(() => ({ maps: {} })),
      getLineups().then((d) => d.lineups).catch(() => []),
    ]);
  } catch (e) {
    afficherErreur(contenu, e);
    return;
  }
  dessinerFiltres();
  dessinerGrille();

  const { id } = lireAncre();
  if (id) ouvrirFiche(id);

  // Ex. : retour arrière du navigateur, ou lien vers agents.html#Jett depuis cette page
  window.addEventListener("hashchange", () => {
    const { id } = lireAncre();
    if (id) ouvrirFiche(id);
    else if (fiche.open) fiche.close();
  });
}

function dessinerFiltres() {
  const roles = ORDRE_ROLES.map((nom) => agents.find((a) => a.role?.nom === nom)?.role).filter(Boolean);
  zoneFiltres.innerHTML =
    `<button class="puce" data-role="" aria-pressed="true">Tous</button>` +
    roles
      .map((r) => `<button class="puce" data-role="${echapper(r.nom)}" aria-pressed="false"><img src="${r.icone}" alt="">${echapper(r.nom)}</button>`)
      .join("");
  zoneFiltres.addEventListener("click", (e) => {
    const bouton = e.target.closest("button");
    if (!bouton) return;
    roleActif = bouton.dataset.role || null;
    zoneFiltres.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === bouton)));
    dessinerGrille();
  });
  champRecherche.addEventListener("input", dessinerGrille);
}

function dessinerGrille() {
  const recherche = champRecherche.value.trim().toLowerCase();
  const visibles = agents.filter(
    (a) => (!roleActif || a.role?.nom === roleActif) && (!recherche || a.nom.toLowerCase().includes(recherche))
  );
  if (!visibles.length) {
    contenu.innerHTML = `<div class="vide">Aucun agent ne correspond à ta recherche.</div>`;
    return;
  }
  contenu.innerHTML = `<div class="grille">${visibles
    .map(
      (a) => `
      <button class="carte carte-agent" data-agent="${echapper(a.nom)}">
        <div class="visuel" style="background:linear-gradient(160deg, ${a.couleurs[0] || "#1f232c"}55, transparent)">
          <img src="${a.icone}" alt="" loading="lazy">
        </div>
        <div class="infos">
          <div class="nom">${echapper(a.nom)}</div>
          <div class="role-ligne"><img src="${a.role?.icone || ""}" alt="">${echapper(a.role?.nom || "")}</div>
        </div>
      </button>`
    )
    .join("")}</div>`;
}

contenu.addEventListener("click", (e) => {
  const carte = e.target.closest("[data-agent]");
  if (carte) ouvrirFiche(carte.dataset.agent);
});

// Maps où l'agent est recommandé (d'après data/meta-maps.json)
function mapsConseillees(nomAgent) {
  return Object.entries(meta.maps || {})
    .map(([map, infos]) => ({ map, aConfirmer: infos.aConfirmer, reco: (infos.agents || []).find((r) => r.nom === nomAgent) }))
    .filter((x) => x.reco);
}

function ouvrirFiche(nom) {
  const a = agents.find((x) => x.nom.toLowerCase() === nom.toLowerCase());
  if (!a) return;
  const bonnesMaps = mapsConseillees(a.nom);
  const nbLineups = lineups.filter((l) => l.agent === a.nom).length;
  const [c1, c2] = a.couleurs;

  fiche.innerHTML = `
    <button class="btn fermer" id="fermer" aria-label="Fermer la fiche">✕</button>
    <div class="fiche-contenu">
      <div class="fiche-portrait" style="background:linear-gradient(180deg, ${c1 || "#1f232c"}, ${c2 || "#0f1115"})">
        ${a.fond ? `<img class="fond" src="${a.fond}" alt="">` : ""}
        <img class="portrait" src="${a.portrait}" alt="Portrait de ${echapper(a.nom)}">
      </div>
      <div class="fiche-texte">
        <div class="role-ligne"><img src="${a.role?.icone || ""}" alt="">${echapper(a.role?.nom || "")}</div>
        <h2 id="fiche-titre" style="font-size:2.4rem;margin-top:4px">${echapper(a.nom)}</h2>
        <p style="color:var(--text-2)">${echapper(a.description)}</p>

        <h3>Compétences</h3>
        <div class="capacites">
          ${a.capacites
            .map(
              (c) => `
            <div class="capacite">
              ${c.icone ? `<img class="icone" src="${c.icone}" alt="">` : `<div class="icone"></div>`}
              <div>
                <div class="entete-cap"><span class="touche" title="Touche par défaut">${c.touche}</span><span class="nom-cap">${echapper(c.nom)}</span></div>
                <p>${formaterDescription(c.description)}</p>
              </div>
            </div>`
            )
            .join("")}
        </div>

        <h3 style="margin-top:22px">Maps où ${echapper(a.nom)} est conseillé·e</h3>
        ${
          bonnesMaps.length
            ? `<div class="liste-maps-bonnes">${bonnesMaps
                .map(
                  ({ map, reco, aConfirmer }) =>
                    `<a href="maps.html#${encodeURIComponent(map)}"><strong>${echapper(map)}</strong>${
                      aConfirmer ? ` <span class="badge badge-alerte">À confirmer</span>` : ""
                    }<span>${echapper(reco.pourquoi)}</span></a>`
                )
                .join("")}</div>`
            : `<p class="muet">Pas encore de recommandation pour cet agent. Tu peux en ajouter dans <code>data/meta-maps.json</code>.</p>`
        }

        <p style="margin-top:18px">
          <a class="btn" href="lineups.html#agent=${encodeURIComponent(a.nom)}">
            Voir les lineups (${nbLineups})
          </a>
        </p>
      </div>
    </div>`;

  fiche.querySelector("#fermer").addEventListener("click", () => fiche.close());
  if (!fiche.open) fiche.showModal();
  fiche.scrollTop = 0;
  ecrireAncre({ id: a.nom });
}

fiche.addEventListener("close", () => ecrireAncre({}));
// Clic en dehors de la fiche = fermeture
fiche.addEventListener("click", (e) => {
  if (e.target === fiche) fiche.close();
});

demarrer();
