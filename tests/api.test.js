// Tests de api.js : conversion des coordonnées et repli sur data/api/
// quand valorant-api.com est injoignable.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Environnement « navigateur » minimal : pas de localStorage (comme en
// navigation privée stricte) et un window qui reçoit les événements.
globalThis.window = new EventTarget();
console.warn = () => {}; // le repli prévient dans la console : inutile ici

// fetch simulé : l'API est en panne, les fichiers locaux sont lus sur le disque.
globalThis.fetch = async (url) => {
  if (String(url).startsWith("https://")) throw new TypeError("réseau indisponible");
  const contenu = await readFile(new URL(`../${url}`, import.meta.url), "utf-8");
  return { ok: true, json: async () => JSON.parse(contenu) };
};

const api = await import("../assets/js/api.js");

test("versMinimap : inverse les axes et applique l'échelle", () => {
  const map = { xMultiplier: 2, yMultiplier: 3, xScalarToAdd: 0.1, yScalarToAdd: 0.2 };
  assert.deepEqual(api.versMinimap(map, { x: 1, y: 10 }), { x: 20.1, y: 3.2 });
});

test("repli : les agents viennent de data/api/ et un événement est envoyé", async () => {
  const recus = [];
  window.addEventListener("valo-atlas:secours", (e) => recus.push(e.detail));
  const agents = await api.getAgents();
  assert.ok(agents.length > 20, "il devrait y avoir plus de 20 agents");
  for (const a of agents) {
    assert.ok(a.nom && a.role?.nom, `agent incomplet : ${JSON.stringify(a.nom)}`);
    assert.ok(a.capacites.length >= 4, `${a.nom} a moins de 4 compétences`);
  }
  assert.equal(recus.length, 1);
  assert.match(recus[0].date, /^\d{4}-\d{2}-\d{2}$/);
});

test("repli : les maps compétitives ont leurs zones placées sur la minimap", async () => {
  const maps = await api.getMaps();
  assert.ok(maps.some((m) => m.nom === "Ascent"));
  for (const m of maps) {
    assert.ok(m.callouts.length > 0, `${m.nom} sans zones`);
    for (const c of m.callouts) {
      assert.ok(c.x > -0.1 && c.x < 1.1 && c.y > -0.1 && c.y < 1.1, `${m.nom} / ${c.nom} hors de la minimap`);
    }
  }
});

test("repli : les armes ont des paliers de dégâts et un prix", async () => {
  const armes = await api.getArmes();
  const vandal = armes.find((a) => a.nom === "Vandal");
  assert.ok(vandal, "Vandal introuvable");
  assert.ok(vandal.portees.length > 0);
  assert.ok(vandal.prix > 0 && vandal.cadence > 0);
});
