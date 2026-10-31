// Entretien paysager Réal — application de facturation (données stockées dans localStorage)
const TPS = 0.05;
const TVQ = 0.09975;
const KEY = 'facto-data-v1';
const EXPENSE_CATS = ['Carburant', 'Équipement', 'Végétaux & matériaux', 'Bureau','Logiciels', 'Matériel', 'Transport', 'Repas', 'Publicité', 'Formation', 'Télécommunications', 'Autre'];

const $ = (sel, el = document) => el.querySelector(sel);
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const money = n => (Math.round((n || 0) * 100) / 100).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round2 = n => Math.round(n * 100) / 100;

// ---------- Données ----------
function seed() {
  const c1 = uid(), c2 = uid();
  return {
    business: { name: 'Entretien paysager Réal', owner: '', address: '123, rue Principale\nMontréal (QC) H2X 1A1', email: '', phone: '', tpsNo: '', tvqNo: '', color: '#2e7d32', terms: 30, notes: 'Merci pour votre confiance!' },
    clients: [
      { id: c1, name: 'Famille Tremblay', email: 'tremblay@example.com', address: '45, rue des Érables\nQuébec (QC)' },
      { id: c2, name: 'Copropriété Les Jardins', email: 'gestion@lesjardins.example', address: '900, boul. Laurier\nQuébec (QC)' },
    ],
    products: [
      { id: uid(), name: 'Tonte de pelouse', price: 45, taxable: true },
      { id: uid(), name: 'Taille de haie (heure)', price: 60, taxable: true },
      { id: uid(), name: 'Nettoyage printanier', price: 250, taxable: true },
      { id: uid(), name: 'Déneigement (saison)', price: 450, taxable: true },
    ],
    docs: [
      { id: uid(), type: 'facture', number: 1001, clientId: c1, date: addDays(today(), -40), due: addDays(today(), -10), status: 'envoyee',
        items: [{ desc: 'Nettoyage printanier', qty: 1, price: 250, taxable: true }, { desc: 'Tonte de pelouse', qty: 4, price: 45, taxable: true }],
        payments: [{ id: uid(), date: addDays(today(), -12), amount: 494.39, note: 'Virement Interac' }], notes: '' },
      { id: uid(), type: 'facture', number: 1002, clientId: c2, date: addDays(today(), -5), due: addDays(today(), 25), status: 'envoyee',
        items: [{ desc: 'Taille de haie (heure)', qty: 8, price: 60, taxable: true }], payments: [], notes: '' },
      { id: uid(), type: 'devis', number: 1, clientId: c2, date: today(), due: addDays(today(), 30), status: 'brouillon',
        items: [{ desc: 'Déneigement (saison)', qty: 1, price: 450, taxable: true }], payments: [], notes: '' },
    ],
    expenses: [
      { id: uid(), date: addDays(today(), -20), category: 'Carburant', desc: 'Essence pour tondeuse', amount: 68.98, tps: 3, tvq: 5.98 },
    ],
  };
}
// Données de départ pour un nouveau compte en ligne : aucun exemple
function blank() {
  const s = seed();
  return { business: s.business, clients: [], products: s.products, docs: [], expenses: [] };
}
function loadLocal() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch {}
  return seed();
}

// Mode en ligne (Supabase) si config.js est rempli, sinon mode local
const CFG = window.FACTO_CONFIG || {};
const cloud = CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase
  ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
let user = null;
let db = cloud ? blank() : loadLocal();
let saveTimer = null, savePending = false;

function setSync(text, isError) {
  const el = $('#sync');
  el.textContent = text;
  el.classList.toggle('sync-error', !!isError);
}
function save() {
  if (!cloud) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} return; }
  if (!user) return;
  savePending = true;
  setSync('Enregistrement…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(pushCloud, 500);
}
async function pushCloud() {
  const { error } = await cloud.from('facto_data').upsert({ user_id: user.id, data: db, updated_at: new Date().toISOString() });
  savePending = !!error;
  setSync(error ? 'Erreur de sauvegarde — vérifiez la connexion' : 'Enregistré en ligne ✓', !!error);
  if (error) saveTimer = setTimeout(pushCloud, 5000);
}
window.addEventListener('beforeunload', e => { if (savePending) { e.preventDefault(); e.returnValue = ''; } });
async function loadCloud() {
  const { data, error } = await cloud.from('facto_data').select('data').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  db = data ? data.data : blank();
  if (!data) save();
  else setSync('Enregistré en ligne ✓');
}

// ---------- Connexion ----------
const AUTH_MODES = {
  login: { title: 'Connexion', button: 'Se connecter', password: true },
  signup: { title: 'Créer un compte', button: 'Créer le compte', password: true },
  forgot: { title: 'Mot de passe oublié', button: 'Envoyer le lien', password: false },
  reset: { title: 'Nouveau mot de passe', button: 'Enregistrer', password: true, noEmail: true },
};
function showAuth(mode, message = '', prefill = '') {
  const m = AUTH_MODES[mode];
  const form = $('#auth-form');
  const isNew = mode === 'signup' || mode === 'reset';
  // Sur cellulaire : pas de majuscule ni de correction automatique dans le courriel et le mot de passe
  const noAuto = 'autocapitalize="none" autocorrect="off" spellcheck="false"';
  form.innerHTML = `
    <div class="logo"><img class="logo-mark" src="logo.svg" alt=""> Entretien paysager Réal</div>
    <h2>${m.title}</h2>
    ${message ? `<p class="auth-msg">${esc(message)}</p>` : ''}
    ${m.noEmail ? '' : `<label>Courriel<input type="email" name="email" autocomplete="email" inputmode="email" ${noAuto} value="${esc(prefill)}" required></label>`}
    ${m.password ? `<label>Mot de passe<input type="password" name="password" minlength="8" autocomplete="${isNew ? 'new-password' : 'current-password'}" ${noAuto} required></label>` : ''}
    ${m.password && isNew ? `<label>Confirmer le mot de passe<input type="password" name="password2" minlength="8" autocomplete="new-password" ${noAuto} required></label>` : ''}
    ${m.password ? '<label class="show-pass"><input type="checkbox" data-show-pass> Afficher le mot de passe</label>' : ''}
    <button class="btn btn-primary" style="width:100%;justify-content:center">${m.button}</button>
    <div class="auth-links">
      ${mode === 'login' ? '<a data-mode="signup">Créer un compte</a><a data-mode="forgot">Mot de passe oublié?</a>' : mode === 'reset' ? '' : '<a data-mode="login">← Retour à la connexion</a>'}
    </div>`;
  form.onclick = e => {
    const a = e.target.closest('a[data-mode]');
    if (a) showAuth(a.dataset.mode, '', form.email ? form.email.value.trim() : '');
  };
  form.onchange = e => {
    if (e.target.matches('[data-show-pass]')) form.querySelectorAll('input[name^=password]').forEach(i => { i.type = e.target.checked ? 'text' : 'password'; });
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(form), password = fd.get('password');
    const email = (fd.get('email') || '').trim().toLowerCase();
    if (isNew && password !== fd.get('password2')) return showAuth(mode, 'Les deux mots de passe ne sont pas identiques.', email);
    const btn = form.querySelector('button'); btn.disabled = true;
    let res;
    if (mode === 'login') res = await cloud.auth.signInWithPassword({ email, password });
    if (mode === 'signup') res = await cloud.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } });
    if (mode === 'forgot') res = await cloud.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
    if (mode === 'reset') res = await cloud.auth.updateUser({ password });
    btn.disabled = false;
    if (res.error) return showAuth(mode, traduireErreur(res.error.message), email);
    if (mode === 'signup' && !res.data.session) return showAuth('login', 'Compte créé! Confirmez votre courriel avec le lien reçu, puis connectez-vous.', email);
    if (mode === 'forgot') return showAuth('login', 'Si ce courriel a un compte, un lien de réinitialisation vient d\'être envoyé.');
    if (mode === 'reset') { if (user && user.id === res.data.user.id) $('#auth').hidden = true; else enter(res.data.user); }
  };
  $('#auth').hidden = false;
}
function traduireErreur(msg) {
  if (/invalid login/i.test(msg)) return 'Courriel ou mot de passe incorrect.';
  if (/email not confirmed/i.test(msg)) return 'Confirmez d\'abord votre courriel avec le lien reçu.';
  if (/already registered/i.test(msg)) return 'Ce courriel a déjà un compte.';
  if (/signups not allowed/i.test(msg)) return 'Les nouvelles inscriptions sont désactivées.';
  if (/rate limit|too many/i.test(msg)) return 'Trop de tentatives ou de courriels envoyés. Réessayez dans une heure.';
  if (/password.*(at least|characters)|weak/i.test(msg)) return 'Mot de passe trop faible : au moins 8 caractères.';
  if (/failed to fetch|network/i.test(msg)) return 'Impossible de joindre le serveur. Vérifiez votre connexion Internet et config.js.';
  return msg;
}
// Écran de chargement : couvre l'app tant qu'on ne sait pas si l'utilisateur est connecté
function showLoading() {
  $('#auth-form').innerHTML = `<div class="logo"><img class="logo-mark" src="logo.svg" alt=""> Entretien paysager Réal</div><p class="auth-loading">Chargement…</p>`;
  $('#auth-form').onsubmit = e => e.preventDefault();
  $('#auth').hidden = false;
}
async function enter(u) {
  if (user && user.id === u.id) return;
  user = u;
  showLoading();
  try { await loadCloud(); } catch (e) { setSync('Impossible de charger les données', true); alert('Impossible de charger vos données : ' + e.message); }
  render();
  $('#signout').hidden = false;
  $('#auth').hidden = true;
}
function start() {
  if (!cloud) { $('#auth').hidden = true; setSync('Mode local (données dans ce navigateur)'); render(); return; }
  $('#signout').onclick = async () => {
    if (savePending) { clearTimeout(saveTimer); await pushCloud(); }
    await cloud.auth.signOut();
  };
  // Ne pas appeler Supabase directement dans ce rappel : on passe par setTimeout
  cloud.auth.onAuthStateChange((event, session) => setTimeout(() => {
    if (event === 'PASSWORD_RECOVERY') return showAuth('reset');
    if (event === 'SIGNED_OUT' || !session) {
      user = null; db = blank(); $('#signout').hidden = true; setSync('');
      $('#view').innerHTML = ''; return showAuth('login');
    }
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') enter(session.user);
  }, 0));
}

// ---------- Calculs ----------
function totals(doc) {
  let sub = 0, taxable = 0;
  for (const it of doc.items) { const l = (+it.qty || 0) * (+it.price || 0); sub += l; if (it.taxable) taxable += l; }
  const tps = round2(taxable * TPS), tvq = round2(taxable * TVQ);
  const total = round2(sub + tps + tvq);
  const paid = round2((doc.payments || []).reduce((s, p) => s + (+p.amount || 0), 0));
  return { sub: round2(sub), tps, tvq, total, paid, balance: round2(total - paid) };
}
function payStatus(doc) {
  if (doc.type === 'devis') return { accepte: ['Accepté', 'accepted'], converti: ['Converti', 'accepted'], envoye: ['Envoyé', ''], brouillon: ['Brouillon', ''] }[doc.status] || ['Brouillon', ''];
  const t = totals(doc);
  if (t.total > 0 && t.balance <= 0.005) return ['Payée', 'paid'];
  if (t.paid > 0) return ['Partielle', 'partial'];
  if (doc.due && doc.due < today()) return ['En retard', 'late'];
  return doc.status === 'brouillon' ? ['Brouillon', ''] : ['Impayée', 'unpaid'];
}
const client = id => db.clients.find(c => c.id === id) || { name: '—', address: '', email: '' };
const nextNumber = type => Math.max(type === 'facture' ? 1000 : 0, ...db.docs.filter(d => d.type === type).map(d => d.number)) + 1;
const docLabel = d => (d.type === 'facture' ? 'Facture' : 'Devis') + ' #' + d.number;

// ---------- Navigation ----------
let current = 'dashboard';
document.getElementById('menu').addEventListener('click', e => {
  const a = e.target.closest('a[data-view]'); if (!a) return;
  go(a.dataset.view);
  setMenu(false);
});
// Menu coulissant sur cellulaire
function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  $('#menu-toggle').setAttribute('aria-expanded', open);
}
$('#menu-toggle').onclick = () => setMenu(!document.body.classList.contains('menu-open'));
$('#drawer-backdrop').onclick = () => setMenu(false);
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
function go(view) {
  current = view;
  document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  $('#mobile-title').textContent = document.querySelector(`#menu a[data-view="${view}"]`).textContent;
  render();
  window.scrollTo(0, 0);
}
function render() {
  document.documentElement.style.setProperty('--brand', db.business.color || '#2e7d32');  $('#view').innerHTML = (views[current] || views.dashboard)();
}

// ---------- Vues ----------
const views = {
  dashboard() {
    const inv = db.docs.filter(d => d.type === 'facture');
    const ts = inv.map(totals);
    const outstanding = ts.reduce((s, t) => s + Math.max(0, t.balance), 0);
    const year = new Date().getFullYear().toString();
    const yearInv = inv.filter(d => d.date.startsWith(year));
    const sales = yearInv.map(totals).reduce((s, t) => s + t.sub, 0);
    const late = inv.filter(d => payStatus(d)[1] === 'late');
    const exp = db.expenses.filter(e => e.date.startsWith(year)).reduce((s, e) => s + +e.amount, 0);
    return `
      <div class="page-head"><h1>Tableau de bord</h1>
        <div class="toolbar"><button class="btn btn-primary" onclick="editDoc('facture')">+ Nouvelle facture</button><button class="btn" onclick="editDoc('devis')">+ Nouveau devis</button></div></div>
      <div class="stats">
        <div class="stat"><div class="label">Ventes ${year} (avant taxes)</div><div class="value">${money(sales)}</div></div>
        <div class="stat"><div class="label">À recevoir</div><div class="value">${money(outstanding)}</div></div>
        <div class="stat"><div class="label">Factures en retard</div><div class="value">${late.length}</div></div>
        <div class="stat"><div class="label">Dépenses ${year}</div><div class="value">${money(exp)}</div></div>
      </div>
      <div class="card"><h3>Documents récents</h3>${docTable(db.docs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6))}</div>`;
  },
  facture: () => docList('facture'),
  devis: () => docList('devis'),
  clients() {
    const rows = db.clients.map(c => {
      const bal = db.docs.filter(d => d.type === 'facture' && d.clientId === c.id).reduce((s, d) => s + Math.max(0, totals(d).balance), 0);
      return `<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.email)}</td><td class="num">${money(bal)}</td>
        <td class="actions"><button class="btn btn-sm" onclick="printStatement('${c.id}')">Relevé</button><button class="btn btn-sm" onclick="editClient('${c.id}')">Modifier</button><button class="btn btn-sm btn-danger" onclick="removeClient('${c.id}')">Supprimer</button></td></tr>`;
    }).join('');
    return `<div class="page-head"><h1>Clients</h1><button class="btn btn-primary" onclick="editClient()">+ Nouveau client</button></div>
      <div class="card table-wrap">${rows ? `<table><thead><tr><th>Nom</th><th>Courriel</th><th class="num">Solde dû</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty">Aucun client.</p>'}</div>`;
  },
  produits() {
    const rows = db.products.map(p => `<tr><td>${esc(p.name)}</td><td class="num">${money(p.price)}</td><td>${p.taxable ? 'TPS + TVQ' : 'Exempt'}</td>
      <td class="actions"><button class="btn btn-sm" onclick="editProduct('${p.id}')">Modifier</button><button class="btn btn-sm btn-danger" onclick="removeProduct('${p.id}')">Supprimer</button></td></tr>`).join('');
    return `<div class="page-head"><h1>Produits & services</h1><button class="btn btn-primary" onclick="editProduct()">+ Nouveau</button></div>
      <div class="card table-wrap">${rows ? `<table><thead><tr><th>Nom</th><th class="num">Prix</th><th>Taxes</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty">Aucun produit.</p>'}</div>`;
  },
  depenses() {
    const list = db.expenses.slice().sort((a, b) => b.date.localeCompare(a.date));
    const rows = list.map(e => `<tr><td>${e.date}</td><td>${esc(e.category)}</td><td>${esc(e.desc)}</td><td class="num">${money(e.tps)}</td><td class="num">${money(e.tvq)}</td><td class="num">${money(e.amount)}</td>
      <td class="actions"><button class="btn btn-sm" onclick="editExpense('${e.id}')">Modifier</button><button class="btn btn-sm btn-danger" onclick="removeExpense('${e.id}')">Supprimer</button></td></tr>`).join('');
    return `<div class="page-head"><h1>Dépenses</h1><button class="btn btn-primary" onclick="editExpense()">+ Nouvelle dépense</button></div>
      <div class="card table-wrap">${rows ? `<table><thead><tr><th>Date</th><th>Catégorie</th><th>Description</th><th class="num">TPS</th><th class="num">TVQ</th><th class="num">Total</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty">Aucune dépense.</p>'}</div>`;
  },
  rapports() {
    const period = reportPeriod;
    const end = today();
    const start = period === 'mois' ? end.slice(0, 7) + '-01' : period === 'trimestre' ? addDays(end, -90) : end.slice(0, 4) + '-01-01';
    const inv = db.docs.filter(d => d.type === 'facture' && d.date >= start && d.date <= end);
    const t = inv.map(totals).reduce((a, x) => ({ sub: a.sub + x.sub, tps: a.tps + x.tps, tvq: a.tvq + x.tvq, total: a.total + x.total, paid: a.paid + x.paid }), { sub: 0, tps: 0, tvq: 0, total: 0, paid: 0 });
    const ex = db.expenses.filter(e => e.date >= start && e.date <= end);
    const e = ex.reduce((a, x) => ({ amount: a.amount + +x.amount, tps: a.tps + +x.tps, tvq: a.tvq + +x.tvq }), { amount: 0, tps: 0, tvq: 0 });
    const byCat = EXPENSE_CATS.map(c => [c, ex.filter(x => x.category === c).reduce((s, x) => s + +x.amount, 0)]).filter(([, v]) => v > 0);
    const btn = (p, l) => `<button class="btn ${period === p ? 'btn-primary' : ''}" onclick="reportPeriod='${p}';render()">${l}</button>`;
    return `<div class="page-head"><h1>Rapports</h1><div class="toolbar">${btn('mois', 'Ce mois')}${btn('trimestre', '3 derniers mois')}${btn('annee', 'Cette année')}</div></div>
      <p style="color:var(--muted)">Du ${start} au ${end} — ${inv.length} facture(s)</p>
      <div class="stats">
        <div class="stat"><div class="label">Ventes avant taxes</div><div class="value">${money(t.sub)}</div></div>
        <div class="stat"><div class="label">Encaissé</div><div class="value">${money(t.paid)}</div></div>
        <div class="stat"><div class="label">Dépenses</div><div class="value">${money(e.amount)}</div></div>
        <div class="stat"><div class="label">Profit approx. (avant taxes)</div><div class="value">${money(t.sub - (e.amount - e.tps - e.tvq))}</div></div>
      </div>
      <div class="card"><h3>Sommaire des taxes</h3><table>
        <thead><tr><th></th><th class="num">TPS</th><th class="num">TVQ</th></tr></thead><tbody>
        <tr><td>Taxes perçues (ventes)</td><td class="num">${money(t.tps)}</td><td class="num">${money(t.tvq)}</td></tr>
        <tr><td>Crédits de taxe sur intrants (dépenses)</td><td class="num">− ${money(e.tps)}</td><td class="num">− ${money(e.tvq)}</td></tr>
        <tr><td><strong>Montant net à remettre</strong></td><td class="num"><strong>${money(t.tps - e.tps)}</strong></td><td class="num"><strong>${money(t.tvq - e.tvq)}</strong></td></tr>
        </tbody></table></div>
      <div class="card"><h3>Dépenses par catégorie</h3>${byCat.length ? `<table><tbody>${byCat.map(([c, v]) => `<tr><td>${c}</td><td class="num">${money(v)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucune dépense sur la période.</p>'}</div>`;
  },
  parametres() {
    const b = db.business;
    return `<div class="page-head"><h1>Paramètres</h1></div>
      <form class="card" onsubmit="saveSettings(event)">
        <div class="row"><label>Nom de l'entreprise<input name="name" value="${esc(b.name)}"></label><label>Votre nom<input name="owner" value="${esc(b.owner)}"></label></div>
        <label>Adresse<textarea name="address" rows="2">${esc(b.address)}</textarea></label>
        <div class="row"><label>Courriel<input name="email" value="${esc(b.email)}"></label><label>Téléphone<input name="phone" value="${esc(b.phone)}"></label></div>
        <div class="row"><label>N° TPS<input name="tpsNo" value="${esc(b.tpsNo)}"></label><label>N° TVQ<input name="tvqNo" value="${esc(b.tvqNo)}"></label></div>
        <div class="row"><label>Couleur principale<input type="color" name="color" value="${esc(b.color)}"></label><label>Délai de paiement (jours)<input type="number" name="terms" value="${b.terms}"></label></div>
        <label>Note par défaut sur les factures<textarea name="notes" rows="2">${esc(b.notes)}</textarea></label>
        <div class="modal-foot"><button class="btn btn-primary">Enregistrer</button></div>
      </form>
      <div class="card"><h3>Données</h3><p style="color:var(--muted)">${cloud ? `Connecté en tant que <strong>${esc(user && user.email)}</strong>. Vos données sont enregistrées en ligne et accessibles de n'importe quel appareil.` : 'Mode local : vos données sont enregistrées uniquement dans ce navigateur.'}</p>
        <div class="toolbar"><button class="btn" onclick="exportData()">Exporter (JSON)</button><label class="btn" style="margin:0;color:var(--ink)">Importer<input type="file" accept=".json" hidden onchange="importData(this)"></label><button class="btn btn-danger" onclick="resetData()">Réinitialiser</button></div></div>`;
  },
};
let reportPeriod = 'annee';

function docTable(list) {
  if (!list.length) return '<p class="empty">Aucun document pour l\'instant.</p>';
  const rows = list.map(d => {
    const t = totals(d), [label, cls] = payStatus(d);
    const actions = [`<button class="btn btn-sm" onclick="printDoc('${d.id}')">PDF</button>`,
      `<button class="btn btn-sm" onclick="editDoc('${d.type}','${d.id}')">Modifier</button>`];
    if (d.type === 'facture' && t.balance > 0) actions.unshift(`<button class="btn btn-sm" onclick="addPayment('${d.id}')">Paiement</button>`);
    if (d.type === 'devis' && d.status !== 'converti') actions.unshift(`<button class="btn btn-sm" onclick="convertQuote('${d.id}')">→ Facture</button>`);
    actions.push(`<button class="btn btn-sm btn-danger" onclick="removeDoc('${d.id}')">✕</button>`);
    return `<tr><td><strong>${docLabel(d)}</strong></td><td>${esc(client(d.clientId).name)}</td><td>${d.date}</td>
      <td class="num">${money(t.total)}</td><td class="num">${d.type === 'facture' ? money(Math.max(0, t.balance)) : ''}</td><td><span class="pill pill-${cls}">${label}</span></td>
      <td class="actions">${actions.join('')}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr><th>Document</th><th>Client</th><th>Date</th><th class="num">Total</th><th class="num">Solde</th><th>Statut</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
let docFilter = '';
function docList(type) {
  const q = docFilter.toLowerCase();
  const list = db.docs.filter(d => d.type === type && (!q || docLabel(d).toLowerCase().includes(q) || client(d.clientId).name.toLowerCase().includes(q)))
    .sort((a, b) => b.number - a.number);
  return `<div class="page-head"><h1>${type === 'facture' ? 'Factures' : 'Devis'}</h1><button class="btn btn-primary" onclick="editDoc('${type}')">+ ${type === 'facture' ? 'Nouvelle facture' : 'Nouveau devis'}</button></div>
    <div class="toolbar"><input placeholder="Rechercher par numéro ou client…" value="${esc(docFilter)}" oninput="docFilter=this.value;const p=this.selectionStart;render();const i=document.querySelector('.toolbar input');i.focus();i.setSelectionRange(p,p)" style="max-width:340px;margin:0"></div>
    <div class="card">${docTable(list)}</div>`;
}

// ---------- Modale ----------
const modal = $('#modal');
function openModal(html, onSubmit) {
  const form = $('#modal-form');
  form.innerHTML = html;
  form.onsubmit = e => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    if (onSubmit(new FormData(form), form) !== false) { modal.close(); save(); render(); }
  };
  modal.showModal();
}
const foot = (label = 'Enregistrer') => `<div class="modal-foot"><button class="btn" value="cancel" formnovalidate>Annuler</button><button class="btn btn-primary" value="ok">${label}</button></div>`;

// ---------- Documents ----------
function editDoc(type, id) {
  if (!db.clients.length) { alert('Ajoutez d\'abord un client.'); go('clients'); return; }
  const existing = db.docs.find(d => d.id === id);
  const d = existing ? structuredClone(existing) : { id: uid(), type, number: nextNumber(type), clientId: db.clients[0].id, date: today(), due: addDays(today(), +db.business.terms || 30), status: 'envoyee', items: [{ desc: '', qty: 1, price: 0, taxable: true }], payments: [], notes: db.business.notes };
  const statusOpts = type === 'devis'
    ? [['brouillon', 'Brouillon'], ['envoye', 'Envoyé'], ['accepte', 'Accepté'], ['converti', 'Converti']]
    : [['brouillon', 'Brouillon'], ['envoyee', 'Envoyée']];
  openModal(`
    <h2>${existing ? 'Modifier' : type === 'facture' ? 'Nouvelle' : 'Nouveau'} ${type === 'facture' ? 'facture' : 'devis'} #${d.number}</h2>
    <div class="row">
      <label>Client<select name="clientId">${db.clients.map(c => `<option value="${c.id}" ${c.id === d.clientId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label>Date<input type="date" name="date" value="${d.date}" required></label>
      <label>${type === 'facture' ? 'Échéance' : 'Valide jusqu\'au'}<input type="date" name="due" value="${d.due}"></label>
      <label>Statut<select name="status">${statusOpts.map(([v, l]) => `<option value="${v}" ${d.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="table-wrap"><table class="items"><thead><tr><th>Description</th><th style="width:80px">Qté</th><th style="width:110px">Prix</th><th style="width:60px">Taxes</th><th class="num" style="width:110px">Montant</th><th style="width:40px"></th></tr></thead><tbody id="items"></tbody></table></div>
    <div class="toolbar" style="margin-top:8px"><button type="button" class="btn btn-sm" onclick="addLine()">+ Ligne</button>
      ${db.products.length ? `<select style="max-width:260px;margin:0" onchange="if(this.value){addLine(this.value);this.value=''}"><option value="">+ Ajouter un produit…</option>${db.products.map(p => `<option value="${p.id}">${esc(p.name)} — ${money(p.price)}</option>`).join('')}</select>` : ''}</div>
    <div class="totals" id="doc-totals"></div>
    <label>Notes<textarea name="notes" rows="2">${esc(d.notes)}</textarea></label>
    ${foot()}`, fd => {
      Object.assign(d, { clientId: fd.get('clientId'), date: fd.get('date'), due: fd.get('due'), status: fd.get('status'), notes: fd.get('notes'), items: readLines() });
      if (existing) Object.assign(existing, d); else db.docs.push(d);
    });
  editingItems = d.items;
  drawLines();
}
let editingItems = [];
function drawLines() {
  $('#items').innerHTML = editingItems.map((it, i) => `<tr>
    <td><input data-f="desc" data-i="${i}" value="${esc(it.desc)}" placeholder="Description"></td>
    <td><input data-f="qty" data-i="${i}" type="number" step="any" value="${it.qty}"></td>
    <td><input data-f="price" data-i="${i}" type="number" step="0.01" value="${it.price}"></td>
    <td style="text-align:center"><input data-f="taxable" data-i="${i}" type="checkbox" ${it.taxable ? 'checked' : ''}></td>
    <td class="num">${money(it.qty * it.price)}</td>
    <td><button type="button" class="btn btn-sm btn-danger" onclick="editingItems.splice(${i},1);drawLines()">✕</button></td></tr>`).join('');
  $('#items').oninput = e => {
    const el = e.target, it = editingItems[el.dataset.i]; if (!it) return;
    it[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
    el.closest('tr').querySelector('.num').textContent = money(it.qty * it.price);
    drawTotals();
  };
  drawTotals();
}
function drawTotals() {
  const t = totals({ items: editingItems, payments: [] });
  $('#doc-totals').innerHTML = `<div><span>Sous-total</span><span>${money(t.sub)}</span></div><div><span>TPS (5 %)</span><span>${money(t.tps)}</span></div><div><span>TVQ (9,975 %)</span><span>${money(t.tvq)}</span></div><div class="grand"><span>Total</span><span>${money(t.total)}</span></div>`;
}
function addLine(productId) {
  const p = db.products.find(x => x.id === productId);
  const blank = editingItems.length === 1 && !editingItems[0].desc && !editingItems[0].price;
  const line = p ? { desc: p.name, qty: 1, price: p.price, taxable: p.taxable } : { desc: '', qty: 1, price: 0, taxable: true };
  if (blank && p) editingItems[0] = line; else editingItems.push(line);
  drawLines();
}
const readLines = () => editingItems.filter(it => it.desc || it.price);
function removeDoc(id) { const d = db.docs.find(x => x.id === id); if (confirm(`Supprimer ${docLabel(d)} ?`)) { db.docs = db.docs.filter(x => x.id !== id); save(); render(); } }
function convertQuote(id) {
  const q = db.docs.find(x => x.id === id);
  const inv = { ...structuredClone(q), id: uid(), type: 'facture', number: nextNumber('facture'), date: today(), due: addDays(today(), +db.business.terms || 30), status: 'envoyee', payments: [], fromQuote: q.number };
  db.docs.push(inv); q.status = 'converti'; save();
  go('facture'); editDoc('facture', inv.id);
}
function addPayment(id) {
  const d = db.docs.find(x => x.id === id), t = totals(d);
  openModal(`<h2>Paiement — ${docLabel(d)}</h2><p>Solde actuel : <strong>${money(t.balance)}</strong></p>
    <div class="row"><label>Date<input type="date" name="date" value="${today()}" required></label><label>Montant<input type="number" step="0.01" name="amount" value="${t.balance}" required></label></div>
    <label>Mode / note<input name="note" placeholder="Virement Interac, chèque, acompte…"></label>
    ${(d.payments || []).length ? `<h3>Paiements reçus</h3><table>${d.payments.map(p => `<tr><td>${p.date}</td><td>${esc(p.note)}</td><td class="num">${money(p.amount)}</td></tr>`).join('')}</table>` : ''}
    ${foot('Enregistrer le paiement')}`, fd => {
      (d.payments ||= []).push({ id: uid(), date: fd.get('date'), amount: +fd.get('amount'), note: fd.get('note') });
    });
}

// ---------- Clients / Produits / Dépenses ----------
function editClient(id) {
  const c = db.clients.find(x => x.id === id) || { id: uid(), name: '', email: '', address: '' };
  openModal(`<h2>${id ? 'Modifier' : 'Nouveau'} client</h2>
    <label>Nom<input name="name" value="${esc(c.name)}" required></label><label>Courriel<input type="email" name="email" value="${esc(c.email)}"></label>
    <label>Adresse<textarea name="address" rows="3">${esc(c.address)}</textarea></label>${foot()}`, fd => {
      Object.assign(c, { name: fd.get('name'), email: fd.get('email'), address: fd.get('address') });
      if (!id) db.clients.push(c);
    });
}
function removeClient(id) {
  if (db.docs.some(d => d.clientId === id)) return alert('Ce client a des documents; supprimez-les d\'abord.');
  if (confirm('Supprimer ce client ?')) { db.clients = db.clients.filter(c => c.id !== id); save(); render(); }
}
function editProduct(id) {
  const p = db.products.find(x => x.id === id) || { id: uid(), name: '', price: 0, taxable: true };
  openModal(`<h2>${id ? 'Modifier' : 'Nouveau'} produit ou service</h2>
    <label>Nom<input name="name" value="${esc(p.name)}" required></label><label>Prix unitaire<input type="number" step="0.01" name="price" value="${p.price}"></label>
    <label><input type="checkbox" name="taxable" ${p.taxable ? 'checked' : ''}>Taxable (TPS + TVQ)</label>${foot()}`, fd => {
      Object.assign(p, { name: fd.get('name'), price: +fd.get('price'), taxable: fd.has('taxable') });
      if (!id) db.products.push(p);
    });
}
function removeProduct(id) { if (confirm('Supprimer ce produit ?')) { db.products = db.products.filter(p => p.id !== id); save(); render(); } }
function editExpense(id) {
  const e = db.expenses.find(x => x.id === id) || { id: uid(), date: today(), category: EXPENSE_CATS[0], desc: '', amount: 0, tps: 0, tvq: 0 };
  openModal(`<h2>${id ? 'Modifier' : 'Nouvelle'} dépense</h2>
    <div class="row"><label>Date<input type="date" name="date" value="${e.date}" required></label><label>Catégorie<select name="category">${EXPENSE_CATS.map(c => `<option ${c === e.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <label>Description<input name="desc" value="${esc(e.desc)}"></label>
    <div class="row"><label>Total payé (taxes incl.)<input type="number" step="0.01" name="amount" value="${e.amount}" oninput="splitTaxes(this)"></label>
      <label>TPS payée<input type="number" step="0.01" name="tps" value="${e.tps}"></label><label>TVQ payée<input type="number" step="0.01" name="tvq" value="${e.tvq}"></label></div>
    <p style="color:var(--muted);font-size:.85rem">Les taxes sont estimées à partir du total; corrigez-les selon votre reçu.</p>${foot()}`, fd => {
      Object.assign(e, { date: fd.get('date'), category: fd.get('category'), desc: fd.get('desc'), amount: +fd.get('amount'), tps: +fd.get('tps'), tvq: +fd.get('tvq') });
      if (!id) db.expenses.push(e);
    });
}
function splitTaxes(input) {
  const f = input.form, base = +input.value / (1 + TPS + TVQ);
  f.tps.value = round2(base * TPS); f.tvq.value = round2(base * TVQ);
}
function removeExpense(id) { if (confirm('Supprimer cette dépense ?')) { db.expenses = db.expenses.filter(e => e.id !== id); save(); render(); } }

// ---------- Paramètres / données ----------
function saveSettings(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  for (const [k, v] of fd) db.business[k] = k === 'terms' ? +v : v;
  save(); render(); alert('Paramètres enregistrés.');
}
function exportData() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
  a.download = 'facto-donnees-' + today() + '.json'; a.click();
}
function importData(input) {
  const f = input.files[0]; if (!f) return;
  f.text().then(t => { try { const d = JSON.parse(t); if (!d.docs || !d.clients) throw 0; db = d; save(); render(); alert('Données importées.'); } catch { alert('Fichier invalide.'); } });
}
function resetData() {
  const msg = cloud ? 'Effacer TOUTES vos factures, clients et dépenses en ligne ? Cette action est définitive.' : 'Effacer toutes les données et revenir aux exemples ?';
  if (confirm(msg)) { db = cloud ? blank() : seed(); save(); render(); }
}

// ---------- Impression / PDF ----------
function bizBlock() {
  const b = db.business;
  return `<div><img class="doc-logo" src="logo.svg" alt=""><div style="font-size:18px;font-weight:700">${esc(b.name)}</div>${b.owner ? esc(b.owner) + '<br>' : ''}${esc(b.address).replace(/\n/g, '<br>')}
    ${b.email ? '<br>' + esc(b.email) : ''}${b.phone ? '<br>' + esc(b.phone) : ''}</div>`;
}
function taxNos() {
  const b = db.business;
  return [b.tpsNo && 'TPS : ' + esc(b.tpsNo), b.tvqNo && 'TVQ : ' + esc(b.tvqNo)].filter(Boolean).join(' · ');
}
function printHTML(html, title) {
  const area = $('#print-area');
  area.style.setProperty('--doc-color', db.business.color);
  area.innerHTML = html;
  const old = document.title; document.title = title;
  window.print();
  document.title = old;
}
function printDoc(id) {
  const d = db.docs.find(x => x.id === id), c = client(d.clientId), t = totals(d);
  const isInv = d.type === 'facture';
  printHTML(`<div class="doc">
    <div class="doc-head">${bizBlock()}<div class="doc-meta"><div class="doc-title">${isInv ? 'Facture' : 'Devis'}</div>
      N° ${d.number}<br>Date : ${d.date}<br>${isInv ? 'Échéance' : 'Valide jusqu\'au'} : ${d.due || '—'}</div></div>
    <p><strong>${isInv ? 'Facturé à' : 'Préparé pour'} :</strong><br>${esc(c.name)}<br>${esc(c.address).replace(/\n/g, '<br>')}</p>
    <table><thead><tr><th>Description</th><th class="num">Qté</th><th class="num">Prix</th><th class="num">Montant</th></tr></thead><tbody>
      ${d.items.map(it => `<tr><td>${esc(it.desc)}${it.taxable ? '' : ' <small>(exempt)</small>'}</td><td class="num">${it.qty}</td><td class="num">${money(it.price)}</td><td class="num">${money(it.qty * it.price)}</td></tr>`).join('')}
    </tbody></table>
    <div class="totals"><div><span>Sous-total</span><span>${money(t.sub)}</span></div><div><span>TPS (5 %)</span><span>${money(t.tps)}</span></div>
      <div><span>TVQ (9,975 %)</span><span>${money(t.tvq)}</span></div><div class="grand"><span>Total</span><span>${money(t.total)}</span></div>
      ${isInv && t.paid ? `<div><span>Payé</span><span>− ${money(t.paid)}</span></div><div class="grand"><span>Solde dû</span><span>${money(t.balance)}</span></div>` : ''}</div>
    ${d.notes ? `<p>${esc(d.notes).replace(/\n/g, '<br>')}</p>` : ''}
    <div class="doc-foot">${taxNos()}</div></div>`, `${isInv ? 'Facture' : 'Devis'}-${d.number}`);
}
function printStatement(clientId) {
  const c = client(clientId);
  const inv = db.docs.filter(d => d.type === 'facture' && d.clientId === clientId).sort((a, b) => a.date.localeCompare(b.date));
  const lines = [];
  for (const d of inv) {
    lines.push({ date: d.date, label: 'Facture #' + d.number, debit: totals(d).total, credit: 0 });
    for (const p of d.payments || []) lines.push({ date: p.date, label: 'Paiement — facture #' + d.number + (p.note ? ' (' + p.note + ')' : ''), debit: 0, credit: +p.amount });
  }
  lines.sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  printHTML(`<div class="doc">
    <div class="doc-head">${bizBlock()}<div class="doc-meta"><div class="doc-title">Relevé de compte</div>Date : ${today()}</div></div>
    <p><strong>Client :</strong><br>${esc(c.name)}<br>${esc(c.address).replace(/\n/g, '<br>')}</p>
    <table><thead><tr><th>Date</th><th>Description</th><th class="num">Débit</th><th class="num">Crédit</th><th class="num">Solde</th></tr></thead><tbody>
      ${lines.map(l => { bal = round2(bal + l.debit - l.credit); return `<tr><td>${l.date}</td><td>${esc(l.label)}</td><td class="num">${l.debit ? money(l.debit) : ''}</td><td class="num">${l.credit ? money(l.credit) : ''}</td><td class="num">${money(bal)}</td></tr>`; }).join('') || '<tr><td colspan="5">Aucune transaction.</td></tr>'}
    </tbody></table>
    <div class="totals"><div class="grand"><span>Solde dû</span><span>${money(bal)}</span></div></div>
    <div class="doc-foot">${taxNos()}</div></div>`, 'Releve-' + c.name);
}

start();
