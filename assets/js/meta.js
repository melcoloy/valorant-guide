// Page "Agents par map" : matrice maps × rôles + agents les plus polyvalents.
import { getMaps, getAgents, getMeta } from "./api.js";
import { initPage, echapper, afficherChargement, afficherErreur, ORDRE_ROLES } from "./ui.js";

initPage("meta");

const contenu = document.getElementById("contenu");

async function demarrer() {
  afficherChargement(contenu);
  let maps, agents, meta;
  try {
    [maps, agents, meta] = await Promise.all([getMaps(), getAgents(), getMeta()]);
  } catch (e) {
    afficherErreur(contenu, e);
    return;
  }
  const parNom = new Map(agents.map((a) => [a.nom, a]));
  const roles = ORDRE_ROLES.map((nom) => agents.find((a) => a.role?.nom === nom)?.role).filter(Boolean);

  // --- Matrice ---
  const lignes = maps.map((m) => {
    const infos = meta.maps?.[m.nom];
    const cellules = roles.map((role) => {
      if (!infos) return `<td class="muet">—</td>`;
      const recos = (infos.agents || []).filter((r) => parNom.get(r.nom)?.role?.nom === role.nom);
      return `<td><div class="icones">${recos
        .map((r) => {
          const a = parNom.get(r.nom);
          const bulle = `${r.nom} : ${r.pourquoi}`;
          return `<a href="agents.html#${encodeURIComponent(r.nom)}" title="${echapper(bulle)}" aria-label="${echapper(bulle)}"><img src="${a.icone}" alt=""></a>`;
        })
        .join("")}</div></td>`;
    });
    return `
      <tr>
        <th scope="row" class="nom-map"><a href="maps.html#${encodeURIComponent(m.nom)}">${echapper(m.nom)}</a>
          ${!infos ? `<div><span class="badge badge-alerte">À compléter</span></div>`
            : infos.aConfirmer ? `<div><span class="badge badge-alerte" title="Analyse déduite de la forme de la map, à confirmer en jeu">À confirmer</span></div>` : ""}</th>
        ${cellules.join("")}
      </tr>`;
  });

  // --- Agents les plus polyvalents (nombre de maps où ils sont conseillés) ---
  const compte = new Map();
  for (const infos of Object.values(meta.maps || {})) {
    for (const r of infos.agents || []) compte.set(r.nom, (compte.get(r.nom) || 0) + 1);
  }
  const classement = [...compte]
    .filter(([nom]) => parNom.has(nom))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);
  const maxi = classement[0]?.[1] || 1;
  const nbMapsAnalysees = Object.keys(meta.maps || {}).length;

  contenu.innerHTML = `
    <div class="panneau">
      <p class="muet" style="margin-top:0">Survole (ou touche) une icône pour lire pourquoi l'agent est conseillé sur cette map.</p>
      <div class="table-defile" style="border:0">
        <table class="matrice">
          <thead>
            <tr><th scope="col">Map</th>${roles.map((r) => `<th scope="col"><img src="${r.icone}" alt="">${echapper(r.nom)}s</th>`).join("")}</tr>
          </thead>
          <tbody>${lignes.join("")}</tbody>
        </table>
      </div>
    </div>

    <div class="panneau">
      <h2>Les agents les plus polyvalents</h2>
      <p class="muet">Nombre de maps (sur ${nbMapsAnalysees} analysées) où l'agent fait partie des choix conseillés.</p>
      <div class="classement">
        ${classement
          .map(([nom, n]) => {
            const a = parNom.get(nom);
            return `
            <div class="ligne">
              <img src="${a.icone}" alt="">
              <a href="agents.html#${encodeURIComponent(nom)}" style="text-decoration:none">${echapper(nom)}</a>
              <div class="barre" style="width:${(n / maxi) * 100}%" aria-hidden="true"></div>
              <span class="nombre">${n}</span>
            </div>`;
          })
          .join("")}
      </div>
    </div>`;
}

demarrer();
