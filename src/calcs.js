// Calculs plomberie : fonctions hydrauliques, tables et définition déclarative des calculateurs.
// Repris tels quels de la version web « Atelier Plomberie BE » (référentiel au 1er octobre 2026).
// Les textes formula, desc, steps et IND contiennent du HTML (indices, exposants) : ils sont affichés tels quels.

const IND = '<span class="ind">indicatif — vérifier dans la norme</span>';
const G = 9.81;

/* ---------- Outils numériques ---------- */
function fx(n, d = 2) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function num(x, def = 0) { const n = parseFloat(String(x).replace(',', '.')); return isFinite(n) ? n : def; }
/* Viscosité cinématique de l'eau (m²/s) — corrélation usuelle, 0–100 °C */
function nuEau(T) { return 1.792e-6 / (1 + 0.0337 * T + 0.000221 * T * T); }
/* Masse volumique de l'eau (kg/m³) — formule de Tanaka/Thiesen */
function rhoEau(T) { return 1000 * (1 - (T + 288.9414) / (508929.2 * (T + 68.12963)) * Math.pow(T - 3.9863, 2)); }
/* Coefficient de frottement de Darcy — Colebrook-White (itératif) */
function colebrook(Re, k, D) {
  if (Re < 2300) return 64 / Math.max(Re, 1);
  let f = 0.02;
  for (let i = 0; i < 50; i++) {
    const r = -2 * Math.log10(k / (3.71 * D) + 2.51 / (Re * Math.sqrt(f)));
    f = 1 / (r * r);
  }
  return f;
}
/* Perte de charge linéaire (m CE / m) — Q en l/s, Di en mm, k en mm */
function jColebrook(Q, Di, k = 0.0015, T = 10) {
  const D = Di / 1000, A = Math.PI * D * D / 4, v = Q / 1000 / A;
  const Re = v * D / nuEau(T), f = colebrook(Re, k / 1000, D);
  return { J: f * v * v / (2 * G * D), v, Re, f };
}
/* Formule de Flamant : J = 4·b·v^1,75 / D^1,25 (b = 0,00018 plastique, 0,00023 cuivre/acier neuf, 0,00031 acier ancien) */
function jFlamant(Q, Di, b = 0.00023) {
  const D = Di / 1000, v = Q / 1000 / (Math.PI * D * D / 4);
  return { J: 4 * b * Math.pow(v, 1.75) / Math.pow(D, 1.25), v };
}
/* Débit d'une conduite circulaire partiellement remplie — Colebrook-White (NF EN 12056) */
function qPartiel(Di, pente, hd, kb = 1.0, T = 10) {
  const D = Di / 1000, th = 2 * Math.acos(1 - 2 * hd);
  const A = D * D / 8 * (th - Math.sin(th)), P = D * th / 2, R = A / P, J = pente;
  const s = Math.sqrt(2 * G * 4 * R * J);
  const v = -2 * s * Math.log10((kb / 1000) / (14.84 * R) + 2.51 * nuEau(T) / (4 * R * s));
  return { Q: v * A * 1000, v };
}
/* Débit d'une descente EP — formule de Wyly-Eaton (NF EN 12056-3) : Q = 2,5e-4·kb^-0,167·di^2,667·f^1,667 */
function qDescente(di, f = 0.33, kb = 0.25) { return 2.5e-4 * Math.pow(kb, -0.167) * Math.pow(di, 2.667) * Math.pow(f, 1.667); }
/* Flux thermique linéique d'une conduite (W/m) — conduction isolant + échange extérieur h = 10 W/m²K */
function pertesLin(Dext, e, lambda, dT, h = 10) {
  const D1 = Dext / 1000, D2 = (Dext + 2 * e) / 1000;
  if (e <= 0) return dT * h * Math.PI * D1;
  return dT / (Math.log(D2 / D1) / (2 * Math.PI * lambda) + 1 / (h * Math.PI * D2));
}

/* ---------- Tables de diamètres (diamètre intérieur, mm) — IND ---------- */
const TUBES = {
  cuivre: { nom: 'Cuivre (ext × ép.)', k: 0.0015, list: [['12×1', 10], ['14×1', 12], ['16×1', 14], ['18×1', 16], ['22×1', 20], ['28×1', 26], ['35×1,5', 32], ['42×1,5', 39], ['54×1,5', 51], ['64×2', 60], ['76,1×2', 72.1], ['88,9×2', 84.9], ['108×2,5', 103]] },
  multicouche: { nom: 'Multicouche (ext × ép.)', k: 0.007, list: [['16×2', 12], ['20×2', 16], ['26×3', 20], ['32×3', 26], ['40×3,5', 33], ['50×4', 42], ['63×4,5', 54], ['75×5', 65]] },
  acier: { nom: 'Acier galvanisé (DN)', k: 0.15, list: [['DN15 (15×21)', 16.1], ['DN20 (20×27)', 21.6], ['DN25 (26×34)', 27.3], ['DN32 (33×42)', 36], ['DN40 (40×49)', 41.9], ['DN50 (50×60)', 53.1], ['DN65', 68.9], ['DN80', 80.8], ['DN100', 105.3]] },
  pvcpression: { nom: 'PVC pression PN16', k: 0.007, list: [['Ø25', 21.2], ['Ø32', 27.2], ['Ø40', 36.2], ['Ø50', 45.2], ['Ø63', 57], ['Ø75', 67.8], ['Ø90', 81.4], ['Ø110', 99.4]] }
};
const PVC_EVAC = [['Ø32', 28], ['Ø40', 36], ['Ø50', 46], ['Ø75', 71], ['Ø90', 86], ['Ø100', 96], ['Ø110', 103], ['Ø125', 118], ['Ø160', 152], ['Ø200', 190], ['Ø250', 238], ['Ø315', 300], ['Ø400', 381]];
function choisirTube(list, diMin) { return list.find(t => t[1] >= diMin) || null; }

/* ---------- Données normatives simplifiées (IND) ---------- */
// Débits de base EF/ECS (l/s) — d'après NF DTU 60.11 P1-1 (valeurs usuelles, IND)
const APPAREILS_EF = [
  ['Évier', 0.20], ['Lavabo', 0.20], ['Lave-mains', 0.10], ['Lavabo collectif (par robinet)', 0.05],
  ['Douche', 0.20], ['Baignoire', 0.33], ['WC à réservoir de chasse', 0.12], ['WC à robinet de chasse', 1.50],
  ['Urinoir à robinet individuel', 0.15], ['Poste d\'eau robinet 1/2"', 0.33], ['Poste d\'eau robinet 3/4"', 0.42],
  ['Lave-vaisselle', 0.10], ['Lave-linge', 0.20], ['Bac à laver', 0.33]
];
// Unités de décharge DU (l/s) — NF EN 12056-2, système I (IND)
const APPAREILS_DU = [
  ['Lavabo / lave-mains', 0.5], ['Douche sans bouchon', 0.6], ['Douche avec bouchon', 0.8],
  ['Urinoir à chasse individuelle', 0.8], ['Urinoir à robinet de chasse / automatique', 0.5],
  ['Baignoire', 0.8], ['Évier', 0.8], ['Lave-vaisselle', 0.8], ['Lave-linge ≤ 6 kg', 0.8], ['Lave-linge 12 kg', 1.5],
  ['WC réservoir 6 l', 2.0], ['WC réservoir 9 l', 2.5], ['Siphon de sol DN50', 0.8], ['Siphon de sol DN70', 1.5], ['Siphon de sol DN100', 2.0]
];
// Capacité des chutes (l/s), système I, raccordements en T — NF EN 12056-2 tableaux 11/12 (IND)
const CHUTES = {
  primaire: [[70, 1.5], [80, 2.0], [90, 2.7], [100, 4.0], [125, 5.8], [150, 9.5], [200, 16.0]],
  secondaire: [[70, 2.0], [80, 2.6], [90, 3.5], [100, 5.6], [125, 7.6], [150, 12.4], [200, 21.0]]
};
// Classes de risque sprinkleurs — NF EN 12845 (densité mm/min, surface m², durée min) IND
const SPK = {
  LH: ['Risque faible (LH)', 2.25, 84, 30], OH1: ['Risque ordinaire OH1', 5, 72, 60], OH2: ['Risque ordinaire OH2', 5, 144, 60],
  OH3: ['Risque ordinaire OH3 (commerces)', 5, 216, 60], OH4: ['Risque ordinaire OH4', 5, 360, 60],
  HHP1: ['Risque élevé HHP1', 7.5, 260, 90], HHP2: ['Risque élevé HHP2', 10, 260, 90], HHP3: ['Risque élevé HHP3', 12.5, 260, 90]
};
// NF EN 1717 : catégorie maximale protégée par chaque dispositif
const EN1717_DISPO = [
  ['AA', 'Surverse totale non limitée', 5], ['AB', 'Surverse avec trop-plein non circulaire', 5], ['AD', 'Surverse avec injecteur', 5],
  ['BA', 'Disconnecteur à zone de pression réduite contrôlable', 4], ['CA', 'Disconnecteur à zones de pressions différentes non contrôlable', 3],
  ['EA', 'Clapet de non-retour contrôlable', 2], ['EB', 'Clapet de non-retour non contrôlable (usage domestique)', 2]
];
// Classement courant des usages (IND — à valider avec le guide CSTB et l'ARS)
const EN1717_USAGES = [
  ['Distribution EF générale', 1, 'Protection de branchement (clapet EA au compteur)'],
  ['Production d\'ECS (ballon, échangeur)', 2, 'EA sur l\'arrivée EF + groupe de sécurité'],
  ['Adoucisseur, filtre', 2, 'EA'],
  ['Remplissage circuit chauffage sans additif', 3, 'CA ou BA'],
  ['Remplissage circuit chauffage/froid avec additifs (glycol, inhibiteurs)', 4, 'BA'],
  ['Lave-vaisselle / lave-linge professionnels', 3, 'Selon fabricant ; CA ou BA'],
  ['RIA sur réseau EDCH', 2, 'EA (BA si additif ou eau stagnante à risque)'],
  ['Réseau sprinkleur alimenté par l\'EDCH', 4, 'BA ou surverse AB vers bâche'],
  ['Arrosage automatique enterré', 5, 'AA ou AB (ou BA selon configuration, voir guide)'],
  ['Appoint d\'une cuve d\'eau de pluie', 5, 'AA ou AB obligatoire'],
  ['Laboratoire, salle de soins, produits chimiques', 5, 'AA ou AB'],
  ['Piscine, fontaine décorative', 5, 'AA ou AB']
];
// Séparateurs à graisses — NF EN 1825-2 (volume par repas l, facteur de pointe) IND
const GRAISSES = {
  hotel: ['Hôtel avec restaurant', 100, 5], resto: ['Restaurant traditionnel', 50, 8.5],
  hopital: ['Hôpital / clinique', 20, 13], cantine: ['Cantine / self (1 service)', 5, 20], rapide: ['Restauration rapide', 5, 20]
};
const NS_TAILLES = [1, 2, 3, 4, 6, 7, 8, 10, 15, 20, 25, 30, 35, 40, 50, 65, 80, 100, 150, 200];

/* ---------- Définition des calculateurs ---------- */
const CALCS = {

  /* 1 ─ Débit probable EF/ECS ─ NF DTU 60.11 P1-1
     Cas test : 8 WC réservoir, 4 urinoirs, 8 lavabos, 1 évier, 1 douche, cuivre, v = 1,5 m/s
     → ΣQb = 3,56 l/s ; x = 22 ; y = 0,175 ; Qp = 0,621 l/s ; Di mini = 23,0 mm → cuivre 28×1 */
  debitProbable: {
    title: 'Débit probable et diamètre EF / ECS', mod: 4,
    formula: 'Q<sub>p</sub> = y × ΣQ<sub>b</sub> &nbsp; avec &nbsp; y = 0,8 / √(x − 1) &nbsp;; &nbsp; D<sub>i</sub> = √(4·Q<sub>p</sub> / (π·v))',
    desc: 'Méthode du NF DTU 60.11 P1-1 : on additionne les débits de base, on applique le coefficient de simultanéité, puis on choisit le diamètre par la vitesse.',
    inputs: [
      { id: 'app', type: 'table', label: 'Appareils desservis', presets: APPAREILS_EF,
        cols: [['nom', 'Appareil', 'text'], ['n', 'Nombre', 'num'], ['qb', 'Débit de base (l/s)', 'num']],
        rows: [['WC à réservoir de chasse', 8, 0.12], ['Urinoir à robinet individuel', 4, 0.15], ['Lavabo', 8, 0.20], ['Évier', 1, 0.20], ['Douche', 1, 0.20]] },
      { id: 'usage', type: 'select', label: 'Type d\'usage', value: 'std', options: [['std', 'Usage courant : y = 0,8/√(x−1)'], ['simul', 'Usage simultané (vestiaires, sanitaires publics à l\'entracte) : y = 1']] },
      { id: 'mat', type: 'select', label: 'Matériau', value: 'cuivre', options: Object.entries(TUBES).map(([k, t]) => [k, t.nom]) },
      { id: 'vmax', type: 'num', label: 'Vitesse maximale visée', unit: 'm/s', value: 1.5, step: 0.1, hint: 'IND : 1 à 1,5 m/s en distribution, jusqu\'à 2 m/s en colonnes/sous-sol' }
    ],
    compute(v) {
      let S = 0, x = 0;
      v.app.forEach(r => { S += num(r[1]) * num(r[2]); x += num(r[1]); });
      let y = v.usage === 'simul' ? 1 : (x > 1 ? Math.min(1, 0.8 / Math.sqrt(x - 1)) : 1);
      const Qp = y * S, vm = num(v.vmax, 1.5);
      const di = Math.sqrt(4 * Qp / 1000 / (Math.PI * vm)) * 1000;
      const t = choisirTube(TUBES[v.mat].list, di);
      const vr = t ? Qp / 1000 / (Math.PI * Math.pow(t[1] / 1000, 2) / 4) : NaN;
      let status = 'ok', msg = 'Diamètre trouvé dans la gamme.';
      if (!t) { status = 'bad'; msg = 'Débit trop élevé pour la gamme : changer de matériau ou dédoubler.'; }
      else if (v.usage === 'std' && x > 0 && y < 0.2) { status = 'warn'; msg = 'y très faible : vérifier qu\'il n\'y a pas de pointe simultanée (vestiaires, entracte). Le DTU prévoit des cas particuliers.'; }
      return {
        res: [['Somme des débits de base ΣQb', fx(S, 2), 'l/s'], ['Nombre d\'appareils x', fx(x, 0), ''], ['Coefficient y', fx(y, 3), ''],
          ['Débit probable Qp', fx(Qp, 3), 'l/s'], ['Diamètre intérieur mini', fx(di, 1), 'mm'], ['Tube retenu', t ? t[0] + ' (Di ' + fx(t[1], 1) + ' mm)' : '—', ''], ['Vitesse réelle', fx(vr, 2), 'm/s']],
        status, msg,
        steps: [`ΣQb = Σ(n × Qb) = ${fx(S, 3)} l/s pour x = ${x} appareils`,
          v.usage === 'simul' ? 'Usage simultané : y = 1' : `y = 0,8 / √(${x} − 1) = ${fx(y, 4)}`,
          `Qp = ${fx(y, 4)} × ${fx(S, 3)} = ${fx(Qp, 4)} l/s`,
          `Di = √(4 × ${fx(Qp / 1000, 6)} / (π × ${vm})) = ${fx(di, 1)} mm`,
          t ? `Premier tube de Di ≥ ${fx(di, 1)} mm : ${t[0]} → v = ${fx(vr, 2)} m/s` : 'Aucun tube suffisant',
          'Débits de base et gamme de tubes : ' + IND]
      };
    }
  },

  /* 2 ─ Pertes de charge et pression au point le plus défavorisé
     Cas test : P réseau 3,5 bar ; H = 18 m ; Pres = 1 bar ; tronçons (20 m, Di 51, 2 l/s), (25 m, Di 32, 1 l/s), (15 m, Di 20, 0,4 l/s), 20 % singularités, Colebrook
     → pertes ≈ 4,21 mCE (0,41 bar) ; P nécessaire ≈ 3,18 bar < 3,5 bar → « à vérifier » (marge < 10 %) */
  pertesCharge: {
    title: 'Pertes de charge et pression disponible', mod: 1,
    formula: 'J = λ·v²/(2g·D) (Colebrook) ou J = 4b·v<sup>1,75</sup>/D<sup>1,25</sup> (Flamant) &nbsp;; &nbsp; P<sub>nécessaire</sub> = P<sub>rés</sub> + ρgH + Σ(J·L)(1+s)',
    desc: 'Tronçon par tronçon, du compteur jusqu\'au point de puisage le plus défavorisé (le plus haut et le plus loin).',
    inputs: [
      { id: 'tr', type: 'table', label: 'Tronçons (du compteur vers le point défavorisé)',
        cols: [['nom', 'Tronçon', 'text'], ['L', 'Longueur (m)', 'num'], ['di', 'Di (mm)', 'num'], ['q', 'Qp (l/s)', 'num']],
        rows: [['Compteur → pied de colonne', 20, 51, 2.0], ['Colonne montante', 25, 32, 1.0], ['Distribution étage', 15, 20, 0.4]] },
      { id: 'meth', type: 'select', label: 'Méthode', value: 'col', options: [['col', 'Colebrook-White'], ['fla', 'Flamant']] },
      { id: 'k', type: 'num', label: 'Rugosité k (Colebrook)', unit: 'mm', value: 0.0015, step: 0.001, hint: 'Cuivre/PER ≈ 0,0015 ; acier galva ≈ 0,15' },
      { id: 'b', type: 'num', label: 'Coefficient b (Flamant)', unit: '', value: 0.00023, step: 0.00001, hint: '0,00018 plastique ; 0,00023 cuivre/acier neuf ; 0,00031 acier ancien' },
      { id: 'sing', type: 'num', label: 'Majoration singularités', unit: '%', value: 20 },
      { id: 'T', type: 'num', label: 'Température de l\'eau', unit: '°C', value: 10 },
      { id: 'H', type: 'num', label: 'Hauteur géométrique compteur → point', unit: 'm', value: 18 },
      { id: 'pres', type: 'num', label: 'Pression résiduelle mini au point', unit: 'bar', value: 1.0, step: 0.1, hint: 'IND : ~1 bar ; robinetterie thermostatique/temporisée souvent 1,5 bar (voir fabricant)' },
      { id: 'pdisp', type: 'num', label: 'Pression mini du réseau public (concessionnaire)', unit: 'bar', value: 3.5, step: 0.1 }
    ],
    compute(v) {
      const s = num(v.sing) / 100; let tot = 0; const steps = []; let vmax = 0;
      v.tr.forEach(r => {
        const L = num(r[1]), di = num(r[2]), q = num(r[3]);
        if (!di || !q) return;
        const o = v.meth === 'fla' ? jFlamant(q, di, num(v.b, 0.00023)) : jColebrook(q, di, num(v.k, 0.0015), num(v.T, 10));
        const dp = o.J * L * (1 + s); tot += dp; vmax = Math.max(vmax, o.v);
        steps.push(`${r[0]} : v = ${fx(o.v, 2)} m/s ; J = ${fx(o.J * 1000, 1)} mmCE/m ; ΔH = ${fx(o.J * 1000, 1)} × ${L} × ${fx(1 + s, 2)} = ${fx(dp, 2)} mCE`);
      });
      const rho = rhoEau(num(v.T, 10));
      const pPertes = tot * rho * G / 1e5, pH = num(v.H) * rho * G / 1e5;
      const pNec = num(v.pres) + pH + pPertes, pDisp = num(v.pdisp);
      let status = 'ok', msg = 'La pression du réseau public suffit.';
      if (pNec > pDisp) { status = 'bad'; msg = `Il manque ${fx(pNec - pDisp, 2)} bar : prévoir un surpresseur (ou réduire les pertes).`; }
      else if (pNec > 0.9 * pDisp) { status = 'warn'; msg = 'Marge inférieure à 10 % : sensible aux variations de pression du réseau.'; }
      if (pDisp > 3 + pH) { msg += ' La pression aux étages bas dépassera 3 bar : réducteur de pression à prévoir (IND).'; if (status === 'ok') status = 'warn'; }
      if (vmax > 2) { status = status === 'bad' ? 'bad' : 'warn'; msg += ' Vitesse > 2 m/s sur un tronçon : bruit et coups de bélier.'; }
      steps.push(`Pertes totales = ${fx(tot, 2)} mCE = ${fx(pPertes, 3)} bar`);
      steps.push(`Hauteur : ρ·g·H = ${fx(pH, 3)} bar`);
      steps.push(`P nécessaire = ${num(v.pres)} + ${fx(pH, 3)} + ${fx(pPertes, 3)} = ${fx(pNec, 2)} bar`);
      return { res: [['Pertes de charge totales', fx(tot, 2), 'mCE'], ['Soit', fx(pPertes, 2), 'bar'], ['Pression due à la hauteur', fx(pH, 2), 'bar'], ['Pression nécessaire au compteur', fx(pNec, 2), 'bar'], ['Pression disponible', fx(pDisp, 2), 'bar'], ['Vitesse maxi', fx(vmax, 2), 'm/s']], status, msg, steps };
    }
  },

  /* 3 ─ Groupe de surpression
     Cas test : Q = 12 m³/h ; P sortie 5 bar ; P amont 2 bar ; 2 pompes + 1 secours ; Z = 20 ; Pmin 4,5 / Pmax 5,5 bar ; prégonflage 4,3 bar
     → HMT ≈ 32,6 m ; Q/pompe 6 m³/h ; volume utile 75 l ; réservoir ≈ 506 l */
  surpresseur: {
    title: 'Groupe de surpression et réservoir à vessie', mod: 4,
    formula: 'HMT = (P<sub>sortie</sub> − P<sub>amont mini</sub>)·10,2 + ΔH<sub>groupe</sub> &nbsp;; &nbsp; V<sub>u</sub> = Q<sub>pompe</sub>·(3600/Z)/4 &nbsp;; &nbsp; V = V<sub>u</sub> / [(P<sub>g</sub>+1)·(1/(P<sub>min</sub>+1) − 1/(P<sub>max</sub>+1))]',
    desc: 'Le volume utile vient du nombre maximal de démarrages par heure ; le volume total découle de la loi de Boyle-Mariotte (pressions absolues).',
    inputs: [
      { id: 'Q', type: 'num', label: 'Débit de pointe à assurer', unit: 'm³/h', value: 12 },
      { id: 'ps', type: 'num', label: 'Pression à assurer en sortie', unit: 'bar', value: 5, step: 0.1 },
      { id: 'pa', type: 'num', label: 'Pression amont mini (réseau ou bâche)', unit: 'bar', value: 2, step: 0.1 },
      { id: 'dh', type: 'num', label: 'Pertes internes du groupe', unit: 'mCE', value: 2 },
      { id: 'n', type: 'num', label: 'Nombre de pompes en service', unit: '', value: 2 },
      { id: 'Z', type: 'num', label: 'Démarrages maxi par heure et par pompe', unit: '/h', value: 20, hint: 'Donnée fabricant (IND : 15 à 30)' },
      { id: 'pmin', type: 'num', label: 'Pression d\'enclenchement', unit: 'bar', value: 4.5, step: 0.1 },
      { id: 'pmax', type: 'num', label: 'Pression de déclenchement', unit: 'bar', value: 5.5, step: 0.1 },
      { id: 'pg', type: 'num', label: 'Pression de prégonflage', unit: 'bar', value: 4.3, step: 0.1, hint: 'Usuellement P enclenchement − 0,2 bar' }
    ],
    compute(v) {
      const Q = num(v.Q), n = Math.max(1, num(v.n, 1)), Qp = Q / n;
      const hmt = (num(v.ps) - num(v.pa)) * 10.2 + num(v.dh);
      const Vu = Qp / 3.6 * (3600 / num(v.Z, 20)) / 4;
      const pmin = num(v.pmin), pmax = num(v.pmax), pg = num(v.pg);
      const k = (pg + 1) * (1 / (pmin + 1) - 1 / (pmax + 1));
      const V = Vu / k;
      let status = 'ok', msg = `Prévoir ${n} pompe(s) de ${fx(Qp, 1)} m³/h à ${fx(hmt, 1)} mCE, plus 1 pompe de secours.`;
      if (pg >= pmin) { status = 'bad'; msg = 'Le prégonflage doit rester inférieur à la pression d\'enclenchement.'; }
      else if (pmax > 6.5) { status = 'warn'; msg += ' Pression élevée : vérifier les 3 bar aux points de puisage (réducteurs par étage).'; }
      return { res: [['HMT', fx(hmt, 1), 'mCE'], ['Débit par pompe', fx(Qp, 2), 'm³/h'], ['Pompes installées', `${n} + 1 secours`, ''], ['Volume utile', fx(Vu, 1), 'l'], ['Volume total du réservoir', fx(V, 0), 'l']], status, msg,
        steps: [`HMT = (${v.ps} − ${v.pa}) × 10,2 + ${v.dh} = ${fx(hmt, 1)} mCE`, `Q par pompe = ${Q} / ${n} = ${fx(Qp, 2)} m³/h = ${fx(Qp / 3.6, 3)} l/s`,
          `Durée mini d\'un cycle = 3600 / ${v.Z} = ${fx(3600 / num(v.Z, 20), 0)} s ; le cas le plus défavorable est une demande égale à Q/2 → Vu = Q·T/4 = ${fx(Vu, 1)} l`,
          `Boyle-Mariotte : V = ${fx(Vu, 1)} / [(${pg}+1)·(1/(${pmin}+1) − 1/(${pmax}+1))] = ${fx(V, 0)} l → prendre le volume commercial supérieur`] };
    }
  },

  /* 4 ─ Besoins et production d'ECS
     Cas test : restaurant 400 repas × 8 l + 10 douches × 25 l ; 40 % en pointe sur 2 h ; Tef 10 / Ts 60 °C ; reconstitution 6 h
     → V jour 3450 l ; V pointe 1380 l ; accumulation : stockage 1725 l, P ≈ 16,7 kW ; semi-instantané (Vs = 690 l) : P ≈ 24,1 kW */
  ecs: {
    title: 'Besoins et production d\'ECS', mod: 5,
    formula: 'E (Wh) = V (l) × 1,163 × ΔT &nbsp;; &nbsp; P = E / t &nbsp;; &nbsp; V<sub>60</sub> = V<sub>40</sub> × (40 − T<sub>ef</sub>)/(60 − T<sub>ef</sub>)',
    desc: 'Les besoins sont exprimés à la température de stockage. Les ratios proposés sont des ordres de grandeur à adapter au programme.',
    inputs: [
      { id: 'u', type: 'table', label: 'Besoins par usage (à la température de stockage)', presets: [['Bureaux (par personne/jour)', 3], ['Restaurant traditionnel (par repas)', 8], ['Self / cuisine collective (par repas)', 5], ['Douche de vestiaire (par douche)', 25], ['Lavabo sanitaires publics (par usage)', 0.5], ['Cafétéria (par couvert)', 2]],
        cols: [['nom', 'Usage', 'text'], ['n', 'Nombre d\'unités / jour', 'num'], ['r', 'Ratio (l/unité)', 'num']],
        rows: [['Restaurant traditionnel (par repas)', 400, 8], ['Douche de vestiaire (par douche)', 10, 25]] },
      { id: 'tef', type: 'num', label: 'Température eau froide', unit: '°C', value: 10 },
      { id: 'ts', type: 'num', label: 'Température de stockage', unit: '°C', value: 60, hint: '≥ 55 °C en sortie de production (arrêté du 30/11/2005)' },
      { id: 'fp', type: 'num', label: 'Part du besoin journalier pendant la pointe', unit: '%', value: 40 },
      { id: 'tp', type: 'num', label: 'Durée de la pointe', unit: 'h', value: 2 },
      { id: 'tr', type: 'num', label: 'Temps de reconstitution (accumulation)', unit: 'h', value: 6 },
      { id: 'cop', type: 'num', label: 'COP saisonnier PAC ECS (bonus)', unit: '', value: 2.8, step: 0.1 },
      { id: 'hpac', type: 'num', label: 'Heures de fonctionnement PAC / jour', unit: 'h', value: 12 }
    ],
    compute(v) {
      let Vj = 0; v.u.forEach(r => Vj += num(r[1]) * num(r[2]));
      const dT = num(v.ts, 60) - num(v.tef, 10), Vp = Vj * num(v.fp) / 100, tp = num(v.tp, 1);
      const Ej = Vj * 1.163 * dT / 1000; // kWh
      const Vacc = Vp / 0.8; // 80 % du volume réellement utilisable (stratification)
      const Pacc = Vacc * 1.163 * dT / num(v.tr, 6) / 1000;
      const Vsemi = Vp / 2;
      const Psemi = (Vp - 0.8 * Vsemi) * 1.163 * dT / tp / 1000;
      const Pinst = Vp * 1.163 * dT / tp / 1000 * 2; // pointe instantanée ≈ 2 × moyenne de la période de pointe (IND)
      const Ppac = Ej / num(v.hpac, 12), Eel = Ej / num(v.cop, 2.8);
      let status = 'ok', msg = 'Comparer les solutions : l\'accumulation lisse la puissance, l\'instantané supprime le stockage mais exige une forte puissance.';
      if (num(v.ts) < 55) { status = 'bad'; msg = 'Température de stockage < 55 °C : non conforme à l\'arrêté du 30 novembre 2005 (sauf traitement adapté).'; }
      return { res: [['Besoin journalier', fx(Vj, 0), 'l à ' + v.ts + ' °C'], ['Énergie journalière', fx(Ej, 1), 'kWh'], ['Volume en pointe', fx(Vp, 0), 'l'],
        ['Accumulation : volume de stockage', fx(Vacc, 0), 'l'], ['Accumulation : puissance', fx(Pacc, 1), 'kW'],
        ['Semi-instantané : stockage / puissance', fx(Vsemi, 0) + ' l / ' + fx(Psemi, 1), 'kW'], ['Instantané : puissance (IND)', fx(Pinst, 0), 'kW'],
        ['PAC ECS : puissance calorifique', fx(Ppac, 1), 'kW'], ['PAC ECS : électricité / jour', fx(Eel, 1), 'kWh']], status, msg,
        steps: [`Vj = Σ(n × ratio) = ${fx(Vj, 0)} l ; ΔT = ${dT} K`, `Ej = ${fx(Vj, 0)} × 1,163 × ${dT} / 1000 = ${fx(Ej, 1)} kWh`,
          `Vpointe = ${v.fp} % × Vj = ${fx(Vp, 0)} l sur ${tp} h`, `Accumulation : V = Vpointe / 0,8 (volume utile 80 %, IND) = ${fx(Vacc, 0)} l ; P = V·1,163·ΔT / ${v.tr} h = ${fx(Pacc, 1)} kW`,
          `Semi-instantané avec Vs = Vpointe/2 : P = (Vpointe − 0,8·Vs)·1,163·ΔT / tp = ${fx(Psemi, 1)} kW`,
          'Instantané : la puissance doit couvrir le débit de pointe instantané (voir calculateur débit probable) ; ici estimé à 2 × la moyenne horaire de pointe. ' + IND,
          `PAC : P = Ej / ${v.hpac} h = ${fx(Ppac, 1)} kW ; électricité = Ej / COP = ${fx(Eel, 1)} kWh/j`] };
    }
  },

  /* 5 ─ Bouclage ECS ─ NF DTU 60.11 P1-2
     Cas test : tronçons 30 m Ø28 e30, 40 m Ø22 e25, 30 m Ø18 e20, λ 0,035 ; Tdép 60 °C ; Tamb 20 °C ; ΔT 5 K ; retour Di 12 mm sur 100 m
     → pertes ≈ 0,65 kW ; débit ≈ 112 l/h ; v retour ≈ 0,27 m/s */
  bouclage: {
    title: 'Bouclage ECS : débit et circulateur', mod: 5,
    formula: 'Φ = Σ φ<sub>i</sub>·L<sub>i</sub> &nbsp;; &nbsp; q<sub>b</sub> (l/h) = Φ (W) / (1,163 × ΔT) &nbsp;; &nbsp; φ = ΔT<sub>m</sub> / [ln(D₂/D₁)/(2πλ) + 1/(h·π·D₂)]',
    desc: 'Le débit de bouclage compense les pertes thermiques pour que la température de retour reste ≥ 50 °C.',
    inputs: [
      { id: 'tr', type: 'table', label: 'Tronçons aller (bouclés)',
        cols: [['nom', 'Tronçon', 'text'], ['L', 'L (m)', 'num'], ['D', 'Ø ext (mm)', 'num'], ['e', 'Isolant (mm)', 'num']],
        rows: [['Départ chaufferie', 30, 28, 30], ['Colonne', 40, 22, 25], ['Antennes bouclées', 30, 18, 20]] },
      { id: 'lambda', type: 'num', label: 'Conductivité de l\'isolant λ', unit: 'W/m·K', value: 0.035, step: 0.001 },
      { id: 'td', type: 'num', label: 'Température départ', unit: '°C', value: 60 },
      { id: 'ta', type: 'num', label: 'Température ambiante (gaines, faux plafonds)', unit: '°C', value: 20 },
      { id: 'dt', type: 'num', label: 'Chute de température maxi admise', unit: 'K', value: 5 },
      { id: 'dir', type: 'num', label: 'Diamètre intérieur du retour', unit: 'mm', value: 12 },
      { id: 'lr', type: 'num', label: 'Longueur du retour', unit: 'm', value: 100 },
      { id: 'dpv', type: 'num', label: 'Perte des vannes d\'équilibrage', unit: 'mCE', value: 1.5 }
    ],
    compute(v) {
      const dt = num(v.dt, 5), Tm = num(v.td) - dt / 2 - num(v.ta);
      let Phi = 0; const steps = [];
      v.tr.forEach(r => { const p = pertesLin(num(r[2]), num(r[3]), num(v.lambda, 0.035), Tm); Phi += p * num(r[1]); steps.push(`${r[0]} : φ = ${fx(p, 1)} W/m × ${r[1]} m = ${fx(p * num(r[1]), 0)} W`); });
      const q = Phi / (1.163 * dt);
      const D = num(v.dir) / 1000, vr = q / 3600 / 1000 / (Math.PI * D * D / 4);
      const j = jFlamant(q / 3600, num(v.dir), 0.00023).J;
      const hmt = j * num(v.lr) * 1.3 + num(v.dpv);
      const tret = num(v.td) - dt;
      let status = 'ok', msg = 'Bouclage cohérent.';
      if (tret < 50) { status = 'bad'; msg = 'Température de retour < 50 °C : non conforme (arrêté du 30/11/2005).'; }
      else if (vr < 0.2) { status = 'warn'; msg = 'Vitesse < 0,2 m/s dans le retour : réduire le diamètre (IND).'; }
      else if (vr > 1) { status = 'warn'; msg = 'Vitesse > 1 m/s dans le retour : bruit, érosion du cuivre (IND).'; }
      steps.push(`Température moyenne du fluide − ambiance = ${fx(Tm, 1)} K ; Φ total = ${fx(Phi, 0)} W`);
      steps.push(`q = ${fx(Phi, 0)} / (1,163 × ${dt}) = ${fx(q, 0)} l/h`);
      steps.push(`v retour = ${fx(vr, 2)} m/s ; HMT ≈ J·L·1,3 + vannes = ${fx(hmt, 2)} mCE (Flamant, IND)`);
      return { res: [['Pertes thermiques', fx(Phi / 1000, 2), 'kW'], ['Débit de bouclage', fx(q, 0), 'l/h'], ['Température de retour', fx(tret, 1), '°C'], ['Vitesse dans le retour', fx(vr, 2), 'm/s'], ['HMT circulateur', fx(hmt, 2), 'mCE']], status, msg, steps };
    }
  },

  /* 6 ─ Vase d'expansion ECS
     Cas test : 1000 l ; 10 → 60 °C ; prégonflage 3 bar ; soupape 7 bar
     → e ≈ 1,68 % ; Vexp ≈ 16,8 l ; Vvase ≈ 36 l → 50 l */
  vase: {
    title: 'Vase d\'expansion sanitaire', mod: 5,
    formula: 'e = ρ(T<sub>ef</sub>)/ρ(T<sub>s</sub>) − 1 &nbsp;; &nbsp; V<sub>vase</sub> = V·e·(P<sub>max</sub>+1)/(P<sub>max</sub> − P<sub>g</sub>)',
    desc: 'Évite que le groupe de sécurité ne rejette à chaque chauffe. Vase agréé pour l\'eau sanitaire (membrane alimentaire).',
    inputs: [
      { id: 'V', type: 'num', label: 'Volume d\'eau chauffée (ballons + réseau)', unit: 'l', value: 1000 },
      { id: 'tef', type: 'num', label: 'Température eau froide', unit: '°C', value: 10 },
      { id: 'ts', type: 'num', label: 'Température maxi', unit: '°C', value: 60 },
      { id: 'pg', type: 'num', label: 'Prégonflage = pression réseau après réducteur', unit: 'bar', value: 3, step: 0.1 },
      { id: 'ps', type: 'num', label: 'Tarage soupape / groupe de sécurité', unit: 'bar', value: 7, step: 0.5 }
    ],
    compute(v) {
      const e = rhoEau(num(v.tef)) / rhoEau(num(v.ts)) - 1, Vexp = num(v.V) * e;
      const pmax = num(v.ps) - 0.5, pg = num(v.pg);
      const Vv = Vexp * (pmax + 1) / (pmax - pg);
      const std = [8, 12, 18, 25, 35, 50, 60, 80, 100, 150, 200, 300, 500].find(s => s >= Vv) || NaN;
      let status = pg >= pmax ? 'bad' : 'ok', msg = pg >= pmax ? 'Prégonflage incompatible avec la soupape.' : `Vase commercial : ${std} l.`;
      return { res: [['Coefficient de dilatation e', fx(e * 100, 2), '%'], ['Volume dilaté', fx(Vexp, 1), 'l'], ['Volume de vase calculé', fx(Vv, 1), 'l'], ['Taille commerciale', fx(std, 0), 'l']], status, msg,
        steps: [`ρ(${v.tef} °C) = ${fx(rhoEau(num(v.tef)), 1)} kg/m³ ; ρ(${v.ts} °C) = ${fx(rhoEau(num(v.ts)), 1)} kg/m³`, `e = ${fx(e, 4)} ; Vexp = ${v.V} × e = ${fx(Vexp, 1)} l`,
          `Pmax = tarage − 0,5 bar = ${pmax} bar ; Vvase = ${fx(Vexp, 1)} × (${pmax}+1)/(${pmax} − ${pg}) = ${fx(Vv, 1)} l`] };
    }
  },

  /* 7 ─ Évacuations EU/EV ─ NF EN 12056-2 / NF DTU 60.11 P2
     Cas test : 10 WC 6 l, 4 urinoirs auto, 8 lavabos, 1 évier, 1 douche ; K = 0,5 ; ventilation primaire ; collecteur 1 cm/m, h/d 0,5
     → ΣDU = 27,4 ; Qww ≈ 2,62 l/s ; chute DN100 (WC) ; collecteur Ø110 (capacité ≈ 3,02 l/s ; v ≈ 0,72 m/s) */
  euev: {
    title: 'Évacuations EU / EV : chute et collecteur', mod: 7,
    formula: 'Q<sub>ww</sub> = K·√ΣDU &nbsp;; &nbsp; Q<sub>tot</sub> = Q<sub>ww</sub> + Q<sub>c</sub> + Q<sub>p</sub> &nbsp;; &nbsp; collecteur : Colebrook-White à remplissage partiel (k<sub>b</sub> = 1 mm)',
    desc: 'Méthode européenne reprise par le NF DTU 60.11 P2 (système I : chute unique, branchements remplis à 50 %).',
    inputs: [
      { id: 'app', type: 'table', label: 'Appareils raccordés', presets: APPAREILS_DU,
        cols: [['nom', 'Appareil', 'text'], ['n', 'Nombre', 'num'], ['du', 'DU (l/s)', 'num']],
        rows: [['WC réservoir 6 l', 10, 2.0], ['Urinoir à robinet de chasse / automatique', 4, 0.5], ['Lavabo / lave-mains', 8, 0.5], ['Évier', 1, 0.8], ['Douche sans bouchon', 1, 0.6]] },
      { id: 'K', type: 'select', label: 'Coefficient de fréquence K', value: '0.5', options: [['0.5', '0,5 — usage intermittent (bureaux, logements)'], ['0.7', '0,7 — fréquent (restaurants, hôtels, écoles, hôpitaux)'], ['1.0', '1,0 — très fréquent (toilettes et douches publiques)'], ['1.2', '1,2 — spécial (laboratoires)']] },
      { id: 'qc', type: 'num', label: 'Débits continus Qc', unit: 'l/s', value: 0 },
      { id: 'qp', type: 'num', label: 'Débits pompés Qp (relevage)', unit: 'l/s', value: 0 },
      { id: 'vent', type: 'select', label: 'Ventilation de la chute', value: 'primaire', options: [['primaire', 'Primaire seule'], ['secondaire', 'Primaire + secondaire']] },
      { id: 'pente', type: 'num', label: 'Pente du collecteur', unit: 'cm/m', value: 1, step: 0.5 },
      { id: 'hd', type: 'select', label: 'Taux de remplissage h/d', value: '0.5', options: [['0.5', '0,5'], ['0.7', '0,7']] }
    ],
    compute(v) {
      let S = 0, wc = false, dumax = 0;
      v.app.forEach(r => { S += num(r[1]) * num(r[2]); if (/WC/i.test(r[0]) && num(r[1]) > 0) wc = true; if (num(r[1]) > 0) dumax = Math.max(dumax, num(r[2])); });
      const K = num(v.K, 0.5);
      let Qww = Math.max(K * Math.sqrt(S), dumax);
      const Q = Qww + num(v.qc) + num(v.qp);
      let ch = CHUTES[v.vent].find(c => c[1] >= Q && (!wc || c[0] >= 100));
      const pente = num(v.pente, 1) / 100, hd = num(v.hd, 0.5);
      let col = null, cap = null;
      for (const t of PVC_EVAC) { if (t[1] < 70) continue; const c = qPartiel(t[1], pente, hd); if (c.Q >= Q && (!wc || t[1] >= 96)) { col = t; cap = c; break; } }
      let status = 'ok', msg = 'Dimensionnement cohérent.';
      if (!ch || !col) { status = 'bad'; msg = 'Débit hors des tables : dédoubler la chute ou augmenter la pente.'; }
      else if (cap.v < 0.6) { status = 'warn'; msg = 'Vitesse < 0,6 m/s : risque de dépôts, augmenter la pente (IND).'; }
      if (num(v.pente) < 1) { status = 'warn'; msg = 'Pente < 1 cm/m : en dessous de l\'usage courant (IND).'; }
      return { res: [['ΣDU', fx(S, 1), 'l/s'], ['Qww', fx(Qww, 2), 'l/s'], ['Qtot', fx(Q, 2), 'l/s'],
        ['Chute (DN mini)', ch ? 'DN' + ch[0] + ' (capacité ' + fx(ch[1], 1) + ' l/s)' : '—', ''],
        ['Collecteur PVC', col ? col[0] : '—', ''], ['Capacité collecteur', cap ? fx(cap.Q, 2) : '—', 'l/s'], ['Vitesse collecteur', cap ? fx(cap.v, 2) : '—', 'm/s']], status, msg,
        steps: [`ΣDU = ${fx(S, 1)} ; Qww = ${K} × √${fx(S, 1)} = ${fx(K * Math.sqrt(S), 2)} l/s (au moins le plus gros DU : ${dumax} l/s)`,
          `Qtot = ${fx(Qww, 2)} + ${v.qc} + ${v.qp} = ${fx(Q, 2)} l/s`,
          `Chute : premier DN dont la capacité (${v.vent === 'primaire' ? 'ventilation primaire' : 'ventilation secondaire'}) ≥ Qtot ${wc ? 'et ≥ DN100 car WC raccordés' : ''} — tables NF EN 12056-2 ${IND}`,
          `Collecteur : Colebrook-White, kb = 1 mm, pente ${v.pente} cm/m, h/d = ${hd} → ${col ? col[0] + ' : Q = ' + fx(cap.Q, 2) + ' l/s, v = ' + fx(cap.v, 2) + ' m/s' : 'aucun'}`] };
    }
  },

  /* 8 ─ Eaux pluviales ─ NF DTU 60.11 P3 / NF EN 12056-3
     Cas test : 400 m² ; r = 0,05 l/s/m² ; C = 1 ; 2 descentes ; collecteur 1 cm/m
     → Q = 20 l/s ; 10 l/s par descente ; Di Wyly-Eaton ≈ 97 mm → Ø110 ; règle 1 cm²/m² → 200 cm², Di ≈ 160 mm → Ø200 ; collecteur Ø200 */
  ep: {
    title: 'Eaux pluviales : descentes et collecteur', mod: 8,
    formula: 'Q = r × A × C &nbsp;; &nbsp; descente : Q = 2,5·10⁻⁴·k<sub>b</sub><sup>−0,167</sup>·d<sub>i</sub><sup>2,667</sup>·f<sup>1,667</sup> (Wyly-Eaton, f = 0,33)',
    desc: 'Intensité de référence 3 l/min/m² (0,05 l/s/m²) en métropole selon le NF DTU 60.11 P3. Les tableaux du DTU priment : ce calcul sert à comprendre et à pré-dimensionner.',
    inputs: [
      { id: 'A', type: 'num', label: 'Surface en plan collectée', unit: 'm²', value: 400 },
      { id: 'r', type: 'num', label: 'Intensité pluviométrique', unit: 'l/s/m²', value: 0.05, step: 0.005, hint: '0,05 métropole ; 0,075 DROM' },
      { id: 'C', type: 'num', label: 'Coefficient de ruissellement de la toiture', unit: '', value: 1, step: 0.05, hint: 'Toiture étanchée : 1 ; toiture végétalisée : selon Avis Technique' },
      { id: 'n', type: 'num', label: 'Nombre de descentes', unit: '', value: 2 },
      { id: 'pente', type: 'num', label: 'Pente du collecteur EP', unit: 'cm/m', value: 1, step: 0.5 }
    ],
    compute(v) {
      const Q = num(v.r) * num(v.A) * num(v.C, 1), n = Math.max(1, num(v.n, 1)), q = Q / n;
      const diWE = Math.pow(q / (2.5e-4 * Math.pow(0.25, -0.167) * Math.pow(0.33, 1.667)), 1 / 2.667);
      const Scm = num(v.A) * num(v.C, 1) / n, diTrad = Math.sqrt(4 * Scm / Math.PI) * 10;
      const tWE = choisirTube(PVC_EVAC, diWE), tTr = choisirTube(PVC_EVAC, diTrad);
      let col = null, cap = null;
      for (const t of PVC_EVAC) { if (t[1] < 96) continue; const c = qPartiel(t[1], num(v.pente, 1) / 100, 0.7, 1.0); if (c.Q >= Q) { col = t; cap = c; break; } }
      let status = 'warn', msg = 'Pré-dimensionnement : confronter aux tableaux du NF DTU 60.11 P3 et à l\'Avis Technique des naissances. Prévoir les trop-pleins.';
      if (!col) { status = 'bad'; msg = 'Collecteur hors gamme : dédoubler ou augmenter la pente.'; }
      return { res: [['Débit total', fx(Q, 1), 'l/s'], ['Débit par descente', fx(q, 2), 'l/s'], ['Di mini (Wyly-Eaton)', fx(diWE, 0), 'mm'], ['→ Descente', tWE ? tWE[0] : '—', ''],
        ['Règle traditionnelle 1 cm²/m² (IND)', fx(Scm, 0) + ' cm² → Di ' + fx(diTrad, 0), 'mm'], ['→ Descente', tTr ? tTr[0] : '—', ''], ['Collecteur (h/d 0,7)', col ? col[0] + ' — ' + fx(cap.Q, 1) + ' l/s' : '—', '']], status, msg,
        steps: [`Q = ${v.r} × ${v.A} × ${v.C} = ${fx(Q, 2)} l/s`, `Par descente : ${fx(q, 2)} l/s`,
          `Wyly-Eaton (kb 0,25 mm, f = 0,33) : di = [q / (2,5·10⁻⁴ × 0,25^−0,167 × 0,33^1,667)]^(1/2,667) = ${fx(diWE, 1)} mm`,
          `Règle traditionnelle « 1 cm² de section de descente par m² de toiture » : ${fx(Scm, 0)} cm² → Di ${fx(diTrad, 0)} mm. ${IND}`,
          `Collecteur : Colebrook kb = 1 mm, remplissage 0,7, pente ${v.pente} cm/m`] };
    }
  },

  /* 9 ─ Rétention à la parcelle — méthode des pluies
     Cas test : toiture 4000 m² C 0,95 ; voirie 3000 m² C 0,9 ; espaces verts 3000 m² C 0,2 ; qf = 10 l/s/ha ; a = 5, b = 0,6
     → Sa = 7100 m² ; Qf = 10 l/s ; V ≈ 176 m³ à t ≈ 195 min ; vidange ≈ 4,9 h */
  retention: {
    title: 'Rétention des EP à la parcelle (méthode des pluies)', mod: 9,
    formula: 'h(t) = a·t<sup>1−b</sup> (mm, t en min) &nbsp;; &nbsp; V = max<sub>t</sub> [ S<sub>a</sub>·h(t)/1000 − Q<sub>f</sub>·60·t ] &nbsp;; &nbsp; S<sub>a</sub> = Σ C<sub>i</sub>·A<sub>i</sub>',
    desc: 'Le volume à stocker est l\'écart maximal entre la pluie tombée sur la surface active et ce qui s\'évacue au débit de fuite. Les coefficients de Montana doivent venir de Météo-France (station et période de retour imposées).',
    inputs: [
      { id: 's', type: 'table', label: 'Surfaces de la parcelle', presets: [['Toiture étanche', 0.95], ['Toiture végétalisée extensive', 0.5], ['Voirie / parking enrobé', 0.9], ['Pavés joints ouverts', 0.6], ['Espaces verts', 0.2], ['Stabilisé', 0.4]],
        cols: [['nom', 'Surface', 'text'], ['A', 'Aire (m²)', 'num'], ['C', 'Coefficient C', 'num']],
        rows: [['Toiture étanche', 4000, 0.95], ['Voirie / parking enrobé', 3000, 0.9], ['Espaces verts', 3000, 0.2]] },
      { id: 'qs', type: 'num', label: 'Débit de fuite spécifique imposé', unit: 'l/s/ha', value: 10, hint: 'Fixé par le PLU / zonage pluvial (souvent 1 à 10 l/s/ha)' },
      { id: 'a', type: 'num', label: 'Coefficient de Montana a', unit: 'mm/min', value: 5.0, step: 0.1, hint: 'Exemple fictif : utiliser les valeurs Météo-France' },
      { id: 'b', type: 'num', label: 'Coefficient de Montana b', unit: '', value: 0.6, step: 0.01 }
    ],
    compute(v) {
      let At = 0, Sa = 0; v.s.forEach(r => { At += num(r[1]); Sa += num(r[1]) * num(r[2]); });
      const Qf = num(v.qs) * At / 10000; // l/s
      const a = num(v.a), b = num(v.b);
      let Vmax = 0, tmax = 0; const pts = [];
      for (let t = 5; t <= 1440; t += 5) {
        const Vin = Sa * a * Math.pow(t, 1 - b) / 1000, Vout = Qf * 60 * t / 1000;
        pts.push([t, Vin, Vout]);
        if (Vin - Vout > Vmax) { Vmax = Vin - Vout; tmax = t; }
      }
      const tv = Qf > 0 ? Vmax / (Qf / 1000) / 3600 : Infinity;
      let status = 'ok', msg = 'Volume de rétention à confirmer par le dossier loi sur l\'eau et les coefficients officiels.';
      if (tv > 48) { status = 'warn'; msg = 'Vidange > 48 h : l\'ouvrage risque d\'être plein à la pluie suivante.'; }
      return { res: [['Surface totale', fx(At, 0), 'm²'], ['Surface active Sa', fx(Sa, 0), 'm²'], ['Coefficient moyen', fx(Sa / At, 2), ''], ['Débit de fuite Qf', fx(Qf, 2), 'l/s'],
        ['Volume de rétention', fx(Vmax, 0), 'm³'], ['Durée de pluie critique', fx(tmax, 0), 'min'], ['Temps de vidange', fx(tv, 1), 'h'], ['Ratio', fx(Vmax / Sa * 10000, 0), 'm³/ha actif']], status, msg,
        chart: { pts, tmax, Vmax },
        steps: [`Sa = Σ C·A = ${fx(Sa, 0)} m² sur ${fx(At, 0)} m²`, `Qf = ${v.qs} l/s/ha × ${fx(At / 10000, 3)} ha = ${fx(Qf, 2)} l/s`,
          `Pour chaque durée t : Ventrant = Sa·a·t^(1−b)/1000 ; Vsortant = Qf·60·t/1000`, `Maximum de l\'écart à t = ${tmax} min : V = ${fx(Vmax, 1)} m³`, `Vidange = V / Qf = ${fx(tv, 1)} h`] };
    }
  },

  /* 10 ─ Récupération d'eau de pluie
     Cas test : 1500 m² ; 650 mm/an ; C 0,9 ; filtre 0,9 ; 600 pers × 12 l/j × 230 j
     → ressource ≈ 790 m³/an ; besoin 1656 m³/an ; cuve ≈ 39 m³ ; couverture ≈ 48 % */
  recupEP: {
    title: 'Récupération et réutilisation des EP', mod: 9,
    formula: 'R = A·P·C·η &nbsp;; &nbsp; V<sub>cuve</sub> ≈ 5 % × min(R, B) (méthode simplifiée, ≈ 18 jours d\'autonomie)',
    desc: 'Cadre : décret n° 2024-796 et arrêté du 12 juillet 2024. Réseau séparé et repéré, appoint EDCH par surverse AA/AB.',
    inputs: [
      { id: 'A', type: 'num', label: 'Surface de captage (toiture)', unit: 'm²', value: 1500 },
      { id: 'P', type: 'num', label: 'Pluviométrie annuelle', unit: 'mm', value: 650 },
      { id: 'C', type: 'num', label: 'Coefficient de toiture', unit: '', value: 0.9, step: 0.05 },
      { id: 'eta', type: 'num', label: 'Rendement du filtre', unit: '', value: 0.9, step: 0.05 },
      { id: 'pers', type: 'num', label: 'Nombre d\'usagers', unit: '', value: 600 },
      { id: 'bj', type: 'num', label: 'Besoin non potable par usager et par jour', unit: 'l', value: 12, hint: 'Chasses d\'eau en bureaux, IND' },
      { id: 'j', type: 'num', label: 'Jours d\'occupation par an', unit: 'j', value: 230 }
    ],
    compute(v) {
      const R = num(v.A) * num(v.P) * num(v.C) * num(v.eta) / 1000;
      const B = num(v.pers) * num(v.bj) * num(v.j) / 1000;
      const Vc = 0.05 * Math.min(R, B), cov = Math.min(R, B) / B * 100;
      return { res: [['Ressource annuelle', fx(R, 0), 'm³/an'], ['Besoin annuel', fx(B, 0), 'm³/an'], ['Volume de cuve conseillé', fx(Vc, 1), 'm³'], ['Taux de couverture', fx(cov, 0), '%'], ['Appoint EDCH annuel', fx(Math.max(0, B - R), 0), 'm³/an']],
        status: 'ok', msg: 'Ordre de grandeur. Une simulation journalière (NF EN 16941-1) affine le volume.',
        steps: [`R = ${v.A} × ${v.P}/1000 × ${v.C} × ${v.eta} = ${fx(R, 0)} m³/an`, `B = ${v.pers} × ${v.bj} l × ${v.j} j = ${fx(B, 0)} m³/an`, `V = 5 % × min(R, B) = ${fx(Vc, 1)} m³ ${IND}`] };
    }
  },

  /* 11 ─ Poste de relevage
     Cas test : apports 3 l/s ; Z = 10/h ; Hg 5 m ; refoulement 40 m Di 65 mm
     → Qp = 3 l/s (v ≈ 0,90 m/s) ; Vu = 270 l ; HMT ≈ 6,1 m */
  relevage: {
    title: 'Poste de relevage', mod: 10,
    formula: 'V<sub>u</sub> = Q<sub>p</sub>·(3600/Z)/4 &nbsp;; &nbsp; HMT = H<sub>g</sub> + J·L·1,2 &nbsp;; &nbsp; v<sub>refoulement</sub> ≥ 0,7 m/s',
    desc: 'NF EN 12050 et NF EN 12056-4. Pompe doublée en EV, clapet anti-retour, vanne, boucle anti-refoulement au-dessus du niveau de la voirie.',
    inputs: [
      { id: 'Q', type: 'num', label: 'Apports maximaux', unit: 'l/s', value: 3 },
      { id: 'Z', type: 'num', label: 'Démarrages maxi par heure', unit: '/h', value: 10 },
      { id: 'hg', type: 'num', label: 'Hauteur géométrique', unit: 'm', value: 5 },
      { id: 'L', type: 'num', label: 'Longueur de refoulement', unit: 'm', value: 40 },
      { id: 'di', type: 'num', label: 'Diamètre intérieur du refoulement', unit: 'mm', value: 65 }
    ],
    compute(v) {
      const D = num(v.di) / 1000, A = Math.PI * D * D / 4;
      const Qmin = 0.7 * A * 1000, Qp = Math.max(num(v.Q), Qmin);
      const vr = Qp / 1000 / A, Vu = Qp * (3600 / num(v.Z, 10)) / 4;
      const J = jFlamant(Qp, num(v.di), 0.00023).J, hmt = num(v.hg) + J * num(v.L) * 1.2;
      let status = 'ok', msg = 'Prévoir 2 pompes (1 secours), alarme niveau très haut reportée en GTB.';
      if (vr > 2.5) { status = 'warn'; msg = 'Vitesse élevée dans le refoulement : augmenter le diamètre.'; }
      return { res: [['Débit de pompe retenu', fx(Qp, 2), 'l/s'], ['Soit', fx(Qp * 3.6, 1), 'm³/h'], ['Vitesse de refoulement', fx(vr, 2), 'm/s'], ['Volume utile de bâche', fx(Vu, 0), 'l'], ['HMT', fx(hmt, 1), 'mCE']], status, msg,
        steps: [`Débit mini pour v ≥ 0,7 m/s : ${fx(Qmin, 2)} l/s → Qp = max(apports, mini) = ${fx(Qp, 2)} l/s`, `Vu = ${fx(Qp, 2)} × (3600/${v.Z}) / 4 = ${fx(Vu, 0)} l`, `HMT = ${v.hg} + ${fx(J, 4)} × ${v.L} × 1,2 = ${fx(hmt, 2)} m (Flamant)`] };
    }
  },

  /* 12 ─ Séparateur à graisses ─ NF EN 1825-2 (méthode simplifiée)
     Cas test : restaurant traditionnel 400 repas/j ; 8 h ; ft 1,3 ; fd 1 ; fr 1,3
     → Qs ≈ 5,90 l/s ; NS ≈ 9,98 → NS 10 */
  graisses: {
    title: 'Séparateur à graisses', mod: 10,
    formula: 'Q<sub>s</sub> = M·V<sub>M</sub>·F / (3600·t) &nbsp;; &nbsp; NS = Q<sub>s</sub>·f<sub>t</sub>·f<sub>d</sub>·f<sub>r</sub>',
    desc: 'Pour chaque restaurant du centre commercial, ou un séparateur commun si le règlement du centre le prévoit.',
    inputs: [
      { id: 'type', type: 'select', label: 'Type d\'établissement', value: 'resto', options: Object.entries(GRAISSES).map(([k, g]) => [k, `${g[0]} (VM ${g[1]} l, F ${g[2]})`]) },
      { id: 'M', type: 'num', label: 'Repas par jour', unit: '', value: 400 },
      { id: 't', type: 'num', label: 'Durée journalière d\'activité', unit: 'h', value: 8 },
      { id: 'ft', type: 'select', label: 'Facteur température ft', value: '1.3', options: [['1', '1,0 — eaux ≤ 60 °C'], ['1.3', '1,3 — eaux > 60 °C']] },
      { id: 'fd', type: 'select', label: 'Facteur densité fd', value: '1', options: [['1', '1,0 — graisses ≤ 0,94'], ['1.5', '1,5 — graisses > 0,94']] },
      { id: 'fr', type: 'select', label: 'Facteur détergents fr', value: '1.3', options: [['1', '1,0 — sans'], ['1.3', '1,3 — avec détergents'], ['1.5', '1,5 — avec rinçage haute pression (IND)']] }
    ],
    compute(v) {
      const g = GRAISSES[v.type];
      const Qs = num(v.M) * g[1] * g[2] / (3600 * num(v.t, 8));
      const NS = Qs * num(v.ft) * num(v.fd) * num(v.fr);
      const std = NS_TAILLES.find(s => s >= NS) || NaN;
      return { res: [['Débit de pointe Qs', fx(Qs, 2), 'l/s'], ['Taille nominale calculée', fx(NS, 2), ''], ['Taille nominale retenue', 'NS ' + fx(std, 0), '']],
        status: 'warn', msg: 'Méthode simplifiée : VM et F ' + 'à confirmer dans la NF EN 1825-2 et auprès du gestionnaire du réseau.',
        steps: [`VM = ${g[1]} l/repas, F = ${g[2]} ${IND}`, `Qs = ${v.M} × ${g[1]} × ${g[2]} / (3600 × ${v.t}) = ${fx(Qs, 3)} l/s`, `NS = ${fx(Qs, 3)} × ${v.ft} × ${v.fd} × ${v.fr} = ${fx(NS, 2)} → NS ${std}`] };
    }
  },

  /* 13 ─ Séparateur à hydrocarbures ─ NF EN 858-2
     Cas test : 3000 m² ; C 0,9 ; i = 150 l/s/ha ; débit partiel 20 % ; Qs 0 ; fd 1 ; boues moyennes
     → Qr = 40,5 l/s ; NS = 8,1 → NS 10 ; débourbeur ≥ 2000 l */
  hydrocarbures: {
    title: 'Séparateur à hydrocarbures', mod: 10,
    formula: 'Q<sub>r</sub> = C·i·A &nbsp;; &nbsp; NS = (Q<sub>r</sub>·α + f<sub>x</sub>·Q<sub>s</sub>)·f<sub>d</sub> &nbsp;; &nbsp; V<sub>débourbeur</sub> = 200·NS/f<sub>d</sub> (boues moyennes)',
    desc: 'Parkings extérieurs et aires de livraison. Le traitement en débit partiel (by-pass) n\'est admis que si le gestionnaire l\'accepte.',
    inputs: [
      { id: 'A', type: 'num', label: 'Surface imperméabilisée drainée', unit: 'm²', value: 3000 },
      { id: 'C', type: 'num', label: 'Coefficient de ruissellement', unit: '', value: 0.9, step: 0.05 },
      { id: 'i', type: 'num', label: 'Intensité de pluie de calcul', unit: 'l/s/ha', value: 150 },
      { id: 'alpha', type: 'num', label: 'Fraction traitée (100 % = pleine capacité)', unit: '%', value: 20 },
      { id: 'qs', type: 'num', label: 'Effluents de lavage Qs', unit: 'l/s', value: 0 },
      { id: 'fd', type: 'select', label: 'Facteur densité fd', value: '1', options: [['1', '1,0 — classe I + II, hydrocarbures ≤ 0,85'], ['1.5', '1,5 — classe I seule ou densité plus forte (IND)']] },
      { id: 'boue', type: 'select', label: 'Quantité de boues', value: '200', options: [['100', 'Faible : 100·NS/fd'], ['200', 'Moyenne : 200·NS/fd'], ['300', 'Importante : 300·NS/fd']] }
    ],
    compute(v) {
      const Qr = num(v.C) * num(v.i) * num(v.A) / 10000;
      const NS = (Qr * num(v.alpha) / 100 + 2 * num(v.qs)) * num(v.fd);
      const std = NS_TAILLES.find(s => s >= NS) || NaN;
      const Vd = num(v.boue) * std / num(v.fd);
      return { res: [['Débit de pluie Qr', fx(Qr, 1), 'l/s'], ['Taille nominale calculée', fx(NS, 2), ''], ['Taille retenue', 'NS ' + fx(std, 0), ''], ['Volume du débourbeur', fx(Vd, 0), 'l']],
        status: num(v.alpha) < 100 ? 'warn' : 'ok', msg: num(v.alpha) < 100 ? 'Débit partiel : faire valider par le gestionnaire du réseau (by-pass obligatoire pour le surplus).' : 'Pleine capacité.',
        steps: [`Qr = ${v.C} × ${v.i} × ${v.A}/10 000 = ${fx(Qr, 2)} l/s`, `NS = (${fx(Qr, 2)} × ${v.alpha} % + 2 × ${v.qs}) × ${v.fd} = ${fx(NS, 2)} → NS ${std}`, `Débourbeur ≥ ${v.boue} × ${std} / ${v.fd} = ${fx(Vd, 0)} l ${IND}`] };
    }
  },

  /* 14 ─ Ratios sanitaires ─ Code du travail R.4228-10 et R.4228-7
     Cas test : 300 hommes, 300 femmes → WC H 15 ; urinoirs 15 ; WC F 30 ; lavabos 60 */
  sanitaires: {
    title: 'Nombre d\'appareils sanitaires (lieux de travail)', mod: 11,
    formula: 'Hommes : 1 cabinet + 1 urinoir pour 20 &nbsp;; &nbsp; Femmes : 2 cabinets pour 20 &nbsp;; &nbsp; 1 lavabo pour 10 travailleurs au plus',
    desc: 'Code du travail, articles R.4228-10 (cabinets et urinoirs) et R.4228-7 (lavabos). Pour un ERP, les sanitaires du public se dimensionnent selon le programme et l\'accessibilité.',
    inputs: [
      { id: 'h', type: 'num', label: 'Effectif hommes', unit: '', value: 300 },
      { id: 'f', type: 'num', label: 'Effectif femmes', unit: '', value: 300 },
      { id: 'niv', type: 'num', label: 'Nombre de niveaux occupés', unit: '', value: 6 }
    ],
    compute(v) {
      const H = num(v.h), F = num(v.f), wh = Math.ceil(H / 20), u = Math.ceil(H / 20), wf = Math.ceil(F / 10), l = Math.ceil((H + F) / 10);
      const n = Math.max(1, num(v.niv, 1));
      return { res: [['Cabinets hommes', wh, ''], ['Urinoirs', u, ''], ['Cabinets femmes', wf, ''], ['Lavabos', l, ''], ['Par niveau (cabinets H / urinoirs / cabinets F / lavabos)', `${Math.ceil(wh / n)} / ${Math.ceil(u / n)} / ${Math.ceil(wf / n)} / ${Math.ceil(l / n)}`, ''], ['Cabinets accessibles PMR', 'au moins 1 par niveau et par sexe (voir texte)', '']],
        status: 'ok', msg: 'Minimum réglementaire. Les programmes tertiaires (certifications, confort) demandent souvent plus.',
        steps: [`Hommes : ⌈${H}/20⌉ = ${wh} cabinets et ${u} urinoirs`, `Femmes : ⌈${F}/20 × 2⌉ = ${wf} cabinets`, `Lavabos : ⌈${H + F}/10⌉ = ${l}`, 'Effectif à prendre en compte et dispositions PMR : voir le texte.'] };
    }
  },

  /* 15 ─ RIA
     Cas test : 2 RIA ; K 37 ; Pmin 2,5 bar ; H 12 m ; L 80 m Di 51 ; P réseau 4,5 bar ; 20 min
     → Q unitaire ≈ 58,5 l/min ; Qtot ≈ 117 l/min ; P nécessaire ≈ 4,01 bar → conforme ; réserve ≈ 2,3 m³ */
  ria: {
    title: 'Robinets d\'incendie armés (RIA)', mod: 12,
    formula: 'Q = K·√P &nbsp;; &nbsp; P<sub>nécessaire</sub> = P<sub>RIA</sub> + ρgH + J·L·1,2',
    desc: 'NF EN 671-1 et règle APSAD R5. Les pressions mini, le nombre de RIA simultanés et la durée sont fixés par le référentiel retenu : les valeurs par défaut sont indicatives.',
    inputs: [
      { id: 'n', type: 'num', label: 'RIA en fonctionnement simultané', unit: '', value: 2 },
      { id: 'K', type: 'num', label: 'Coefficient K du diffuseur', unit: 'l/min/√bar', value: 37, hint: 'Donnée fabricant' },
      { id: 'p', type: 'num', label: 'Pression dynamique mini au RIA défavorisé', unit: 'bar', value: 2.5, step: 0.1 },
      { id: 'H', type: 'num', label: 'Hauteur source → RIA défavorisé', unit: 'm', value: 12 },
      { id: 'L', type: 'num', label: 'Longueur de canalisation', unit: 'm', value: 80 },
      { id: 'di', type: 'num', label: 'Diamètre intérieur', unit: 'mm', value: 51 },
      { id: 'pr', type: 'num', label: 'Pression mini disponible à la source', unit: 'bar', value: 4.5, step: 0.1 },
      { id: 't', type: 'num', label: 'Durée de fonctionnement', unit: 'min', value: 20 }
    ],
    compute(v) {
      const q1 = num(v.K) * Math.sqrt(num(v.p)), Q = q1 * num(v.n);
      const j = jFlamant(Q / 60, num(v.di), 0.00023).J, dp = j * num(v.L) * 1.2 * 0.0981;
      const pn = num(v.p) + num(v.H) * 0.0981 + dp, V = Q * num(v.t) / 1000;
      const ok = pn <= num(v.pr);
      return { res: [['Débit par RIA', fx(q1, 1), 'l/min'], ['Débit total', fx(Q, 0), 'l/min'], ['Soit', fx(Q * 0.06, 1), 'm³/h'], ['Pertes de charge', fx(dp, 2), 'bar'], ['Pression nécessaire à la source', fx(pn, 2), 'bar'], ['Volume de réserve', fx(V, 1), 'm³']],
        status: ok ? 'ok' : 'bad', msg: ok ? 'Pression suffisante sans surpresseur incendie.' : `Il manque ${fx(pn - num(v.pr), 2)} bar : surpresseur incendie ou réseau dédié.`,
        steps: [`q = ${v.K} × √${v.p} = ${fx(q1, 1)} l/min ; Q = ${v.n} × q = ${fx(Q, 0)} l/min`, `Pertes (Flamant) : ${fx(j * 1000, 1)} mm/m × ${v.L} m × 1,2 = ${fx(dp, 2)} bar`, `P = ${v.p} + ${v.H} × 0,0981 + ${fx(dp, 2)} = ${fx(pn, 2)} bar`, `Réserve = ${fx(Q, 0)} × ${v.t} = ${fx(V, 1)} m³ ${IND}`] };
    }
  },

  /* 16 ─ Pré-estimation sprinkleur ─ NF EN 12845
     Cas test : OH3, marge 0 %, sans RIA → Q = 1080 l/min ; V = 64,8 m³ */
  sprinkleur: {
    title: 'Pré-estimation d\'une réserve sprinkleur', mod: 12,
    formula: 'Q = d × S<sub>impliquée</sub> × (1 + m) &nbsp;; &nbsp; V = (Q + Q<sub>RIA</sub>) × t',
    desc: 'Pour réserver une bâche et un local en APS. Le calcul hydraulique réel est fait par l\'installateur certifié (NF EN 12845 / APSAD R1).',
    inputs: [
      { id: 'cl', type: 'select', label: 'Classe de risque', value: 'OH3', options: Object.entries(SPK).map(([k, s]) => [k, `${s[0]} : ${s[1]} mm/min, ${s[2]} m², ${s[3]} min`]) },
      { id: 'm', type: 'num', label: 'Marge hydraulique (déséquilibre des têtes)', unit: '%', value: 0 },
      { id: 'qria', type: 'num', label: 'Débit RIA sur la même source', unit: 'l/min', value: 0 }
    ],
    compute(v) {
      const s = SPK[v.cl], Q = s[1] * s[2] * (1 + num(v.m) / 100), V = (Q + num(v.qria)) * s[3] / 1000;
      return { res: [['Densité', fx(s[1], 2), 'mm/min'], ['Surface impliquée', fx(s[2], 0), 'm²'], ['Durée', fx(s[3], 0), 'min'], ['Débit', fx(Q, 0), 'l/min'], ['Soit', fx(Q * 0.06, 1), 'm³/h'], ['Volume de réserve', fx(V, 1), 'm³']],
        status: 'warn', msg: 'Ordre de grandeur pour l\'APS uniquement.',
        steps: [`${s[0]} : d = ${s[1]} mm/min = ${s[1]} l/min/m² ; S = ${s[2]} m² ; t = ${s[3]} min ${IND}`, `Q = ${s[1]} × ${s[2]} × ${fx(1 + num(v.m) / 100, 2)} = ${fx(Q, 0)} l/min`, `V = (${fx(Q, 0)} + ${v.qria}) × ${s[3]} / 1000 = ${fx(V, 1)} m³`] };
    }
  },

  /* 17 ─ Choix NF EN 1717
     Cas test : « Appoint d'une cuve d'eau de pluie » → catégorie 5 → AA, AB, AD */
  en1717: {
    title: 'Protection anti-retour (NF EN 1717)', mod: 6,
    formula: 'Usage → catégorie de fluide (1 à 5) → dispositifs dont la catégorie maxi ≥ catégorie du fluide',
    desc: 'Catégorie 1 : EDCH. 2 : EDCH modifiée sans danger (chauffée). 3 : faible toxicité. 4 : substance toxique. 5 : danger microbiologique.',
    inputs: [{ id: 'u', type: 'select', label: 'Usage à protéger', value: '9', options: EN1717_USAGES.map((u, i) => [String(i), u[0]]) }],
    compute(v) {
      const u = EN1717_USAGES[num(v.u)], c = u[1];
      const ok = EN1717_DISPO.filter(d => d[2] >= c).map(d => d[0] + ' (' + d[1] + ')');
      return { res: [['Catégorie de fluide', c, ''], ['Dispositifs admissibles', ok.join(' ; '), ''], ['Pratique courante', u[2], '']], status: c >= 4 ? 'warn' : 'ok',
        msg: c >= 4 ? 'Risque élevé : dispositif contrôlable ou surverse, maintenance annuelle tracée.' : 'Risque faible à modéré.',
        steps: ['Classement de l\'usage ' + IND, `Dispositifs : ceux qui protègent jusqu\'à la catégorie ${c} au moins`] };
    }
  },

  /* 18 ─ Calorifuge
     Cas test : Ø28 ; 30 mm ; λ 0,035 ; 60/20 °C ; 100 m ; 8760 h ; rendement 0,9 ; 0,15 €/kWh
     → nu ≈ 35,2 W/m ; isolé ≈ 7,2 W/m ; économie ≈ 27 300 kWh/an */
  calorifuge: {
    title: 'Calorifuge d\'une conduite', mod: 5,
    formula: 'φ<sub>nu</sub> = h·π·D·ΔT &nbsp;; &nbsp; φ<sub>isolé</sub> = ΔT / [ln(D₂/D₁)/(2πλ) + 1/(h·π·D₂)] &nbsp; (h ≈ 10 W/m²·K)',
    desc: 'Valable pour l\'ECS, le bouclage et les réseaux CVC (même physique).',
    inputs: [
      { id: 'D', type: 'num', label: 'Diamètre extérieur du tube', unit: 'mm', value: 28 },
      { id: 'e', type: 'num', label: 'Épaisseur d\'isolant', unit: 'mm', value: 30 },
      { id: 'l', type: 'num', label: 'Conductivité λ', unit: 'W/m·K', value: 0.035, step: 0.001 },
      { id: 'tf', type: 'num', label: 'Température du fluide', unit: '°C', value: 60 },
      { id: 'ta', type: 'num', label: 'Température ambiante', unit: '°C', value: 20 },
      { id: 'L', type: 'num', label: 'Longueur', unit: 'm', value: 100 },
      { id: 'h', type: 'num', label: 'Heures de fonctionnement par an', unit: 'h', value: 8760 },
      { id: 'eta', type: 'num', label: 'Rendement de production', unit: '', value: 0.9, step: 0.05 },
      { id: 'pr', type: 'num', label: 'Prix de l\'énergie', unit: '€/kWh', value: 0.15, step: 0.01 }
    ],
    compute(v) {
      const dT = num(v.tf) - num(v.ta);
      const pn = pertesLin(num(v.D), 0, 0, dT), pi = pertesLin(num(v.D), num(v.e), num(v.l), dT);
      const E = (pn - pi) * num(v.L) * num(v.h) / 1000 / num(v.eta, 1);
      return { res: [['Pertes tube nu', fx(pn, 1), 'W/m'], ['Pertes tube isolé', fx(pi, 1), 'W/m'], ['Réduction', fx((1 - pi / pn) * 100, 0), '%'], ['Économie annuelle', fx(E, 0), 'kWh/an'], ['Soit', fx(E * num(v.pr), 0), '€/an']],
        status: 'ok', msg: 'h = 10 W/m²·K (convection naturelle + rayonnement) : ' + 'ordre de grandeur.',
        steps: [`ΔT = ${dT} K`, `Nu : 10 × π × ${v.D}/1000 × ${dT} = ${fx(pn, 1)} W/m`, `Isolé : ${fx(pi, 1)} W/m`, `Économie = (${fx(pn, 1)} − ${fx(pi, 1)}) × ${v.L} × ${v.h} / 1000 / ${v.eta} = ${fx(E, 0)} kWh/an`] };
    }
  },

  /* 19 ─ Coup de bélier (Joukowsky)
     Cas test : cuivre a = 1300 m/s ; Δv = 1,5 m/s ; L 30 m ; tf 0,02 s → Δp ≈ 19,5 bar, fermeture brusque (tc = 0,046 s) */
  belier: {
    title: 'Coup de bélier (Joukowsky)', mod: 1,
    formula: 'Δp = ρ·a·Δv &nbsp;; &nbsp; fermeture « brusque » si t<sub>f</sub> < 2L/a',
    desc: 'Montre pourquoi on limite les vitesses et pourquoi on pose des anti-béliers près des électrovannes et robinets à fermeture rapide.',
    inputs: [
      { id: 'mat', type: 'select', label: 'Matériau (célérité a, IND)', value: '1300', options: [['1300', 'Cuivre ≈ 1300 m/s'], ['1200', 'Acier ≈ 1200 m/s'], ['400', 'PVC ≈ 400 m/s'], ['350', 'PER / multicouche ≈ 350 m/s'], ['300', 'PEHD ≈ 300 m/s']] },
      { id: 'dv', type: 'num', label: 'Variation de vitesse (vitesse avant fermeture)', unit: 'm/s', value: 1.5, step: 0.1 },
      { id: 'L', type: 'num', label: 'Longueur de la conduite', unit: 'm', value: 30 },
      { id: 'tf', type: 'num', label: 'Durée de fermeture', unit: 's', value: 0.02, step: 0.01 }
    ],
    compute(v) {
      const a = num(v.mat), dp = 1000 * a * num(v.dv) / 1e5, tc = 2 * num(v.L) / a;
      const br = num(v.tf) < tc;
      return { res: [['Surpression maxi', fx(dp, 1), 'bar'], ['Temps critique 2L/a', fx(tc, 3), 's'], ['Fermeture', br ? 'brusque : surpression totale' : 'lente : surpression réduite (≈ Δp·tc/tf)', '']],
        status: dp > 10 && br ? 'bad' : 'warn', msg: br ? 'Prévoir un anti-bélier et limiter la vitesse.' : 'Fermeture lente.',
        steps: [`Δp = 1000 × ${a} × ${v.dv} = ${fx(dp * 1e5, 0)} Pa = ${fx(dp, 1)} bar`, `tc = 2 × ${v.L} / ${a} = ${fx(tc, 3)} s`] };
    }
  },

  /* 20 ─ Éligibilité BACS
     Cas test : 180 kW existant → obligation au 1er janvier 2027 */
  bacs: {
    title: 'Éligibilité au décret BACS', mod: 13,
    formula: 'P = puissance nominale utile des systèmes de chauffage ou de climatisation (combinés ou non avec la ventilation)',
    desc: 'Décret n° 2020-887 modifié par le décret n° 2023-259. Le système de GTB couvre aussi la production d\'ECS.',
    inputs: [
      { id: 'P', type: 'num', label: 'Puissance chauffage ou climatisation', unit: 'kW', value: 180 },
      { id: 'type', type: 'select', label: 'Bâtiment', value: 'exist', options: [['exist', 'Existant'], ['neuf', 'Neuf']] }
    ],
    compute(v) {
      const P = num(v.P); let r, s;
      if (P > 290) { r = 'Obligation en vigueur depuis le 1er janvier 2025'; s = 'bad'; }
      else if (P > 70) { r = v.type === 'neuf' ? 'Obligation (seuil 70 kW pour les bâtiments neufs récents — date du permis : voir décret)' : 'Obligation au 1er janvier 2027'; s = 'warn'; }
      else { r = 'Non concerné par le seuil (vérifier l\'évolution des textes)'; s = 'ok'; }
      return { res: [['Situation', r, ''], ['Exigences', 'Suivi, enregistrement et analyse des données par zone au pas horaire ; conservation 5 ans ; interopérabilité ; arrêt manuel et gestion autonome ; inspection tous les 5 ans', ''], ['Classe GTB visée', 'Classe B au minimum en pratique (NF EN ISO 52120-1), A recommandée', '']],
        status: s, msg: 'Exemption possible si le temps de retour > 10 ans (étude à fournir).',
        steps: ['Comparer la puissance aux seuils 290 kW et 70 kW', 'Texte : décret BACS modifié 2023 — à vérifier sur Légifrance'] };
    }
  },

  /* 21 ─ Convertisseur
     Cas test : 1 l/s → 3,6 m³/h et 60 l/min ; 3 bar → 30,6 mCE et 300 kPa */
  convert: {
    title: 'Convertisseur rapide', mod: 1,
    formula: '1 l/s = 3,6 m³/h = 60 l/min &nbsp;; &nbsp; 1 bar = 100 kPa ≈ 10,2 mCE',
    desc: 'Conversions de débit et de pression, et diamètre intérieur d\'un tube.',
    inputs: [
      { id: 'q', type: 'num', label: 'Débit', unit: '', value: 1 },
      { id: 'qu', type: 'select', label: 'Unité du débit', value: 'ls', options: [['ls', 'l/s'], ['m3h', 'm³/h'], ['lmin', 'l/min']] },
      { id: 'p', type: 'num', label: 'Pression', unit: '', value: 3 },
      { id: 'pu', type: 'select', label: 'Unité de pression', value: 'bar', options: [['bar', 'bar'], ['mce', 'mCE'], ['kpa', 'kPa']] },
      { id: 'mat', type: 'select', label: 'Matériau', value: 'cuivre', options: Object.entries(TUBES).map(([k, t]) => [k, t.nom]).concat([['pvcevac', 'PVC évacuation']]) }
    ],
    compute(v) {
      const q = num(v.q), ls = v.qu === 'ls' ? q : v.qu === 'm3h' ? q / 3.6 : q / 60;
      const p = num(v.p), bar = v.pu === 'bar' ? p : v.pu === 'mce' ? p / 10.197 : p / 100;
      const list = v.mat === 'pvcevac' ? PVC_EVAC : TUBES[v.mat].list;
      return { res: [['Débit', `${fx(ls, 3)} l/s = ${fx(ls * 3.6, 2)} m³/h = ${fx(ls * 60, 1)} l/min`, ''], ['Pression', `${fx(bar, 3)} bar = ${fx(bar * 10.197, 2)} mCE = ${fx(bar * 100, 1)} kPa`, ''],
        ['Diamètres intérieurs (IND)', list.map(t => `${t[0]} → ${fx(t[1], 1)}`).join(' ; '), 'mm']], status: 'ok', msg: '', steps: ['1 bar = 10⁵ Pa ; 1 mCE = ρ·g·1 m ≈ 9 807 Pa'] };
    }
  }
};

export { CALCS, IND, fx, num, jColebrook, jFlamant, qPartiel, qDescente, pertesLin, rhoEau, nuEau };
