// Fonction Supabase « reminders » : tournée des notifications et alerte de fin de repos (écran verrouillé),
// avec Deno, Supabase et web-push simulés.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// « npm:web-push » (Deno) → un faux module qui note les envois
register("data:text/javascript," + encodeURIComponent(`export async function resolve(spec, ctx, next) {
  if (spec.startsWith("npm:web-push")) return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent("export default { setVapidDetails() {}, sendNotification: (...a) => globalThis.__push(...a) };") };
  return next(spec, ctx);
}`));

let handler;
const env = { SUPABASE_URL: "https://sb.test", SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_abc" }), CRON_KEY: "cron-123", VAPID_PUBLIC_KEY: "BPUB", VAPID_PRIVATE_KEY: "priv", TIMER_MAX_WAIT_MS: "400" };
const waits = [];
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
globalThis.EdgeRuntime = { waitUntil: p => waits.push(p) };
const sent = [], rpcs = [], relays = [];
let timers = {}, goneSub = false;
globalThis.__push = async (sub, payload, opts) => {
  if (goneSub) throw Object.assign(new Error("gone"), { statusCode: 410 });
  sent.push({ sub, payload: JSON.parse(payload), opts });
};
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const body = JSON.parse(opts.body || "{}");
  if (url.endsWith("/functions/v1/reminders")) { relays.push({ body, key: opts.headers["x-cron-key"] }); return Response.json({ ok: true }); }
  const fn = url.split("/rpc/")[1];
  rpcs.push({ fn, body });
  assert.equal(opts.headers.apikey, "sb_secret_abc");
  if (fn === "gt_timer_set") {
    if (body.p_token !== "tok") return Response.json({ error: "BAD_TOKEN" });
    if (body.p_endpoint !== "https://push.test/abc") return Response.json({ error: "NO_SUB" });
    const fire_at = Date.now() + body.p_in_ms;
    timers[body.p_id] = { fire_at, state: "wait", title: body.p_title, body: body.p_body };
    return Response.json({ ok: true, fire_at });
  }
  if (fn === "gt_timer_cancel") { if (timers[body.p_id]) timers[body.p_id].state = "cancelled"; return Response.json({ ok: true }); }
  if (fn === "gt_timer_get") return Response.json(timers[body.p_id]?.state === "wait" ? { fire_at: timers[body.p_id].fire_at } : null);
  if (fn === "gt_timer_take") {
    const t = timers[body.p_id];
    if (!t || t.state !== "wait") return Response.json(null);
    t.state = "sent";
    return Response.json({ endpoint: "https://push.test/abc", sub: { endpoint: "https://push.test/abc" }, title: t.title, body: t.body });
  }
  if (fn === "gt_push_gone") return new Response(null, { status: 204 });
  return Response.json([]);
};
console.error = () => {};
const { MAX_WAIT } = await import(new URL("../supabase/functions/reminders/index.ts", import.meta.url));
const call = async (body, headers = {}) => { const r = await handler(new Request("https://fn.test/reminders", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) })); return { r, j: await r.json() }; };
const settle = async () => { while (waits.length) await waits.shift(); };

test("alerte de fin de repos : programmée par l'app (texte brut, sans vérification préalable), envoyée à l'heure, une seule fois", async () => {
  assert.equal(MAX_WAIT, 400);
  const t0 = Date.now();
  const { r, j } = await call(JSON.stringify({ token: "tok", timer: { id: "rest-abc123", endpoint: "https://push.test/abc", in: 150, title: "Repos terminé", body: "Série 3 · Développé couché · 80 kg × 8" } }));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  assert.equal(j.ok, true);
  assert.equal(sent.length, 0); // pas avant l'heure
  await settle();
  assert.ok(Date.now() - t0 >= 140);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].payload, { title: "Repos terminé", body: "Série 3 · Développé couché · 80 kg × 8", url: "./#/", tag: "rest" });
  assert.equal(sent[0].opts.urgency, "high");
  // relancer l'envoi ne renvoie rien (déjà envoyée)
  const { waitAndSend } = await import(new URL("../supabase/functions/reminders/index.ts", import.meta.url));
  assert.equal(await waitAndSend("rest-abc123"), "gone");
});

test("revenir dans l'app annule l'alerte ; jeton ou téléphone inconnus refusés ; préflight CORS", async () => {
  sent.length = 0;
  await call({ token: "tok", timer: { id: "rest-def456", endpoint: "https://push.test/abc", in: 120 } });
  const c = await call({ token: "tok", timer: { id: "rest-def456", cancel: true } });
  assert.equal(c.j.ok, true);
  await settle();
  assert.equal(sent.length, 0);
  assert.equal((await call({ token: "faux", timer: { id: "rest-x1y2z3", endpoint: "https://push.test/abc", in: 100 } })).j.error, "BAD_TOKEN");
  assert.equal((await call({ token: "tok", timer: { id: "rest-x1y2z3", endpoint: "https://ailleurs.test", in: 100 } })).j.error, "NO_SUB");
  assert.equal((await call({ timer: { id: "rest-x1y2z3" } })).r.status, 400);
  const pre = await handler(new Request("https://fn.test/reminders", { method: "OPTIONS" }));
  assert.equal(pre.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
});

test("long repos : relais vers une nouvelle exécution (limite de durée), qui envoie à l'heure", async () => {
  sent.length = 0; relays.length = 0;
  await call({ token: "tok", timer: { id: "rest-long01", endpoint: "https://push.test/abc", in: 900, title: "Repos terminé", body: "Squat" } });
  await settle();
  assert.equal(sent.length, 0);
  assert.deepEqual(relays.map(x => [x.body.relay, x.key]), [["rest-long01", "cron-123"]]);
  assert.equal((await call({ relay: "rest-long01" })).r.status, 403); // sans la clé : refusé
  // chaque nouvelle exécution (avec la clé de planification) reprend l'attente, jusqu'à l'envoi
  for (let i = 0; i < 6 && !sent.length; i++) {
    const r = relays.shift();
    assert.ok(r, "relais attendu");
    assert.equal((await call(r.body, { "x-cron-key": r.key })).j.ok, true);
    await settle();
  }
  assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.body, "Squat");
});

test("abonnement expiré : retiré ; tournée des rappels toujours réservée à la planification", async () => {
  goneSub = true; rpcs.length = 0;
  await call({ token: "tok", timer: { id: "rest-gone01", endpoint: "https://push.test/abc", in: 10 } });
  await settle();
  assert.deepEqual(rpcs.find(x => x.fn === "gt_push_gone")?.body, { p_endpoints: ["https://push.test/abc"] });
  goneSub = false;
  assert.equal((await call({})).r.status, 403);
  const { j } = await call({}, { "x-cron-key": "cron-123" });
  assert.deepEqual(j, { due: 0, social: 0, water: 0, league: 0, sent: 0, gone: 0 });
  const get = await handler(new Request("https://fn.test/reminders"));
  assert.deepEqual(await get.json(), { publicKey: "BPUB" });
});
