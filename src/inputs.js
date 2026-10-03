// Saisie des calculateurs : lecture des nombres « à la française », valeurs par défaut et préparation pour compute().
import { CALCS } from './calcs.js';

/** « 2,5 » → 2.5 ; « 1 200 » → 1200 ; « −7 » → -7 ; texte vide ou invalide → NaN. */
export function parseNum(raw) {
  const s = String(raw ?? '')
    .replace(/[\s  ]/g, '')
    .replace(/[−–]/g, '-')
    .replace(',', '.');
  return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN;
}

/** Nombre affiché dans un champ (virgule décimale). */
export const showNum = (n) => String(n).replace('.', ',');

/** Valeurs par défaut d'un calculateur, sous forme de texte de saisie (tableaux : copie des lignes). */
export function defaults(id) {
  return Object.fromEntries(
    CALCS[id].inputs.map((i) => [
      i.id,
      i.type === 'table' ? i.rows.map((r) => r.map((x, k) => (i.cols[k][2] === 'num' ? showNum(x) : String(x)))) : i.type === 'num' ? showNum(i.value) : String(i.value),
    ]),
  );
}

/** Nombre saisi → texte compris par num() des calculateurs (virgule gardée pour l'affichage des étapes). */
const clean = (raw) => String(raw).replace(/[\s  ]/g, '').replace(/[−–]/g, '-');

const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Valeurs saisies → valeurs passées à compute(), plus la liste des saisies invalides.
 * Les noms de lignes des tableaux sont échappés : compute() les recopie dans les étapes affichées en HTML.
 */
export function prepare(id, raw) {
  const v = {};
  const bad = [];
  for (const i of CALCS[id].inputs) {
    const x = raw[i.id];
    if (i.type === 'num') {
      if (!Number.isFinite(parseNum(x))) bad.push({ id: i.id, label: i.label });
      v[i.id] = clean(x);
    } else if (i.type === 'table') {
      v[i.id] = x.map((row, ri) =>
        row.map((cell, ci) => {
          if (i.cols[ci][2] !== 'num') return escHtml(cell);
          if (!Number.isFinite(parseNum(cell))) bad.push({ id: i.id, row: ri, col: ci, label: `${i.cols[ci][1]}, ligne ${ri + 1}` });
          return clean(cell);
        }),
      );
    } else v[i.id] = x;
  }
  return { v, bad };
}
