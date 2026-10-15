// Carte de séance à partager : une image au format story (1080 × 1920) avec ton coach (et son costume), la séance,
// la durée, le volume, les séries, les records et l'XP. Aperçu d'abord, puis la feuille de partage du téléphone
// (Instagram, WhatsApp, Photos…) ; sinon l'image s'enregistre.
import { current, figure } from "./chars/index.js";
import { wornCostume } from "./story.js";
import { costumeOf } from "./costumes.js";
import { state, rankInfo, streak, exName } from "./store.js";
import { isNative } from "./native.js";
import { $, esc, I, sheet, toast, fmtNum } from "./ui.js";

export const W = 1080, H = 1920;

export const durTxt = sec => { const m = Math.round((sec || 0) / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; };
const kg = w => String(Math.round(w * 10) / 10).replace(".", ",");

// Ce que montre la carte (logique pure, testée)
export function cardData(sum, { rank = "", streakDays = 0 } = {}) {
  const sets = sum.sets || [], reps = sets.reduce((a, s) => a + (+s.reps || 0), 0), nEx = new Set(sets.map(s => s.exId)).size;
  const prs = (sum.prs || []).slice(0, 3).map(id => {
    const own = sets.filter(s => s.exId === id);
    const best = own.reduce((b, s) => (!b || (s.weight || 0) * (1 + (s.reps || 0) / 30) > (b.weight || 0) * (1 + (b.reps || 0) / 30) ? s : b), null);
    return { name: best?.name || exName(id), txt: best ? (best.weight > 0 ? `${kg(best.weight)} kg × ${best.reps}` : `${best.reps} reps`) : "" };
  });
  return {
    title: sum.name || "Séance",
    date: new Date(sum.date || Date.now()).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
    stats: [
      { v: durTxt(sum.durationSec), l: "Durée" },
      sum.volume > 0 ? { v: `${fmtNum(sum.volume)} kg`, l: "Volume soulevé" } : { v: fmtNum(reps), l: "Répétitions" },
      { v: String(sets.length), l: sets.length > 1 ? "Séries" : "Série" },
      prs.length ? { v: String((sum.prs || []).length), l: (sum.prs || []).length > 1 ? "Records" : "Record", gold: true } : { v: String(nEx), l: nEx > 1 ? "Exercices" : "Exercice" },
    ],
    prs, xp: sum.xp || 0, rank, streak: streakDays,
  };
}

// Filtre CSS d'un costume → filtre SVG (Safari n'applique pas les filtres CSS dans une image SVG)
export function svgFilter(css = "") {
  const parts = [...String(css).matchAll(/(hue-rotate|saturate|brightness)\(\s*(-?[\d.]+)(?:deg)?\s*\)/g)];
  if (!parts.length) return "";
  const prim = ([, f, v]) => f === "hue-rotate" ? `<feColorMatrix type="hueRotate" values="${+v}"/>`
    : f === "saturate" ? `<feColorMatrix type="saturate" values="${+v}"/>`
    : `<feComponentTransfer>${["R", "G", "B"].map(c => `<feFunc${c} type="linear" slope="${+v}"/>`).join("")}</feComponentTransfer>`;
  return `<filter id="cf" color-interpolation-filters="sRGB" x="-20%" y="-20%" width="140%" height="140%">${parts.map(prim).join("")}</filter>`;
}

// Le coach en image SVG autonome (sans les styles de la page : haltère et « zzz » masqués, costume en filtre SVG)
export function coachSvg(c, costume) {
  const f = svgFilter(costumeOf(costume)?.filter);
  return figure(c, { costume })
    .replace(/ style="filter:[^"]*"/, "")
    .replace(/ viewBox="[^"]*"/, ' viewBox="-8 -10 76 94"')
    .replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" width="760" height="940" ')
    .replace(/(<svg[^>]*>)([\s\S]*)(<\/svg>)$/, (m, a, body, z) =>
      `${a}<style>.sp-db,.sp-zzz{display:none}${c.css || ""}</style>${f ? `<defs>${f}</defs><g filter="url(#cf)">${body}</g>` : body}${z}`);
}

const loadImg = src => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
const fonts = () => Promise.race([
  Promise.all(["800 90px Outfit", "700 50px Outfit", "600 40px Inter", "500 34px Inter"].map(f => document.fonts?.load(f))).catch(() => {}),
  new Promise(r => setTimeout(r, 1500)),
]);
function spaced(g, text, x, y, gap) { for (const ch of text) { g.fillText(ch, x, y); x += g.measureText(ch).width + gap; } }
function lines(g, text, maxW, max) {
  const out = [];
  let line = "";
  for (const w of String(text).split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (!line || g.measureText(t).width <= maxW) line = t; else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  if (out.length > max) { out.length = max; out[max - 1] = `${out[max - 1].replace(/\s+\S*$/, "")}…`; }
  return out;
}
function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }

export async function drawCard(sum) {
  const c = current(), costume = c.id === "none" ? null : wornCostume(state);
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--red").trim() || "#e8283b";
  const d = cardData(sum, { rank: rankInfo().rank?.name || "", streakDays: streak() });
  await fonts();
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  // fond sombre, halo de la couleur de l'app
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#101019"); bg.addColorStop(1, "#06060b");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const halo = g.createRadialGradient(W / 2, 540, 40, W / 2, 540, 560);
  halo.addColorStop(0, accent); halo.addColorStop(1, "rgba(0,0,0,0)");
  g.globalAlpha = 0.42; g.fillStyle = halo; g.fillRect(0, 0, W, 1150); g.globalAlpha = 1;
  // en-tête
  g.fillStyle = "#f3f3f6"; g.font = "800 40px Outfit, sans-serif"; g.textBaseline = "alphabetic";
  spaced(g, "GREATNESS", 80, 130, 9);
  g.fillStyle = "#a3a3b2"; g.font = "500 34px Inter, sans-serif"; g.textAlign = "right";
  g.fillText(d.date.charAt(0).toUpperCase() + d.date.slice(1), W - 80, 130); g.textAlign = "left";
  // le coach (ou un badge s'il n'y a pas de personnage)
  if (c.id !== "none") {
    try { const img = await loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(coachSvg(c, costume))}`); g.drawImage(img, (W - 540) / 2, 180, 540, 668); }
    catch { /* pas d'image : la carte reste lisible */ }
  } else {
    g.strokeStyle = accent; g.lineWidth = 22; g.beginPath(); g.arc(W / 2, 520, 190, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 30; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(W / 2 - 90, 520); g.lineTo(W / 2 - 22, 588); g.lineTo(W / 2 + 100, 455); g.stroke();
  }
  // titre
  g.fillStyle = accent; g.font = "700 38px Outfit, sans-serif"; spaced(g, "MISSION ACCOMPLIE", 80, 910, 6);
  g.fillStyle = "#ffffff"; g.font = "800 88px Outfit, sans-serif";
  let y = 1005;
  for (const l of lines(g, d.title, W - 160, 2)) { g.fillText(l, 80, y); y += 96; }
  // chiffres : 2 × 2 cartes
  const top = y - 30, cw = (W - 160 - 24) / 2, ch = 150;
  d.stats.forEach((s, i) => {
    const x = 80 + (i % 2) * (cw + 24), yy = top + Math.floor(i / 2) * (ch + 24);
    g.fillStyle = s.gold ? "rgba(255,196,0,.14)" : "rgba(255,255,255,.07)"; rrect(g, x, yy, cw, ch, 34); g.fill();
    g.fillStyle = s.gold ? "#ffc400" : "#ffffff"; g.font = "800 60px Outfit, sans-serif"; g.fillText(s.v, x + 34, yy + 82);
    g.fillStyle = "#a3a3b2"; g.font = "500 30px Inter, sans-serif"; g.fillText(s.l, x + 34, yy + 124);
  });
  y = top + 2 * (ch + 24) + 44;
  // records
  g.font = "600 36px Inter, sans-serif";
  for (const p of d.prs) {
    if (y > H - 215) break;
    g.fillStyle = "#ffc400"; g.fillText("🏆", 80, y);
    g.fillStyle = "#f3f3f6"; const name = lines(g, p.name, 560, 1)[0]; g.fillText(name, 140, y);
    g.fillStyle = "#a3a3b2"; g.textAlign = "right"; g.fillText(p.txt, W - 80, y); g.textAlign = "left";
    y += 62;
  }
  // pied : XP, rang, série de jours
  g.fillStyle = accent; rrect(g, 80, H - 170, W - 160, 4, 2); g.fill();
  g.fillStyle = "#f3f3f6"; g.font = "700 40px Outfit, sans-serif";
  g.fillText([`+${d.xp} XP`, d.rank, d.streak > 1 ? `🔥 ${d.streak} jours d'affilée` : ""].filter(Boolean).join("  ·  "), 80, H - 95);
  g.fillStyle = "#6f6f80"; g.font = "500 28px Inter, sans-serif"; g.fillText("raykatsu.github.io/GREATNESS", 80, H - 48);
  return cv;
}

// Aperçu de la carte, puis partage (la feuille de partage part dans le geste : l'image est prête avant)
export async function openShare(sum) {
  let url = null;
  const sh = sheet(`<div class="eyebrow">${I.share} Partager ma séance</div><h2 class="h2">${esc(sum.name || "Ta séance")}</h2>
    <div class="share-box mt" id="sc-box"><i class="spinner"></i></div><div id="sc-act"></div>`, { z: 85, onClose: () => url && setTimeout(() => URL.revokeObjectURL(url), 1500) });
  let blob;
  try { blob = await new Promise((ok, ko) => drawCard(sum).then(cv => cv.toBlob(b => (b ? ok(b) : ko(new Error("image"))), "image/png")).catch(ko)); }
  catch { $("#sc-box", sh.el).innerHTML = `<p class="muted small">Image impossible à créer sur ce téléphone.</p>`; return; }
  if (!sh.el.isConnected) return;
  const name = `greatness-${new Date(sum.date || Date.now()).toISOString().slice(0, 10)}.png`;
  const file = new File([blob], name, { type: "image/png" });
  url = URL.createObjectURL(blob);
  const text = `${sum.name} : ${durTxt(sum.durationSec)}${sum.volume > 0 ? `, ${fmtNum(sum.volume)} kg` : ""}${sum.prs?.length ? `, ${sum.prs.length} record${sum.prs.length > 1 ? "s" : ""} 🏆` : ""} 💪 #GREATNESS`;
  const canShare = !!navigator.canShare?.({ files: [file] });
  $("#sc-box", sh.el).innerHTML = `<img class="share-img" src="${url}" alt="Carte de la séance ${esc(sum.name || "")}"/>`;
  $("#sc-act", sh.el).innerHTML = `${canShare ? `<button class="btn btn-primary btn-lg btn-block mt" id="sc-share">${I.share} Partager</button>` : ""}
    ${!isNative() ? `<a class="btn ${canShare ? "btn-soft" : "btn-primary btn-lg"} btn-block mt-s" href="${url}" download="${name}">${I.down} Enregistrer l'image</a>` : ""}
    <p class="xs muted center mt-s">Ou appuie longuement sur l'image pour l'enregistrer.</p>`;
  $("#sc-share", sh.el)?.addEventListener("click", () => {
    navigator.share({ files: [file], text }).catch(e => { if (e?.name !== "AbortError") toast("Partage impossible : enregistre l'image."); });
  });
}
