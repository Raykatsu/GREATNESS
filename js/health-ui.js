// Apple Santé dans l'app : connexion (adresse personnelle pour le Raccourci iOS, pas-à-pas), récupération des
// mesures (à l'ouverture, au plus toutes les 10 min), carte « Forme du jour » sur l'accueil.
import { state, save } from "./store.js";
import { isOnlineMode, friendCall, authToken } from "./cloud.js";
import { SUPABASE_URL } from "./config.js";
import { mergeHealth, applyWeights, readinessFromHealth, formLabel, healthLine, dayKeyOf, shiftDay } from "./health.js";
import { $, $$, esc, I, sheet, toast, confirmSheet } from "./ui.js";
import { isNative, nativeHealthAvailable, nativeHealthAuthorize, nativeHealthRead } from "./native.js";
import { LOC } from "./i18n.js";

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const HEART = svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M5.5 12h3l1.5-3 2.5 6 1.5-3h4.5"/>');
const today = () => dayKeyOf(new Date());
let syncing = null, lastSync = 0;

// Mesures du serveur → state.health ; renvoie { added: pesées ajoutées à la courbe, changed } (null sans compte en ligne)
// App App Store : lue directement dans Apple Santé (HealthKit), sans compte en ligne ni Raccourci
const nativeOn = () => isNative() && !!state.health?.native;
export function syncHealth({ force = false } = {}) {
  if (!nativeOn() && (!isOnlineMode() || !authToken())) return Promise.resolve(null);
  if (!force && Date.now() - lastSync < 10 * 60e3) return Promise.resolve(null);
  return (syncing ||= (async () => {
    try {
      const native = nativeOn();
      const r = native ? { linked: true, days: await nativeHealthRead(35) } : await friendCall("gt_health_pull", { p_since: shiftDay(today(), -60) });
      lastSync = Date.now();
      const h = state.health || {};
      const days = mergeHealth(h.days, r.days);
      const added = applyWeights(state, days);
      const changed = JSON.stringify(days) !== JSON.stringify(h.days || {}) || h.linked !== !!r.linked;
      state.health = { ...h, days, linked: !!r.linked, at: Date.now() };
      if (changed || added) save({ silent: !added });
      return { added, changed: changed || !!added };
    } catch { return null; } finally { syncing = null; }
  })());
}

/* ---------- Accueil ---------- */
export function healthCard() {
  const days = state.health?.days || {}, r = readinessFromHealth(days), f = formLabel(r), line = healthLine(days);
  if (!line) return "";
  return `<button class="card tap hl-card mt-s" id="hl-open"><span class="hl-ic">${HEART}</span>
    <span class="grow"><b>${f ? esc(f.text) : "Apple Santé"}</b><span class="xs muted">${esc(line)}</span></span>
    ${f ? `<span class="hl-tone t-${f.tone}" aria-hidden="true"></span>` : ""}<span class="chev">${I.chev}</span></button>`;
}
export function bindHealthCard(root) { $("#hl-open", root)?.addEventListener("click", () => openHealth()); }

/* ---------- Connexion ---------- */
const urlFor = key => {
  let tz = "Europe/Paris";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch { /* ancien navigateur */ }
  return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/health?k=${encodeURIComponent(key)}&tz=${encodeURIComponent(tz)}&sleep=SOMMEIL&hrv=VFC&rhr=FCREPOS&steps=PAS&weight=POIDS&kcal=ENERGIE`;
};
const STEPS = `<ol class="hl-steps">
  <li>Ouvre l'app <b>Raccourcis</b> → <b>+</b> → nomme le raccourci « GREATNESS Santé ».</li>
  <li>Ajoute <b>Rechercher des échantillons de santé</b> pour chaque mesure :
    <ul><li><b>Sommeil</b> : type « Analyse du sommeil », date de début dans les dernières 24 heures, valeur qui n'est ni « Au lit » ni « Éveillé » ; puis <b>Obtenir les détails</b> → Durée, puis <b>Calculer les statistiques</b> → Somme.</li>
    <li><b>Pas</b> : type « Pas », date de début aujourd'hui ; puis <b>Calculer les statistiques</b> → Somme.</li>
    <li><b>Poids</b> : type « Poids corporel », trier du plus récent, limite 1.</li>
    <li>Avec une Apple Watch : <b>VFC</b> (« Variabilité de la fréquence cardiaque ») et <b>FC au repos</b> (« Fréquence cardiaque au repos »), plus récent, limite 1 ; et l'<b>énergie active</b> d'aujourd'hui (Somme).</li></ul></li>
  <li>Ajoute <b>Texte</b>, colle ton adresse, puis touche chaque mot en MAJUSCULES (SOMMEIL, PAS, POIDS…) et remplace-le par le résultat correspondant. Une mesure que tu n'as pas : efface simplement le mot.</li>
  <li>Ajoute <b>Obtenir le contenu de l'URL</b> avec ce texte. Lance le raccourci une fois : iOS demande l'accès à Santé → <b>Autoriser</b>.</li>
  <li>Onglet <b>Automatisation</b> → <b>+</b> → Heure de la journée → 7:30, tous les jours → <b>Exécuter immédiatement</b> → « GREATNESS Santé ». Ajoute-en une deuxième à 21:30 pour les pas de la journée.</li>
</ol>`;

// App App Store : une autorisation, et c'est tout
async function openNativeHealth() {
  const sh = sheet(`<div class="eyebrow">${HEART} Apple Santé</div><h2 class="h2">Ton sommeil et ton cœur dans l'app</h2>
    <p class="muted small">GREATNESS lit ton sommeil, ta variabilité cardiaque (VFC), ta fréquence au repos, tes pas, ton poids et ton énergie active. Ton bilan de forme est prérempli avant chaque séance, tes pesées rejoignent ta courbe et le coach en tient compte. Rien n'est écrit dans Santé.</p>
    <div id="hl-body" class="mt"></div>`, { z: 60 });
  const body = $("#hl-body", sh.el);
  const draw = () => {
    const h = state.health || {}, days = h.days || {}, last = Object.keys(days).sort().at(-1);
    body.innerHTML = h.native
      ? `<div class="card hl-status ${last ? "ok" : ""}">${last ? `${I.check}<div><b>Lu ${esc(fmtDay(last))}</b><span class="xs muted">${esc(healthLine(days, last) || "—")}</span></div>`
          : `${I.clock}<div><b>Autorisé, aucune mesure pour l'instant</b><span class="xs muted">Vérifie dans Réglages → Santé → Accès aux données que GREATNESS peut tout lire.</span></div>`}</div>
        <div class="grid2 mt-s"><button class="btn btn-soft" id="hl-check">${I.refresh} Actualiser</button><button class="btn btn-ghost danger" id="hl-off">${I.x} Ne plus lire</button></div>`
      : `<button class="btn btn-primary btn-block" id="hl-allow">${HEART} Autoriser l'accès à Santé</button>`;
    $("#hl-allow", body)?.addEventListener("click", async () => {
      try {
        if (!(await nativeHealthAvailable())) return toast("Apple Santé n'est pas disponible sur cet appareil.");
        await nativeHealthAuthorize();
        state.health = { ...(state.health || {}), native: true };
        save();
        const r = await syncHealth({ force: true });
        draw();
        toast(Object.keys(state.health?.days || {}).length ? `Apple Santé relié ✓${r?.added ? ` · ${r.added} pesée${r.added > 1 ? "s" : ""} ajoutée${r.added > 1 ? "s" : ""}` : ""}` : "Autorisé : les mesures arriveront ici.");
      } catch (e) { toast(e?.message || "Accès refusé"); }
    });
    $("#hl-check", body)?.addEventListener("click", async () => { await syncHealth({ force: true }); draw(); toast("Mesures à jour ✓"); });
    $("#hl-off", body)?.addEventListener("click", () => { state.health = { linked: false, days: {} }; save(); draw(); toast("Apple Santé n'est plus lu (tes pesées restent dans ta courbe)."); });
  };
  draw();
}

export async function openHealth() {
  if (isNative()) return openNativeHealth();
  if (!isOnlineMode() || !authToken()) {
    sheet(`<div class="eyebrow">Apple Santé</div><h2 class="h2">Ton sommeil et ton cœur dans l'app</h2>
      <p class="muted small">La liaison avec Apple Santé passe par ton compte en ligne : connecte-toi avec un compte en ligne pour l'activer.</p>`, { z: 60 });
    return;
  }
  const sh = sheet(`<div class="eyebrow">${HEART} Apple Santé</div><h2 class="h2">Ton sommeil et ton cœur dans l'app</h2>
    <p class="muted small">Un Raccourci iOS envoie chaque matin ton sommeil, ta variabilité cardiaque (VFC), ta fréquence au repos, tes pas et ton poids. L'app préremplit ton bilan de forme avant chaque séance, ajoute tes pesées à ta courbe (calories adaptatives plus justes) et le coach en tient compte.</p>
    <div id="hl-body" class="mt"><p class="muted small"><i class="spinner"></i> Vérification…</p></div>`, { z: 60 });
  const body = $("#hl-body", sh.el);
  await syncHealth({ force: true });
  if (!sh.el.isConnected) return;
  const draw = () => {
    const h = state.health || {}, days = h.days || {}, last = Object.keys(days).sort().at(-1);
    const url = h.url;
    body.innerHTML = `${h.linked ? `<div class="card hl-status ${last ? "ok" : ""}">${last ? `${I.check}<div><b>Reçu ${esc(fmtDay(last))}</b><span class="xs muted">${esc(healthLine(days, last) || "—")}</span></div>`
        : `${I.clock}<div><b>Relié, en attente des premières mesures</b><span class="xs muted">Lance ton raccourci une fois, puis touche « Vérifier ».</span></div>`}</div>` : ""}
      ${url ? `<div class="eyebrow mt">Ton adresse personnelle</div>
        <div class="hl-url"><code>${esc(url)}</code></div>
        <div class="grid2 mt-s"><button class="btn btn-soft" id="hl-copy">${I.check} Copier l'adresse</button><button class="btn btn-soft" id="hl-check">${I.refresh} Vérifier</button></div>
        <p class="xs muted mt-s">Garde-la pour toi : elle permet d'envoyer des mesures sur ton compte (et rien d'autre).</p>
        <details class="card adv mt" ${h.linked && last ? "" : "open"}><summary>Créer le raccourci (5 min, une seule fois)</summary>${STEPS}</details>`
      : h.linked ? `<p class="small muted mt">L'adresse n'est pas sur ce téléphone. Crée-en une nouvelle pour (re)faire le raccourci : l'ancienne cessera de marcher.</p>` : ""}
      <div class="${url ? "mt" : ""}">${!url ? `<button class="btn btn-primary btn-block" id="hl-new">${HEART} ${h.linked ? "Nouvelle adresse" : "Relier Apple Santé"}</button>`
        : `<button class="btn btn-ghost btn-sm" id="hl-new">${I.refresh} Nouvelle adresse</button>`}
        ${h.linked ? `<button class="btn btn-ghost btn-sm danger" id="hl-off">${I.x} Délier et effacer les mesures</button>` : ""}</div>`;
    $("#hl-copy", body)?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(url); toast("Adresse copiée ✓"); } catch { toast("Copie impossible : sélectionne l'adresse à la main."); }
    });
    $("#hl-check", body)?.addEventListener("click", async () => {
      const added = (await syncHealth({ force: true }))?.added;
      draw();
      const ok = Object.keys(state.health?.days || {}).length;
      toast(ok ? `Mesures reçues ✓${added ? ` · ${added} pesée${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}` : ""}` : "Rien reçu pour l'instant : lance ton raccourci.");
    });
    $("#hl-new", body).onclick = async () => {
      if (h.linked && !(await confirmSheet("Nouvelle adresse ?", "L'ancienne cessera de marcher : il faudra la remplacer dans ton raccourci.", "Créer"))) return;
      try {
        const r = await friendCall("gt_health_key");
        state.health = { ...(state.health || {}), url: urlFor(r.key), linked: true };
        save(); draw();
        toast("Adresse créée : copie-la dans ton raccourci");
      } catch (e) { toast(e.message || "Impossible pour l'instant"); }
    };
    $("#hl-off", body)?.addEventListener("click", async () => {
      if (!(await confirmSheet("Délier Apple Santé ?", "Le raccourci ne pourra plus rien envoyer et les mesures reçues seront effacées (tes pesées restent dans ta courbe).", "Délier", true))) return;
      try {
        await friendCall("gt_health_key", { p_revoke: true });
        state.health = { linked: false, days: {} };
        save(); draw(); toast("Apple Santé délié");
      } catch (e) { toast(e.message || "Impossible pour l'instant"); }
    });
  };
  draw();
}
// « aujourd'hui », « hier », « le mardi 13 octobre »
const fmtDay = key => { const [y, m, d] = key.split("-").map(Number); const t = new Date(y, m - 1, d); return key === today() ? "aujourd'hui" : key === shiftDay(today(), -1) ? "hier" : `le ${t.toLocaleDateString(LOC(), { weekday: "long", day: "numeric", month: "long" })}`; };

// Pour le check-in : sommeil et énergie proposés d'après Apple Santé (null sans mesure du jour)
export const healthReadiness = () => readinessFromHealth(state.health?.days || {});
