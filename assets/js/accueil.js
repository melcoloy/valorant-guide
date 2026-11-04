// Page d'accueil : chiffres clés + raccourcis vers les sections.
import { getAgents, getMaps, getArmes, getLineups } from "./api.js";
import { initPage, echapper } from "./ui.js";

initPage("accueil");

const SECTIONS = [
  { titre: "Agents", href: "agents.html", texte: "Rôles, compétences avec leurs touches, et les maps où chaque agent est le plus utile." },
  { titre: "Maps", href: "maps.html", texte: "Minimaps avec le nom de chaque zone, agents conseillés et compo type." },
  { titre: "Agents par map", href: "meta.html", texte: "Le tableau des agents à jouer sur chaque map, avec la raison de chaque choix." },
  { titre: "Lineups", href: "lineups.html", texte: "Base de lineups par map et par agent, avec un éditeur pour proposer les tiens." },
  { titre: "Armes", href: "armes.html", texte: "Dégâts selon la distance, balles et temps pour tuer, rapport qualité-prix." },
];

document.getElementById("sections").innerHTML = SECTIONS.map(
  (s) => `
  <a class="carte carte-section" href="${s.href}">
    <h3>${echapper(s.titre)}</h3>
    <p>${echapper(s.texte)}</p>
    <span class="fleche" aria-hidden="true">Ouvrir →</span>
  </a>`
).join("");

const stats = document.getElementById("stats");
const CHIFFRES = [
  ["Agents", getAgents],
  ["Maps compétitives", getMaps],
  ["Lineups", async () => (await getLineups()).lineups],
  ["Armes analysées", getArmes],
];

stats.innerHTML = CHIFFRES.map(
  ([libelle], i) => `<div class="stat"><div class="valeur" id="stat-${i}">…</div><div class="libelle">${libelle}</div></div>`
).join("");

CHIFFRES.forEach(async ([, charger], i) => {
  const cible = document.getElementById(`stat-${i}`);
  try {
    cible.textContent = (await charger()).length;
  } catch {
    cible.textContent = "—";
  }
});
