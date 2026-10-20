// Outils des tests dans un iPhone simulé (Playwright + Chromium) : serveur local, serveur Supabase simulé,
// création de compte, erreurs JavaScript relevées. Lancés par « npm run test:browser » (et sur GitHub).
import { chromium, devices } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { serve } from "./serve.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const FAKE = "https://fake.supabase.co";
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Réponses par défaut du serveur simulé ; chaque test peut en remplacer (rpc: { gt_x: args => réponse })
const DEFAULTS = {
  gt_signup: () => ({ token: "t".repeat(64) }), gt_login: () => ({ token: "t".repeat(64) }),
  gt_pull: () => ({ data: null }), gt_health_pull: () => ({ linked: false, days: [] }),
  gt_friends: () => ({ friends: [] }), gt_is_admin: () => ({ admin: false }),
};

export async function openApp({ online = false, rpc = {}, colorScheme = "dark", reducedMotion = "reduce", webauthn = false, locale = "fr-FR" } = {}) {
  const srv = await serve(ROOT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], serviceWorkers: "block", colorScheme, reducedMotion, locale, timezoneId: "Europe/Paris" });
  await ctx.route("**/js/config.js", r => r.fulfill({ contentType: "text/javascript",
    body: `export const SUPABASE_URL = "${online ? FAKE : ""}"; export const SUPABASE_ANON_KEY = "${online ? "sb_publishable_test" : ""}"; export const VAPID_PUBLIC_KEY = ""; export const AI_FUNCTION = "coach";` }));
  await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|storage\.googleapis|unpkg|esm\.run/, r => r.abort());
  const rpcs = [], net = { down: false };
  if (online) await ctx.route(`${FAKE}/**`, r => {
    if (net.down) return r.abort("internetdisconnected"); // réseau coupé (setOffline ne touche pas aux routes simulées)
    const url = r.request().url();
    if (url.includes("/functions/v1/")) return r.fulfill({ status: 404, body: "{}" });
    const fn = url.split("/rpc/")[1], args = JSON.parse(r.request().postData() || "{}");
    rpcs.push({ fn, args });
    const res = (rpc[fn] || DEFAULTS[fn] || (() => ({ ok: true })))(args);
    return r.fulfill({ contentType: "application/json", body: JSON.stringify(res) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::|ERR_FAILED/.test(m.text())) errors.push(`console : ${m.text()}`); });
  let authenticator = null;
  if (webauthn) {
    // Face ID simulé : un authentificateur de plateforme qui vérifie l'utilisateur
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("WebAuthn.enable", { enableUI: false });
    authenticator = { cdp, ...(await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })) };
  }
  await page.goto(srv.url);
  await page.waitForSelector("#new, #have, .keypad", { timeout: 15000 });
  return { page, ctx, browser, srv, errors, rpcs, authenticator, net,
    close: async () => { await browser.close(); await srv.close(); } };
}

export const pin = async (page, code) => { for (const d of code) await page.click(`.keypad [data-k="${d}"]`); };

// Nouveau compte puis première ouverture passée (questions d'accueil)
export async function signup(page, user = "test", code = "1357") {
  await page.click("#new");
  await page.fill("#user", user);
  await page.click("#next");
  await pin(page, code); await page.click("#go");
  await pin(page, code);
  await page.waitForSelector("#next, #done", { timeout: 15000 }); // première ouverture
  for (let i = 0; i < 8; i++) {
    const btn = await page.$("#next, #done");
    if (!btn) break;
    await btn.click(); await sleep(350);
  }
  await closeSheets(page);
}
export const closeSheets = page => page.evaluate(() => document.querySelectorAll(".sheet-wrap").forEach(n => n.remove()));
export const go = async (page, hash) => { await page.evaluate(h => (location.hash = h), hash); await sleep(700); await closeSheets(page); };

// Séances passées, pour un compte qui a de l'historique
export const seed = (page, n = 12) => page.evaluate(async n => {
  const { state, save } = await import("/js/store.js");
  const H = 36e5, now = Date.now(), sets = (exId, name, k, w) => Array.from({ length: k }, () => ({ exId, name, weight: w, reps: 8, rpe: 8 }));
  for (let d = 1; d <= n; d++) state.sessions.push({ id: `s${d}`, date: now - d * 40 * H, name: `Séance ${d}`, programId: "push", durationSec: 3000, volume: 3000 + d * 40,
    prs: d % 4 ? [] : ["bench"], xp: 80, sets: [...sets("bench", "Développé couché", 3, 60 + d), ...sets("squat", "Squat", 3, 80 + d)] });
  state.sessions.sort((a, b) => a.date - b.date);
  save();
}, n);
