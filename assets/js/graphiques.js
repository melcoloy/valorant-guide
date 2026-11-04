// ==========================================================================
// graphiques.js — petits graphiques SVG faits maison (sans bibliothèque).
//   - graphiqueCourbes : courbes "en escalier" (dégâts selon la distance)
//   - graphiqueBarres  : barres horizontales triées (temps pour tuer)
// Les deux se redessinent quand la largeur change et affichent une
// infobulle au survol.
// ==========================================================================

import { echapper } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";

function pasPropre(max, nbVise = 5) {
  const brut = max / nbVise;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * puissance >= brut) return m * puissance;
  return 10 * puissance;
}

function creerInfobulle(conteneur) {
  const bulle = document.createElement("div");
  bulle.className = "infobulle";
  conteneur.appendChild(bulle);
  return {
    afficher(htmlContenu, x, y) {
      bulle.innerHTML = htmlContenu;
      bulle.style.display = "block";
      const largeur = conteneur.clientWidth;
      const l = bulle.offsetWidth;
      // On place l'infobulle à droite du curseur, ou à gauche si ça déborde.
      const gauche = x + 14 + l > largeur ? x - 14 - l : x + 14;
      bulle.style.left = `${Math.max(0, gauche)}px`;
      bulle.style.top = `${Math.max(0, y - 10)}px`;
    },
    cacher() {
      bulle.style.display = "none";
    },
  };
}

function observerLargeur(conteneur, dessiner) {
  let derniere = 0;
  const ro = new ResizeObserver(() => {
    const l = Math.round(conteneur.clientWidth);
    if (l && l !== derniere) {
      derniere = l;
      dessiner(l);
    }
  });
  ro.observe(conteneur);
  return () => ro.disconnect();
}

// --------------------------------------------------------------------------
// Courbes en escalier
// series : [{ nom, couleur, paliers: [{ debut, fin, valeur }] }]
// options : { xMax, unite, titreX, marqueurX }
// --------------------------------------------------------------------------
export function graphiqueCourbes(conteneur, series, options) {
  const { xMax = 50, unite = "", titreX = "", marqueurX = null } = options;
  conteneur.innerHTML = "";
  conteneur.classList.add("graphique");
  const zone = document.createElement("div");
  conteneur.appendChild(zone);
  const bulle = creerInfobulle(conteneur);

  const valeurA = (s, x) => {
    const p = s.paliers.find((p) => x >= p.debut && x < p.fin) || s.paliers[s.paliers.length - 1];
    return p ? p.valeur : 0;
  };

  function dessiner(largeur) {
    const hauteur = Math.max(240, Math.min(340, largeur * 0.5));
    const m = { haut: 14, droite: largeur < 480 ? 16 : 92, bas: 42, gauche: 46 };
    const l = largeur - m.gauche - m.droite;
    const h = hauteur - m.haut - m.bas;
    const yMaxBrut = Math.max(1, ...series.flatMap((s) => s.paliers.map((p) => p.valeur)));
    const pasY = pasPropre(yMaxBrut);
    const yMax = Math.ceil(yMaxBrut / pasY) * pasY;
    const sx = (x) => m.gauche + (x / xMax) * l;
    const sy = (y) => m.haut + h - (y / yMax) * h;

    let svg = `<svg xmlns="${NS}" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="${echapper(options.description || "")}">`;
    // Grille horizontale + graduations Y
    for (let y = 0; y <= yMax; y += pasY) {
      svg += `<line x1="${m.gauche}" x2="${m.gauche + l}" y1="${sy(y)}" y2="${sy(y)}" style="stroke:var(--${y === 0 ? "axis" : "grid"})" stroke-width="1"/>`;
      svg += `<text x="${m.gauche - 8}" y="${sy(y) + 4}" text-anchor="end">${y}</text>`;
    }
    // Graduations X
    const pasX = xMax <= 50 ? 10 : pasPropre(xMax);
    for (let x = 0; x <= xMax; x += pasX) {
      svg += `<text x="${sx(x)}" y="${m.haut + h + 18}" text-anchor="middle">${x}</text>`;
    }
    svg += `<text x="${m.gauche + l / 2}" y="${hauteur - 4}" text-anchor="middle">${echapper(titreX)}</text>`;

    // Marqueur de distance choisie
    if (marqueurX !== null) {
      svg += `<line x1="${sx(marqueurX)}" x2="${sx(marqueurX)}" y1="${m.haut}" y2="${m.haut + h}" style="stroke:var(--accent)" stroke-width="1"/>`;
    }

    // Courbes
    for (const s of series) {
      let d = "";
      s.paliers.forEach((p, i) => {
        const x0 = sx(p.debut), x1 = sx(Math.min(p.fin, xMax)), y = sy(p.valeur);
        d += i === 0 ? `M${x0},${y}` : `V${y}`;
        d += `H${x1}`;
      });
      svg += `<path d="${d}" fill="none" style="stroke:${s.couleur}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }

    // Étiquettes en bout de courbe (seulement si elles ne se chevauchent pas)
    if (m.droite > 40) {
      const fins = series.map((s) => ({ s, y: sy(valeurA(s, xMax)) })).sort((a, b) => a.y - b.y);
      const chevauche = fins.some((f, i) => i > 0 && f.y - fins[i - 1].y < 15);
      if (!chevauche) {
        for (const { s, y } of fins) {
          svg += `<text class="etiquette-serie" x="${sx(xMax) + 8}" y="${y + 4}">${echapper(s.nom)}</text>`;
        }
      }
    }

    // Calque de survol : ligne verticale + points
    svg += `<g class="survol" style="display:none">
        <line class="survol-ligne" y1="${m.haut}" y2="${m.haut + h}" style="stroke:var(--muted)" stroke-width="1"/>
        ${series.map((s) => `<circle r="5" style="fill:${s.couleur};stroke:var(--surface)" stroke-width="2"/>`).join("")}
      </g>
      <rect class="capteur" x="${m.gauche}" y="${m.haut}" width="${l}" height="${h}" fill="transparent"/>`;
    svg += `</svg>`;
    zone.innerHTML = svg;

    const el = zone.querySelector("svg");
    const groupe = el.querySelector(".survol");
    const ligne = el.querySelector(".survol-ligne");
    const points = groupe.querySelectorAll("circle");
    const capteur = el.querySelector(".capteur");

    capteur.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const x = Math.max(0, Math.min(xMax, Math.round(((px - m.gauche) / l) * xMax)));
      groupe.style.display = "";
      ligne.setAttribute("x1", sx(x));
      ligne.setAttribute("x2", sx(x));
      const valeurs = series.map((s, i) => {
        const v = valeurA(s, x);
        points[i].setAttribute("cx", sx(x));
        points[i].setAttribute("cy", sy(v));
        return { s, v };
      });
      valeurs.sort((a, b) => b.v - a.v);
      bulle.afficher(
        `<div class="titre">${x} ${unite}</div>` +
          valeurs
            .map(({ s, v }) => `<div class="ligne"><span><i style="background:${s.couleur}"></i>${echapper(s.nom)}</span><strong>${Math.round(v * 10) / 10}</strong></div>`)
            .join(""),
        px,
        e.clientY - r.top
      );
    });
    capteur.addEventListener("pointerleave", () => {
      groupe.style.display = "none";
      bulle.cacher();
    });
  }

  return observerLargeur(conteneur, dessiner);
}

// --------------------------------------------------------------------------
// Barres horizontales
// elements : [{ nom, valeur (nombre ou null), etiquette, details: [[libellé, valeur]] }]
// --------------------------------------------------------------------------
export function graphiqueBarres(conteneur, elements, options = {}) {
  const { couleur = "var(--s1)", titreX = "", texteNul = "—" } = options;
  conteneur.innerHTML = "";
  conteneur.classList.add("graphique");
  const zone = document.createElement("div");
  conteneur.appendChild(zone);
  const bulle = creerInfobulle(conteneur);

  function dessiner(largeur) {
    const ligneH = 28, epaisseur = 16, rayon = 4;
    const m = { haut: 24, droite: 120, bas: 8, gauche: 86 };
    const hauteur = m.haut + elements.length * ligneH + m.bas;
    const l = Math.max(60, largeur - m.gauche - m.droite);
    const maxBrut = Math.max(1, ...elements.map((e) => e.valeur ?? 0));
    const pas = pasPropre(maxBrut, largeur < 480 ? 3 : 5);
    const max = Math.ceil(maxBrut / pas) * pas;
    const sx = (v) => m.gauche + (v / max) * l;

    let svg = `<svg xmlns="${NS}" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="${echapper(options.description || "")}">`;
    for (let v = 0; v <= max; v += pas) {
      svg += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${m.haut - 4}" y2="${hauteur - m.bas}" style="stroke:var(--${v === 0 ? "axis" : "grid"})" stroke-width="1"/>`;
      svg += `<text x="${sx(v)}" y="${m.haut - 10}" text-anchor="middle">${v}</text>`;
    }
    if (titreX) svg += `<text x="${m.gauche + l}" y="${m.haut - 10}" text-anchor="end" dx="${m.droite - 4}">${echapper(titreX)}</text>`;

    elements.forEach((e, i) => {
      const y = m.haut + i * ligneH + (ligneH - epaisseur) / 2;
      const milieu = y + epaisseur / 2 + 4;
      svg += `<g class="barre-ligne" data-i="${i}">`;
      svg += `<rect x="0" y="${m.haut + i * ligneH}" width="${largeur}" height="${ligneH}" fill="transparent"/>`;
      svg += `<text class="nom-barre" x="${m.gauche - 8}" y="${milieu}" text-anchor="end">${echapper(e.nom)}</text>`;
      if (e.valeur === null) {
        svg += `<text class="etiquette-barre" x="${m.gauche + 6}" y="${milieu}">${echapper(texteNul)}</text>`;
      } else {
        const x0 = sx(0), x1 = Math.max(sx(e.valeur), x0 + 2);
        const r = Math.min(rayon, x1 - x0);
        svg += `<path d="M${x0},${y} H${x1 - r} Q${x1},${y} ${x1},${y + r} V${y + epaisseur - r} Q${x1},${y + epaisseur} ${x1 - r},${y + epaisseur} H${x0} Z" style="fill:${couleur}"/>`;
        svg += `<text class="etiquette-barre" x="${x1 + 6}" y="${milieu}">${echapper(e.etiquette)}</text>`;
      }
      svg += `</g>`;
    });
    svg += `</svg>`;
    zone.innerHTML = svg;

    const el = zone.querySelector("svg");
    el.querySelectorAll(".barre-ligne").forEach((g) => {
      g.addEventListener("pointermove", (ev) => {
        const e = elements[g.dataset.i];
        const r = el.getBoundingClientRect();
        g.querySelector("rect").setAttribute("fill", "rgba(255,255,255,0.04)");
        bulle.afficher(
          `<div class="titre">${echapper(e.nom)}</div>` +
            (e.details || []).map(([k, v]) => `<div class="ligne"><span>${echapper(k)}</span><strong>${echapper(v)}</strong></div>`).join(""),
          ev.clientX - r.left,
          ev.clientY - r.top
        );
      });
      g.addEventListener("pointerleave", () => {
        g.querySelector("rect").setAttribute("fill", "transparent");
        bulle.cacher();
      });
    });
  }

  return observerLargeur(conteneur, dessiner);
}
