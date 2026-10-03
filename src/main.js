// Atelier PLB — calculateurs plomberie de pré-dimensionnement, pensés pour le chantier.
// Deux écrans : la liste des outils (#/) et un outil (#/<id>). Tout fonctionne hors ligne.
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './style.css';
import { Capacitor } from '@capacitor/core';
import { CALCS } from './calcs.js';
import { defaults, prepare } from './inputs.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const main = $('#main');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const plain = (html) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent.replace(/\s+/g, ' ').trim();
};
const withUnit = (val, unit) => (unit ? `${val} ${unit}` : String(val)); // espace insécable : l'unité ne passe pas seule à la ligne

/* ---------- Catalogue ---------- */
const GROUPS = [
  ['Eau froide et pression', ['debitProbable', 'pertesCharge', 'surpresseur', 'belier', 'en1717']],
  ['Eau chaude sanitaire', ['ecs', 'bouclage', 'vase', 'calorifuge']],
  ['Évacuations EU / EV', ['euev', 'relevage', 'graisses', 'hydrocarbures']],
  ['Eaux pluviales', ['ep', 'retention', 'recupEP']],
  ['Incendie', ['ria', 'sprinkleur']],
  ['Réglementaire et conversions', ['sanitaires', 'bacs', 'convert']],
];
/* Référence affichée sous le nom de l'outil */
const REF = {
  debitProbable: 'NF DTU 60.11 P1-1', pertesCharge: 'Colebrook-White / Flamant', surpresseur: 'Boyle-Mariotte, démarrages / h',
  belier: 'Δp = ρ·a·Δv, fermeture brusque ou lente', en1717: 'Catégories de fluide 1 à 5', ecs: 'Arrêté du 30 novembre 2005', bouclage: 'NF DTU 60.11 P1-2',
  vase: 'Vase sanitaire à membrane', calorifuge: 'Pertes thermiques linéiques', euev: 'NF EN 12056-2 / NF DTU 60.11 P2',
  relevage: 'NF EN 12050 / NF EN 12056-4', graisses: 'NF EN 1825-2', hydrocarbures: 'NF EN 858-2',
  ep: 'NF DTU 60.11 P3 / NF EN 12056-3', retention: 'Méthode des pluies (Montana)', recupEP: 'Arrêté du 12 juillet 2024',
  ria: 'NF EN 671-1 / APSAD R5', sprinkleur: 'NF EN 12845 / APSAD R1', sanitaires: 'Code du travail R.4228',
  bacs: 'Décret BACS modifié 2023', convert: 'Débit, pression, diamètres',
};
/* Résultats clés (indices dans res) : mis en avant et repris dans le résumé collant */
const KEYS = {
  debitProbable: [3, 5], pertesCharge: [3, 4], surpresseur: [0, 4], belier: [0], en1717: [0],
  ecs: [3, 4], bouclage: [1, 4], vase: [3], calorifuge: [1, 3],
  euev: [3, 4], relevage: [0, 3, 4], graisses: [2], hydrocarbures: [2, 3],
  ep: [3, 6], retention: [4], recupEP: [2, 3],
  ria: [1, 4], sprinkleur: [3, 5], sanitaires: [0, 2, 3], bacs: [0], convert: [],
};
const STATUS = { ok: 'Conforme', warn: 'À vérifier', bad: 'Non conforme' };

/* ---------- Mémoire locale : thème, dernières valeurs saisies, outils récents ---------- */
const KEY = 'atelier-plb-app-v1';
let S = { theme: null, vals: {}, recent: [] };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) S = Object.assign(S, JSON.parse(raw));
} catch {}
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {}
};
const rawVals = (id) => {
  const d = defaults(id);
  const v = (S.vals[id] ||= {});
  for (const k in d) if (v[k] === undefined) v[k] = d[k];
  return v;
};

/* ---------- Plateforme : Android (Capacitor) ou navigateur ---------- */
const native = Capacitor.isNativePlatform() ? import('./native.js') : null;

/* ---------- Thème ---------- */
const isDark = () => (S.theme ? S.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
function applyTheme() {
  if (S.theme) document.documentElement.setAttribute('data-theme', S.theme);
  else document.documentElement.removeAttribute('data-theme');
  native?.then((n) => n.setBarsStyle());
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
$('#themeBtn').addEventListener('click', () => {
  S.theme = isDark() ? 'light' : 'dark';
  applyTheme();
  save();
});

/* ---------- Toast ---------- */
let toastT;
function toast(msg) {
  let t = $('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 3000);
}

/* ---------- Accueil ---------- */
let query = '';
const chev = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const toolLink = (id) =>
  `<a class="tool" href="#/${id}"><span class="txt"><b>${esc(CALCS[id].title)}</b><small>${esc(REF[id] || '')}</small></span>${chev}</a>`;
function pageHome() {
  return `<div class="search" role="search"><input id="q" type="search" placeholder="Rechercher un outil (ECS, chute, vase…)" aria-label="Rechercher un outil" autocomplete="off" value="${esc(query)}"></div>
  <div id="lists"></div>
  <p class="foot">Pré-dimensionnement indicatif · référentiel au 1<sup>er</sup> octobre 2026 · à confirmer par une note de calcul.</p>`;
}
function fillLists() {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const match = (id) => {
    const c = CALCS[id];
    const x = norm([c.title, REF[id], plain(c.desc), ...c.inputs.map((i) => i.label)].join(' '));
    return words.every((w) => x.includes(w));
  };
  let h = '';
  if (!words.length) {
    const recent = S.recent.filter((id) => CALCS[id]).slice(0, 3);
    if (recent.length) h += `<section class="group"><h2>Récents</h2><div class="list">${recent.map(toolLink).join('')}</div></section>`;
  }
  for (const [g, ids] of GROUPS) {
    const hit = ids.filter((id) => CALCS[id] && match(id));
    if (hit.length) h += `<section class="group"><h2>${esc(g)}</h2><div class="list">${hit.map(toolLink).join('')}</div></section>`;
  }
  $('#lists').innerHTML = h || `<div class="list"><p class="empty">Aucun outil pour « ${esc(query)} ».</p></div>`;
}

/* ---------- Outil : saisie ---------- */
const unitTag = (u) => (u ? ` <span class="u">(${esc(u)})</span>` : '');
function fieldTable(i, rows) {
  const lines = rows
    .map((row, r) => {
      const name = i.cols
        .map((col, c) => (col[2] === 'num' ? '' : `<input class="tname" type="text" data-t="${i.id}" data-r="${r}" data-c="${c}" aria-label="${esc(col[1])}, ligne ${r + 1}" value="${esc(row[c])}">`))
        .join('');
      const nums = i.cols
        .map((col, c) =>
          col[2] === 'num'
            ? `<label class="tnum"><span>${esc(col[1])}</span><input type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" data-t="${i.id}" data-r="${r}" data-c="${c}" value="${esc(row[c])}"></label>`
            : '',
        )
        .join('');
      return `<div class="trow"><div class="trow-head">${name}<button type="button" class="rm" data-rm="${i.id}" data-r="${r}" aria-label="Supprimer la ligne ${r + 1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="tnums">${nums}</div></div>`;
    })
    .join('');
  const presets = i.presets
    ? `<select data-preset="${i.id}" aria-label="Ligne prédéfinie">${i.presets.map((p, k) => `<option value="${k}">${esc(p[0])} (${esc(String(p[1]).replace('.', ','))})</option>`).join('')}</select><button class="btn small" type="button" data-add="${i.id}">Ajouter</button>`
    : '';
  return `<div class="field wide table" data-f="${i.id}"><span class="lbl">${esc(i.label)}</span>
    <div class="trows">${lines || '<p class="empty">Aucune ligne.</p>'}</div>
    <div class="tadd">${presets}<button class="btn small" type="button" data-blank="${i.id}">Ligne vide</button></div></div>`;
}
function pageTool(id) {
  const c = CALCS[id];
  const vals = rawVals(id);
  const fields = c.inputs
    .map((i) => {
      if (i.type === 'table') return fieldTable(i, vals[i.id]);
      const fid = `f-${i.id}`;
      const label = `<label for="${fid}">${esc(i.label)}${unitTag(i.unit)}${i.hint ? `<small>${esc(i.hint)}</small>` : ''}</label>`;
      if (i.type === 'select') {
        const opts = i.options.map((o) => `<option value="${esc(o[0])}" ${String(vals[i.id]) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('');
        return `<div class="field wide" data-f="${i.id}">${label}<div class="ctl"><select id="${fid}" data-i="${i.id}">${opts}</select></div></div>`;
      }
      return `<div class="field" data-f="${i.id}">${label}<div class="ctl"><input id="${fid}" data-i="${i.id}" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" value="${esc(vals[i.id])}"></div></div>`;
    })
    .join('');
  return `<div class="tool-head"><span class="ref">${esc(REF[id] || '')}</span><p class="note">${c.desc}</p></div>
  <section class="card" aria-labelledby="h-in"><div class="card-head"><h2 id="h-in">Données</h2><button class="btn small" type="button" data-act="reset">Valeurs par défaut</button></div>
    <div class="card-body">${fields}</div></section>
  <section class="card" id="results" aria-labelledby="h-out"><div class="card-head"><h2 id="h-out">Résultats</h2></div>
    <div class="card-body" id="out" aria-live="polite"></div></section>
  <details class="card more"><summary>Formules et détail du calcul</summary><div class="card-body">
    <div class="formula">${c.formula}</div><ol class="explain" id="explain"></ol>
    <p class="note">Valeurs marquées « indicatif » : à vérifier dans la norme. Résultats à confirmer par une note de calcul.</p>
  </div></details>`;
}

/* ---------- Outil : calcul ---------- */
let current = null; // { id, result }
function runTool() {
  const { id } = current;
  const c = CALCS[id];
  const { v, bad } = prepare(id, rawVals(id));
  $$('[aria-invalid]', main).forEach((x) => x.removeAttribute('aria-invalid'));
  for (const b of bad) {
    const sel = b.row === undefined ? `#f-${b.id}` : `[data-t="${b.id}"][data-r="${b.row}"][data-c="${b.col}"]`;
    $(sel, main)?.setAttribute('aria-invalid', 'true');
  }
  const out = $('#out', main);
  const explain = $('#explain', main);
  current.result = null;
  if (bad.length) {
    out.innerHTML = `<div class="status s-bad"><span class="pill">Saisie</span><span>Valeur manquante ou invalide : ${bad.map((b) => esc(b.label)).join(', ')}.</span></div>`;
    explain.innerHTML = '';
    return renderSummary();
  }
  let r;
  try {
    r = c.compute(v);
  } catch (e) {
    out.innerHTML = `<div class="status s-bad"><span class="pill">Erreur</span><span>Calcul impossible avec ces valeurs (${esc(e.message)}).</span></div>`;
    explain.innerHTML = '';
    return renderSummary();
  }
  current.result = r;
  const keys = KEYS[id] || [];
  const rows = r.res
    .map((x, k) => {
      const val = withUnit(x[1], x[2]);
      const long = String(val).length > 26 ? ' long' : '';
      return `<div class="res${keys.includes(k) ? ' big' : ''}${long}"><span>${esc(x[0])}</span><span>${esc(val)}</span></div>`;
    })
    .join('');
  out.innerHTML =
    (r.msg || r.status !== 'ok' ? `<div class="status s-${r.status}"><span class="pill">${STATUS[r.status]}</span><span>${esc(r.msg || '')}</span></div>` : '') +
    `<div class="res-main">${rows}</div>` +
    (r.chart ? `<figure class="chart">${drawRetention(r.chart)}<figcaption class="note">Volume de pluie entrant et volume évacué au débit de fuite : l'écart maximal est le volume à stocker.</figcaption></figure>` : '');
  explain.innerHTML = r.steps.map((s) => `<li>${s}</li>`).join('');
  renderSummary();
}

/* Résumé collant : statut et résultats clés, masqué quand la carte Résultats est à l'écran. */
let resultsVisible = false;
function renderSummary() {
  const sum = $('#summary');
  if (!current) return (sum.hidden = true);
  const r = current.result;
  if (!r) {
    sum.className = 'summary s-bad';
    sum.innerHTML = '<span class="k"><b>Saisie incomplète</b></span>';
  } else {
    const keys = (KEYS[current.id] || []).filter((k) => r.res[k]).slice(0, 3);
    sum.className = `summary s-${r.status}`;
    sum.innerHTML =
      `<span class="dot" role="img" aria-label="${STATUS[r.status]}"></span>` +
      (keys.length
        ? keys.map((k) => `<span class="k"><span>${esc(r.res[k][0])}</span><b>${esc(withUnit(r.res[k][1], r.res[k][2]))}</b></span>`).join('')
        : `<span class="k"><b>${STATUS[r.status]}</b></span>`);
  }
  sum.title = 'Aller aux résultats';
  sum.hidden = resultsVisible;
}
const io = new IntersectionObserver((entries) => {
  for (const e of entries) resultsVisible = e.isIntersecting;
  renderSummary();
}, { rootMargin: '0px 0px -140px 0px' }); // la carte doit dépasser la zone couverte par le résumé
$('#summary').addEventListener('click', () => $('#results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

/* Méthode des pluies : volumes entrant et sortant selon la durée de pluie (SVG à l'échelle) */
function drawRetention(ch) {
  const W = 460, H = 230, pl = 46, pb = 30, pt = 40, pr = 12;
  const pts = ch.pts.filter((p) => p[0] <= Math.max(360, ch.tmax * 2.5));
  const tmax = pts[pts.length - 1][0], vmax = Math.max(...pts.map((p) => Math.max(p[1], p[2]))) * 1.05;
  const X = (t) => pl + ((W - pl - pr) * t) / tmax, Y = (vv) => H - pb - ((H - pb - pt) * vv) / vmax;
  const path = (k) => pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[k]).toFixed(1)).join(' ');
  const step = vmax > 1000 ? 500 : vmax > 400 ? 100 : vmax > 100 ? 50 : 10;
  let g = '';
  for (let v = 0; v <= vmax; v += step)
    g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${pl - 6}" y="${Y(v) + 4}" class="t-muted" text-anchor="end">${v}</text>`;
  const ts = tmax > 600 ? 120 : 60;
  for (let t = 0; t <= tmax; t += ts) g += `<text x="${X(t)}" y="${H - 10}" class="t-muted" text-anchor="middle">${t}</text>`;
  const p = pts.find((q) => q[0] === ch.tmax);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Volumes entrant et sortant selon la durée de pluie ; volume à stocker ${Math.round(ch.Vmax)} m³">${g}
    <path d="${path(1)}" class="c-in"/><path d="${path(2)}" class="c-out"/>
    ${p ? `<line x1="${X(p[0])}" x2="${X(p[0])}" y1="${Y(p[1])}" y2="${Y(p[2])}" class="c-v"/><text x="${X(p[0]) + 6}" y="${(Y(p[1]) + Y(p[2])) / 2}" class="t-v">V = ${Math.round(ch.Vmax)} m³</text>` : ''}
    <line x1="${pl}" x2="${pl + 22}" y1="12" y2="12" class="c-in"/><text x="${pl + 28}" y="16">volume entrant</text>
    <line x1="${pl + 140}" x2="${pl + 162}" y1="12" y2="12" class="c-out"/><text x="${pl + 168}" y="16">volume sortant (fuite)</text>
    <text x="${W - pr}" y="${H - 24}" class="t-muted" text-anchor="end">t (min)</text><text x="4" y="${pt - 6}" class="t-muted">m³</text></svg>`;
}

/* ---------- Partage des résultats (texte pour SMS, mail, notes de chantier) ---------- */
function shareText() {
  const { id, result: r } = current;
  const c = CALCS[id];
  const raw = rawVals(id);
  const lines = [`${c.title} — Atelier PLB`, '', 'Données :'];
  for (const i of c.inputs) {
    if (i.type === 'table') {
      lines.push(`• ${i.label} :`);
      for (const row of raw[i.id]) {
        const name = row.filter((_, k) => i.cols[k][2] !== 'num').join(' ');
        const nums = row.map((x, k) => (i.cols[k][2] === 'num' ? `${i.cols[k][1]} ${x}` : null)).filter(Boolean).join(', ');
        lines.push(`   – ${name} : ${nums}`);
      }
    } else if (i.type === 'select') {
      lines.push(`• ${i.label} : ${i.options.find((o) => String(o[0]) === String(raw[i.id]))?.[1] ?? raw[i.id]}`);
    } else lines.push(`• ${i.label} : ${raw[i.id]}${i.unit ? ' ' + i.unit : ''}`);
  }
  lines.push('', 'Résultats :');
  for (const x of r.res) lines.push(`• ${x[0]} : ${x[1]}${x[2] ? ' ' + x[2] : ''}`);
  if (r.msg) lines.push('', `${r.status === 'ok' ? '✓' : '⚠'} ${STATUS[r.status]} : ${plain(r.msg)}`);
  lines.push('', `Pré-dimensionnement indicatif (${REF[id] || c.title}), à confirmer par une note de calcul.`);
  return lines.join('\n').replace(/[  ]/g, ' ');
}
$('#shareBtn').addEventListener('click', async () => {
  if (!current?.result) return toast('Complète la saisie avant de partager.');
  const title = CALCS[current.id].title;
  const text = shareText();
  try {
    if (native) return await (await native).shareText(title, text);
    if (navigator.share) return await navigator.share({ title, text });
    await navigator.clipboard.writeText(text);
    toast('Résultats copiés dans le presse-papiers.');
  } catch (e) {
    if (!/cancel|abort/i.test(String(e?.message || e))) toast('Partage impossible sur cet appareil.');
  }
});

/* ---------- Routeur ---------- */
let fromHome = false; // l'outil a été ouvert depuis la liste : « retour » = retour arrière de l'historique
function showTool() {
  main.innerHTML = pageTool(current.id);
  runTool();
  io.disconnect();
  io.observe($('#results', main));
}
function route() {
  const id = location.hash.replace(/^#\/?/, '');
  io.disconnect();
  resultsVisible = false;
  if (CALCS[id]) {
    current = { id, result: null };
    S.recent = [id, ...S.recent.filter((x) => x !== id)].slice(0, 5);
    save();
    const t = CALCS[id].title;
    $('#title').textContent = t;
    $('#title').classList.toggle('long', t.length > 22);
    document.title = `${t} — Atelier PLB`;
    showTool();
  } else {
    current = null;
    $('#title').textContent = 'Atelier PLB';
    $('#title').classList.remove('long');
    document.title = 'Atelier PLB';
    main.innerHTML = pageHome();
    fillLists();
    renderSummary();
  }
  $('#backBtn').hidden = !current;
  $('#shareBtn').hidden = !current;
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}
window.addEventListener('hashchange', route);
$('#backBtn').addEventListener('click', () => (fromHome ? history.back() : location.replace('#/')));
main.addEventListener('click', (e) => {
  if (e.target.closest('a.tool')) fromHome = true;
});
window.addEventListener('hashchange', () => {
  if (!current) fromHome = false;
});

/* ---------- Saisie ---------- */
/** Redessine l'outil (ajout ou suppression de ligne) sans perdre la position de lecture. */
function redraw(focusSel) {
  const y = window.scrollY;
  showTool();
  window.scrollTo(0, y);
  if (focusSel) $(focusSel, main)?.focus({ preventScroll: true });
}
main.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'q') {
    query = t.value;
    return fillLists();
  }
  if (!current) return;
  const vals = rawVals(current.id);
  if (t.dataset.i) vals[t.dataset.i] = t.value;
  else if (t.dataset.t) vals[t.dataset.t][+t.dataset.r][+t.dataset.c] = t.value;
  else return;
  save();
  runTool();
});
main.addEventListener('change', (e) => {
  const t = e.target;
  if (!current || !t.matches('select[data-i]')) return;
  rawVals(current.id)[t.dataset.i] = t.value;
  save();
  runTool();
});
main.addEventListener('click', (e) => {
  if (!current) return;
  const vals = rawVals(current.id);
  const input = (tid) => CALCS[current.id].inputs.find((i) => i.id === tid);
  const rm = e.target.closest('[data-rm]');
  if (rm) {
    vals[rm.dataset.rm].splice(+rm.dataset.r, 1);
    save();
    return redraw(`[data-f="${rm.dataset.rm}"] .tadd button`);
  }
  const add = e.target.closest('[data-add]');
  if (add) {
    const i = input(add.dataset.add);
    const p = i.presets[+$(`[data-preset="${i.id}"]`, main).value];
    // Même ligne que la version web : nombre 1 (ou 1000 m² pour une surface), valeur du préréglage.
    const row = i.cols.length === 3 ? [p[0], i.id === 's' ? 1000 : 1, p[1]] : [p[0], 1, p[1], 0];
    vals[i.id].push(row.map((x) => String(x).replace('.', ',')));
    save();
    return redraw(`[data-t="${i.id}"][data-r="${vals[i.id].length - 1}"][data-c="1"]`);
  }
  const blank = e.target.closest('[data-blank]');
  if (blank) {
    const i = input(blank.dataset.blank);
    vals[i.id].push(i.cols.map((col) => (col[2] === 'num' ? '0' : 'Nouvelle ligne')));
    save();
    return redraw(`[data-t="${i.id}"][data-r="${vals[i.id].length - 1}"][data-c="0"]`);
  }
  if (e.target.closest('[data-act="reset"]')) {
    delete S.vals[current.id];
    save();
    redraw();
    toast('Valeurs par défaut rétablies.');
  }
});
/* « Suivant » du clavier : passe au champ suivant */
main.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.matches('input[data-i], input[data-t]')) return;
  e.preventDefault();
  const all = $$('input[data-i], input[data-t], select[data-i]', main);
  const next = all[all.indexOf(e.target) + 1];
  if (next) next.focus();
  else e.target.blur();
});
main.addEventListener('focusin', (e) => {
  if (e.target.matches('input[data-i], input[data-t]')) e.target.select();
});

native?.then((n) => n.init());
route();
