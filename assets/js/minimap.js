// ==========================================================================
// minimap.js — affiche la minimap d'une map avec :
//   - les noms des zones (callouts) fournis par l'API ;
//   - des flèches de lineup (point de départ → point visé) ;
//   - un mode "édition" où l'on clique pour placer des points.
//
// Toutes les positions sont exprimées entre 0 et 1 :
//   x = 0 (bord gauche) → 1 (bord droit), y = 0 (haut) → 1 (bas).
// ==========================================================================

import { echapper } from "./ui.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const TAILLE = 1000; // le SVG est en coordonnées 0 → 1000

export function creerMinimap(map, { afficherCallouts = true } = {}) {
  const racine = document.createElement("div");
  racine.className = "minimap";
  racine.innerHTML = `<img src="${map.minimap}" alt="Minimap de ${echapper(map.nom)}" loading="lazy">`;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${TAILLE} ${TAILLE}`);
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `
    <defs>
      <marker id="pointe-${map.uuid}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" style="fill:var(--text)"></path>
      </marker>
    </defs>
    <g class="couche-lineups"></g>`;
  // Les noms des zones passent sous les flèches de lineup
  const coucheCallouts = document.createElement("div");
  racine.appendChild(coucheCallouts);
  racine.appendChild(svg);

  function dessinerCallouts(visible) {
    coucheCallouts.innerHTML = "";
    if (!visible) return;
    for (const c of map.callouts) {
      const etiquette = document.createElement("span");
      etiquette.className = "callout" + (c.spawn ? " spawn" : "");
      etiquette.textContent = c.nom;
      etiquette.style.left = `${c.x * 100}%`;
      etiquette.style.top = `${c.y * 100}%`;
      coucheCallouts.appendChild(etiquette);
    }
  }
  dessinerCallouts(afficherCallouts);

  const coucheLineups = svg.querySelector(".couche-lineups");

  // Dessine une liste de lineups. `actif` = id du lineup mis en avant.
  function dessinerLineups(lineups, actif = null) {
    coucheLineups.innerHTML = "";
    for (const lu of lineups) {
      if (!lu.depuis) continue;
      const g = document.createElementNS(SVG_NS, "g");
      g.classList.add("lu");
      if (actif) g.classList.add(lu.id === actif ? "actif" : "estompe");
      const x1 = lu.depuis.x * TAILLE, y1 = lu.depuis.y * TAILLE;
      if (!lu.vers) {
        // Point de départ seul (pendant l'édition)
        g.innerHTML = `<circle class="lu-depuis" cx="${x1}" cy="${y1}" r="16"></circle>`;
        coucheLineups.appendChild(g);
        continue;
      }
      const x2 = lu.vers.x * TAILLE, y2 = lu.vers.y * TAILLE;
      // On raccourcit la ligne pour que la pointe ne recouvre pas le point d'arrivée
      const dx = x2 - x1, dy = y2 - y1;
      const longueur = Math.hypot(dx, dy) || 1;
      const xf = x2 - (dx / longueur) * 22, yf = y2 - (dy / longueur) * 22;
      g.innerHTML = `
        <line class="lu-ligne" x1="${x1}" y1="${y1}" x2="${xf}" y2="${yf}" marker-end="url(#pointe-${map.uuid})"></line>
        <circle class="lu-depuis" cx="${x1}" cy="${y1}" r="16"></circle>
        <circle class="lu-vers" cx="${x2}" cy="${y2}" r="16"></circle>`;
      coucheLineups.appendChild(g);
    }
  }

  // Mode édition : chaque clic renvoie la position (0 → 1) à `rappel`.
  let rappelClic = null;
  racine.addEventListener("click", (e) => {
    if (!rappelClic) return;
    const r = racine.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    rappelClic({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
  });

  return {
    element: racine,
    dessinerLineups,
    afficherCallouts: dessinerCallouts,
    modeEdition(rappel) {
      rappelClic = rappel;
      racine.classList.toggle("mode-edition", Boolean(rappel));
    },
  };
}

// Petite légende placée sous la minimap
export function legendeLineups() {
  const div = document.createElement("div");
  div.className = "legende-mini";
  div.innerHTML = `
    <span><i style="background:var(--s1)"></i>Position du joueur</span>
    <span><i style="background:var(--accent)"></i>Point visé / zone d'impact</span>`;
  return div;
}
