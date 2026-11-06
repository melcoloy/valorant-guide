// ==========================================================================
// ui.js — éléments communs à toutes les pages (en-tête, pied de page,
// petites fonctions utilitaires).
// ==========================================================================

// Lien vers le dépôt GitHub du projet : à remplacer par l'adresse de ton dépôt.
export const URL_DEPOT = "https://github.com/melcoloy/valorant-guide";

const PAGES = [
  { id: "accueil", titre: "Accueil", href: "index.html" },
  { id: "agents", titre: "Agents", href: "agents.html" },
  { id: "maps", titre: "Maps", href: "maps.html" },
  { id: "meta", titre: "Agents par map", href: "meta.html" },
  { id: "lineups", titre: "Lineups", href: "lineups.html" },
  { id: "armes", titre: "Armes", href: "armes.html" },
];

// Ordre d'affichage des rôles
export const ORDRE_ROLES = ["Contrôleur", "Initiateur", "Sentinelle", "Duelliste"];

export function initPage(pageActive) {
  const entete = document.getElementById("entete");
  entete.className = "entete";
  entete.innerHTML = `
    <div class="conteneur">
      <a class="logo" href="index.html"><span class="logo-marque" aria-hidden="true"></span>Valo Atlas</a>
      <nav class="nav" aria-label="Navigation principale">
        ${PAGES.map(
          (p) => `<a href="${p.href}"${p.id === pageActive ? ' aria-current="page"' : ""}>${p.titre}</a>`
        ).join("")}
      </nav>
    </div>`;

  // api.js prévient quand valorant-api.com est injoignable et qu'il utilise
  // la copie de secours de data/api/ : on l'affiche une seule fois sous l'en-tête.
  window.addEventListener("valo-atlas:secours", (e) => {
    if (document.getElementById("bandeau-secours")) return;
    const quand = e.detail?.date ? ` du ${new Date(e.detail.date).toLocaleDateString("fr-FR")}` : "";
    entete.insertAdjacentHTML(
      "afterend",
      `<div class="conteneur"><div class="note" id="bandeau-secours" role="status" style="margin:16px 0 0">
        valorant-api.com ne répond pas : le site affiche une copie de ses données${echapper(quand)}.
        Les images peuvent ne pas s'afficher.</div></div>`
    );
  });

  const pied = document.getElementById("pied");
  pied.className = "pied";
  pied.innerHTML = `
    <div class="conteneur">
      <p>Projet de fan, gratuit et open source. Données et images :
        <a href="https://valorant-api.com" target="_blank" rel="noopener">valorant-api.com</a> ·
        <a href="${URL_DEPOT}" target="_blank" rel="noopener">Code source sur GitHub</a></p>
      <p>Valo Atlas isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games
        or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all
        associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
    </div>`;
}

// Échappe le texte pour l'insérer sans risque dans du HTML.
export function echapper(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Les descriptions de compétences contiennent des balises du jeu,
// par ex. "<whitebold>Fumigène</>" : on les transforme en <span> colorés.
export function formaterDescription(texte) {
  return echapper(texte)
    .replace(/&lt;([a-zA-Z]+)&gt;/g, '<span class="fx-$1">')
    .replace(/&lt;\/&gt;/g, "</span>");
}

// Crée un élément HTML à partir d'une chaîne.
export function html(chaine) {
  const modele = document.createElement("template");
  modele.innerHTML = chaine.trim();
  return modele.content.firstElementChild;
}

export function afficherChargement(conteneur, message = "Chargement des données…") {
  conteneur.innerHTML = `<div class="chargement" role="status">${echapper(message)}</div>`;
}

export function afficherErreur(conteneur, erreur) {
  console.error(erreur);
  conteneur.innerHTML = `
    <div class="erreur" role="alert">
      <strong>Impossible de charger les données.</strong>
      <p style="margin:6px 0 0">${echapper(erreur.message || erreur)}</p>
      <p style="margin:6px 0 0" class="muet">Si tu as ouvert le fichier directement (file://), lance plutôt un petit
      serveur local : <code>python -m http.server</code> puis ouvre http://localhost:8000.</p>
    </div>`;
}

// Regroupe une liste d'agents par rôle, dans l'ordre ORDRE_ROLES.
export function grouperParRole(agents) {
  const groupes = new Map(ORDRE_ROLES.map((r) => [r, []]));
  for (const a of agents) {
    const role = a.role?.nom || "Autre";
    if (!groupes.has(role)) groupes.set(role, []);
    groupes.get(role).push(a);
  }
  return groupes;
}

// Lit et écrit des paramètres dans l'ancre de l'URL (#map=Ascent&agent=Sova)
export function lireAncre() {
  const brut = location.hash.slice(1);
  if (!brut) return {};
  if (!brut.includes("=")) return { id: decodeURIComponent(brut) };
  return Object.fromEntries(new URLSearchParams(brut));
}

export function ecrireAncre(params) {
  const propres = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
  const cles = Object.keys(propres);
  // Un simple identifiant donne une adresse courte : agents.html#Jett
  const chaine =
    cles.length === 1 && cles[0] === "id"
      ? encodeURIComponent(propres.id)
      : new URLSearchParams(propres).toString();
  history.replaceState(null, "", chaine ? `#${chaine}` : location.pathname);
}

export function nombreFr(n, decimales = 0) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: decimales, minimumFractionDigits: 0 });
}
