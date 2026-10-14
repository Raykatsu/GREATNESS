// Fonction Supabase « health » (supabase/functions/health/index.ts) : mesures Apple Santé envoyées par un Raccourci.
import test from "node:test";
import assert from "node:assert/strict";

let handler;
const env = { SUPABASE_URL: "https://sb.test", SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_abc" }) };
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };
const puts = [];
let down = false;
globalThis.fetch = async (url, opts = {}) => {
  const body = JSON.parse(opts.body || "{}");
  if (String(url).endsWith("/rpc/gt_health_put")) {
    if (down) return new Response("panne", { status: 500 });
    assert.equal(opts.headers.apikey, "sb_secret_abc");
    puts.push(body);
    return Response.json(body.p_key === "miles.secret" ? { ok: true, day: body.p_day } : { error: "BAD_KEY" });
  }
  return new Response("?", { status: 404 });
};
console.error = () => {};
const { num, clean, dayOf, sleepHours } = await import(new URL("../supabase/functions/health/index.ts", import.meta.url));
const call = async (qs, init = {}) => { const res = await handler(new Request(`https://fn.test/health?${qs}`, init)); return { res, body: await res.text() }; };

test("valeurs telles qu'iOS les écrit : virgules, unités, espaces, minutes ou secondes de sommeil", () => {
  assert.equal(num("72,4 kg"), 72.4);
  assert.equal(num("8 432"), 8432);
  assert.equal(num("8 432"), 8432);
  assert.equal(num(""), null);
  assert.equal(num("abc"), null);
  assert.deepEqual(clean({ steps: "8 432", sleep: "7,5", hrv: "58,3", rhr: "54", weight: "72,4 kg", kcal: "420" }),
    { steps: 8432, sleep: 7.5, hrv: 58, rhr: 54, weight: 72.4, kcal: 420 });
  assert.equal(clean({ sleep: "450" }).sleep, 7.5);    // minutes
  assert.equal(clean({ sleep: "27000" }).sleep, 7.5);  // secondes
  assert.deepEqual(clean({ steps: "-5", hrv: "900", rhr: "3", weight: "2000", sleep: "0,1", kcal: "" }), {}); // invraisemblable : ignoré
  assert.deepEqual(clean({ pas: "100", poids: "80", vfc: "40", fc: "60", sommeil: "8", energie: "300" }), { steps: 100, sleep: 8, hrv: 40, rhr: 60, weight: 80, kcal: 300 });
});

test("sommeil : toutes les façons dont iOS écrit une durée", () => {
  const cases = { "7,5": 7.5, "7.5": 7.5, "7:30": 7.5, "7:30:00": 7.5, "7 h 30 min": 7.5, "7 h 30 min": 7.5, "7h30": 7.5, "7 h": 7, "7 heures": 7,
    "450 min": 7.5, "450": 7.5, "27000": 7.5, "27000 s": 7.5, "27 000": 7.5 };
  for (const [v, h] of Object.entries(cases)) assert.equal(Math.round(sleepHours(v) * 100) / 100, h, v);
  assert.equal(sleepHours(450), 7.5);
  assert.equal(sleepHours(""), null);
  assert.equal(sleepHours("SOMMEIL"), null);
  assert.equal(clean({ sleep: "7 h 12 min" }).sleep, 7.2);
  assert.equal(clean({ weight: "160 lb" }).weight, 72.6);
  assert.equal(clean({ weight: "160,5 lbs" }).weight, 72.8);
});

test("jour local de l'envoi, ou le jour donné", () => {
  const late = new Date("2026-10-14T22:30:00Z"); // 0 h 30 le 15 à Paris, 18 h 30 le 14 à New York
  assert.equal(dayOf({ tz: "Europe/Paris" }, late), "2026-10-15");
  assert.equal(dayOf({ tz: "America/New_York" }, late), "2026-10-14");
  assert.equal(dayOf({ tz: "Pas/UnFuseau" }, late), "2026-10-15");
  assert.equal(dayOf({ d: "2026-10-10" }, late), "2026-10-10");
});

test("le Raccourci envoie ses mesures (GET ou POST) ; clé refusée, rien à enregistrer, serveur en panne", async () => {
  const ok = await call("k=miles.secret&tz=Europe/Paris&steps=8%20432&sleep=7,5&hrv=58&weight=72,4%20kg");
  assert.equal(ok.res.status, 200);
  const j = JSON.parse(ok.body);
  assert.equal(j.ok, true);
  assert.equal(j.message, "Reçu par GREATNESS : 8432 pas, 7,5 h de sommeil, VFC 58 ms, 72,4 kg.");
  assert.deepEqual(puts.at(-1).p_data, { steps: 8432, sleep: 7.5, hrv: 58, weight: 72.4, src: "apple" });
  assert.match(puts.at(-1).p_day, /^\d{4}-\d{2}-\d{2}$/);
  const post = await call("", { method: "POST", body: JSON.stringify({ k: "miles.secret", d: "2026-10-13", rhr: 52, kcal: 380 }) });
  assert.equal(JSON.parse(post.body).ok, true);
  assert.deepEqual([puts.at(-1).p_day, puts.at(-1).p_data], ["2026-10-13", { rhr: 52, kcal: 380, src: "apple" }]);
  const bad = await call("k=miles.faux&steps=10");
  assert.equal(bad.res.status, 403);
  assert.match(JSON.parse(bad.body).message, /Clé inconnue/);
  const none = await call("k=miles.secret&steps=&sleep=abc");
  assert.equal(none.res.status, 400);
  assert.equal(JSON.parse(none.body).error, "NO_DATA");
  down = true;
  const err = await call("k=miles.secret&steps=10");
  assert.equal(err.res.status, 503);
  down = false;
  const ping = await call("");
  assert.match(ping.body, /fonction santé en ligne/);
  assert.equal(ping.res.headers.get("access-control-allow-origin"), "*");
});
