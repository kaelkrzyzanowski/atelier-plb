// Valeurs attendues reprises des « cas test » documentés dans la version web (commentaires de CALCS), tolérance ± 1 %.
import { describe, expect, it } from 'vitest';
import { CALCS } from '../src/calcs.js';
import { defaults, parseNum, prepare } from '../src/inputs.js';

/** Lance un calculateur avec ses valeurs par défaut, éventuellement modifiées, en passant par la saisie de l'app. */
const run = (id, over = {}) => {
  const { v, bad } = prepare(id, { ...defaults(id), ...over });
  expect(bad).toEqual([]);
  return CALCS[id].compute(v);
};
/** Valeur numérique d'une ligne de résultat (« 1 234,5 » → 1234.5). */
const val = (r, label) => {
  const row = r.res.find((x) => x[0] === label);
  expect(row, `ligne « ${label} »`).toBeTruthy();
  return parseNum(String(row[1]).split(/ (?=[^\d])/)[0]);
};
const txt = (r, label) => String(r.res.find((x) => x[0] === label)?.[1]);
const near = (got, want) => expect(Math.abs(got - want)).toBeLessThanOrEqual(Math.abs(want) * 0.01 + 1e-9);

describe('saisie', () => {
  it('nombres à la française', () => {
    expect(parseNum('2,5')).toBe(2.5);
    expect(parseNum('1 200')).toBe(1200);
    expect(parseNum('−7')).toBe(-7);
    expect(parseNum('')).toBeNaN();
    expect(parseNum('abc')).toBeNaN();
  });
  it('« 1 200 » est lu 1200 par les calculs', () => {
    near(val(run('vase', { V: '1 000' }), 'Volume dilaté'), 16.8);
  });
  it('champ vide ou ligne de tableau invalide signalés', () => {
    expect(prepare('vase', { ...defaults('vase'), V: '' }).bad.map((b) => b.id)).toEqual(['V']);
    const app = defaults('debitProbable').app;
    app[0][1] = 'x';
    expect(prepare('debitProbable', { ...defaults('debitProbable'), app }).bad).toMatchObject([{ id: 'app', row: 0, col: 1 }]);
  });
  it('noms de lignes échappés avant d’être recopiés dans les étapes', () => {
    const tr = defaults('pertesCharge').tr;
    tr[0][0] = '<b>x</b>';
    expect(prepare('pertesCharge', { ...defaults('pertesCharge'), tr }).v.tr[0][0]).toBe('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('calculateurs (valeurs par défaut)', () => {
  it('chaque calculateur aboutit', () => {
    for (const id of Object.keys(CALCS)) {
      const r = run(id);
      expect(['ok', 'warn', 'bad']).toContain(r.status);
      expect(r.res.length).toBeGreaterThan(0);
    }
  });
  it('debitProbable', () => {
    const r = run('debitProbable');
    near(val(r, 'Somme des débits de base ΣQb'), 3.56);
    near(val(r, 'Coefficient y'), 0.175);
    near(val(r, 'Débit probable Qp'), 0.621);
    near(val(r, 'Diamètre intérieur mini'), 23.0);
    expect(txt(r, 'Tube retenu')).toMatch(/^28×1/);
  });
  it('pertesCharge', () => {
    const r = run('pertesCharge');
    near(val(r, 'Pertes de charge totales'), 4.21);
    near(val(r, 'Pression nécessaire au compteur'), 3.18);
    expect(r.status).toBe('warn');
  });
  it('surpresseur', () => {
    const r = run('surpresseur');
    near(val(r, 'HMT'), 32.6);
    near(val(r, 'Volume utile'), 75);
    near(val(r, 'Volume total du réservoir'), 506);
  });
  it('ecs', () => {
    const r = run('ecs');
    near(val(r, 'Besoin journalier'), 3450);
    near(val(r, 'Volume en pointe'), 1380);
    near(val(r, 'Accumulation : volume de stockage'), 1725);
    near(val(r, 'Accumulation : puissance'), 16.7);
    expect(txt(r, 'Semi-instantané : stockage / puissance')).toBe('690 l / 24,1');
  });
  it('bouclage', () => {
    const r = run('bouclage');
    near(val(r, 'Pertes thermiques'), 0.65);
    near(val(r, 'Débit de bouclage'), 112);
    near(val(r, 'Vitesse dans le retour'), 0.27);
  });
  it('vase', () => {
    const r = run('vase');
    near(val(r, 'Coefficient de dilatation e'), 1.68);
    near(val(r, 'Volume de vase calculé'), 36.0);
    near(val(r, 'Taille commerciale'), 50);
  });
  it('euev', () => {
    const r = run('euev');
    near(val(r, 'ΣDU'), 27.4);
    near(val(r, 'Qww'), 2.62);
    expect(txt(r, 'Chute (DN mini)')).toMatch(/^DN100/);
    expect(txt(r, 'Collecteur PVC')).toBe('Ø110');
    near(val(r, 'Capacité collecteur'), 3.02);
    near(val(r, 'Vitesse collecteur'), 0.72);
  });
  it('ep', () => {
    const r = run('ep');
    near(val(r, 'Débit total'), 20);
    near(val(r, 'Di mini (Wyly-Eaton)'), 97);
    expect(r.res.filter((x) => x[0] === '→ Descente').map((x) => x[1])).toEqual(['Ø110', 'Ø200']);
    expect(txt(r, 'Collecteur (h/d 0,7)')).toMatch(/^Ø200/);
  });
  it('retention', () => {
    const r = run('retention');
    near(val(r, 'Surface active Sa'), 7100);
    near(val(r, 'Volume de rétention'), 176);
    near(val(r, 'Durée de pluie critique'), 195);
    near(val(r, 'Temps de vidange'), 4.9);
    expect(r.chart.pts.length).toBeGreaterThan(10);
  });
  it('recupEP', () => {
    const r = run('recupEP');
    near(val(r, 'Ressource annuelle'), 790);
    near(val(r, 'Besoin annuel'), 1656);
    near(val(r, 'Taux de couverture'), 48);
  });
  it('relevage', () => {
    const r = run('relevage');
    near(val(r, 'Vitesse de refoulement'), 0.9);
    near(val(r, 'Volume utile de bâche'), 270);
    near(val(r, 'HMT'), 6.1);
  });
  it('graisses', () => {
    const r = run('graisses');
    near(val(r, 'Débit de pointe Qs'), 5.9);
    expect(txt(r, 'Taille nominale retenue')).toBe('NS 10');
  });
  it('hydrocarbures', () => {
    const r = run('hydrocarbures');
    near(val(r, 'Débit de pluie Qr'), 40.5);
    expect(txt(r, 'Taille retenue')).toBe('NS 10');
    near(val(r, 'Volume du débourbeur'), 2000);
  });
  it('sanitaires', () => {
    const r = run('sanitaires');
    expect([0, 1, 2, 3].map((k) => r.res[k][1])).toEqual([15, 15, 30, 60]);
  });
  it('ria', () => {
    const r = run('ria');
    near(val(r, 'Débit par RIA'), 58.5);
    near(val(r, 'Pression nécessaire à la source'), 4.01);
    expect(r.status).toBe('ok');
  });
  it('sprinkleur', () => {
    const r = run('sprinkleur');
    near(val(r, 'Débit'), 1080);
    near(val(r, 'Volume de réserve'), 64.8);
  });
  it('en1717', () => {
    const r = run('en1717');
    expect(r.res[0][1]).toBe(5);
    expect(txt(r, 'Dispositifs admissibles')).toMatch(/^AA .*AB .*AD /);
  });
  it('calorifuge', () => {
    const r = run('calorifuge');
    near(val(r, 'Pertes tube nu'), 35.2);
    near(val(r, 'Pertes tube isolé'), 7.2);
    near(val(r, 'Économie annuelle'), 27300);
  });
  it('belier', () => {
    const r = run('belier');
    near(val(r, 'Surpression maxi'), 19.5);
    near(val(r, 'Temps critique 2L/a'), 0.046);
  });
  it('bacs', () => {
    expect(txt(run('bacs'), 'Situation')).toMatch(/1er janvier 2027/);
  });
  it('convert', () => {
    const r = run('convert');
    expect(txt(r, 'Débit')).toMatch(/3,60 m³\/h = 60,0 l\/min/);
    expect(txt(r, 'Pression')).toMatch(/30,59 mCE = 300,0 kPa/);
  });
});
