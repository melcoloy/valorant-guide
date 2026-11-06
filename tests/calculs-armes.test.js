// Tests des calculs de la page Armes. Lancer : npm test (ou node --test tests/)
import { test } from "node:test";
import assert from "node:assert/strict";
import { palier, degats, ballesPourTuer, analyser } from "../assets/js/calculs-armes.js";

// Arme fictive à deux paliers de distance
const fusil = {
  nom: "Fusil test",
  cadence: 10,
  chargeur: 25,
  plombs: 1,
  portees: [
    { debut: 0, fin: 30, tete: 150, corps: 40, jambes: 30 },
    { debut: 30, fin: 50, tete: 120, corps: 35, jambes: 25 },
  ],
};

const pompe = {
  nom: "Pompe test",
  cadence: 1,
  chargeur: 5,
  plombs: 15,
  portees: [{ debut: 0, fin: 50, tete: 20, corps: 10, jambes: 8 }],
};

test("palier : choisit la tranche de distance, borne de fin exclue", () => {
  assert.equal(palier(fusil, 0).debut, 0);
  assert.equal(palier(fusil, 29.9).debut, 0);
  assert.equal(palier(fusil, 30).debut, 30);
});

test("palier : au-delà de la portée max, garde le dernier palier", () => {
  assert.equal(palier(fusil, 80).debut, 30);
});

test("degats : multiplie par le nombre de plombs", () => {
  assert.equal(degats(fusil, 10, "corps"), 40);
  assert.equal(degats(pompe, 5, "corps"), 150);
});

test("degats : arme sans palier → 0", () => {
  assert.equal(degats({ ...fusil, portees: [] }, 10, "tete"), 0);
});

test("ballesPourTuer : arrondi supérieur, infini sans dégâts", () => {
  assert.equal(ballesPourTuer(40, 150), 4);
  assert.equal(ballesPourTuer(50, 150), 3);
  assert.equal(ballesPourTuer(150, 150), 1);
  assert.equal(ballesPourTuer(0, 150), Infinity);
});

test("analyser : TTK = (balles - 1) / cadence, en ms", () => {
  const r = analyser(fusil, { distance: 10, pv: 150, zone: "corps" });
  assert.equal(r.balles, 4);
  assert.equal(r.ttk, 300);
  assert.equal(r.dps, 400);
});

test("analyser : une seule balle → TTK nul", () => {
  const r = analyser(fusil, { distance: 10, pv: 150, zone: "tete" });
  assert.equal(r.balles, 1);
  assert.equal(r.ttk, 0);
});

test("analyser : chargeur insuffisant → TTK null", () => {
  const r = analyser({ ...fusil, chargeur: 3 }, { distance: 10, pv: 150, zone: "corps" });
  assert.equal(r.balles, 4);
  assert.equal(r.ttk, null);
});

test("analyser : le palier change avec la distance", () => {
  const r = analyser(fusil, { distance: 40, pv: 150, zone: "tete" });
  assert.equal(r.dmg, 120);
  assert.equal(r.balles, 2);
  assert.equal(r.ttk, 100);
});
