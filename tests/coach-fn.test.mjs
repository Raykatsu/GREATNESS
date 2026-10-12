// Fonction Supabase « coach » (supabase/functions/coach/index.ts) avec Deno, Supabase et Gemini simulés.
import test from "node:test";
import assert from "node:assert/strict";

let handler;
const env = { GEMINI_API_KEY: "AQ.cle-de-test", SUPABASE_URL: "https://sb.test", SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_abc" }), SUPABASE_SERVICE_ROLE_KEY: "eyJancienne", DIAG_TOKEN: "d".repeat(24) };
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };

const calls = [];
let mode = {}, quota = { ok: true, user: "alex", remaining: 41 };
const enc = new TextEncoder();
const CHUNKS = [
  { candidates: [{ content: { parts: [{ text: "pensée cachée", thought: true }] } }] },
  { candidates: [{ content: { parts: [{ text: "Bonjour " }] } }], modelVersion: "gemini-x-flash" },
  { candidates: [{ content: { parts: [{ text: "Alex !" }] }, finishReason: "STOP", groundingMetadata: { groundingChunks: [{ web: { uri: "https://ex.fr/a", title: "Source A" } }] } }] },
];
// Flux SSE de Gemini livré par morceaux ; cutAfter : la connexion tombe après n octets
function stream(chunks, cutAfter = 0) {
  const b = enc.encode(chunks.map(c => `data: ${JSON.stringify(c)}\r\n\r\n`).join(""));
  const parts = cutAfter ? [b.slice(0, 37), b.slice(37, cutAfter), "ERR"] : [b.slice(0, 37), b.slice(37)];
  return new Response(new ReadableStream({ async pull(c) { await new Promise(r => setTimeout(r, 1)); const p = parts.shift(); if (p === "ERR") c.error(new Error("connexion perdue")); else if (p) c.enqueue(p); else c.close(); } }));
}
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ url, body, headers: opts.headers || {} });
  if (url.endsWith("/rpc/gt_ai_take")) {
    if (mode.noCounter) return new Response('{"code":"PGRST202","message":"Could not find the function public.gt_ai_take"}', { status: 404 });
    return opts.headers.apikey === "sb_secret_abc" ? Response.json(quota) : new Response("clé refusée", { status: 401 });
  }
  if (url.endsWith("/rpc/gt_user")) return new Response(body.p_token === "t" ? '"alex"' : "null");
  const model = url.split("/models/")[1]?.split(":")[0];
  if (url.includes("/models?")) return Response.json({ models: [{ name: "models/gemini-flash-latest", supportedGenerationMethods: ["generateContent"] }, { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] }] });
  if (mode.badKey) return new Response('{"error":{"code":400,"message":"API key not valid. Please pass a valid API key."}}', { status: 400 });
  if (mode.all429 || (mode.flash429 && model === "gemini-flash-latest") || (mode.search429 && body.tools) || (mode.gemmaOnly && !model.startsWith("gemma"))) return new Response("quota", { status: 429 });
  if (!url.includes("streamGenerateContent")) return Response.json({ candidates: [{ content: { parts: [{ text: "OK" }] } }], modelVersion: model });
  if (mode.emptyFlash && model === "gemini-flash-latest") return stream([{ candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] }]);
  return stream(CHUNKS, mode.cut ? 260 : 0);
};
console.error = () => {}; // journaux de la fonction
await import(new URL("../supabase/functions/coach/index.ts", import.meta.url));

const ask = async (payload, headers = {}) => {
  calls.length = 0;
  const res = await handler(new Request("https://fn.test/coach", { method: "POST", headers, body: typeof payload === "string" ? payload : JSON.stringify(payload) }));
  const txt = await res.text();
  return { res, ev: txt.split("\n\n").filter(l => l.startsWith("data:")).map(l => JSON.parse(l.slice(5))) };
};
const tried = () => calls.filter(c => c.url.includes("generativelanguage")).map(c => c.url.split("/models/")[1].split(":")[0] + (c.body?.tools ? "+recherche" : ""));
const text = ev => ev.map(e => e.t || "").join("");
const Q = { token: "t", system: "Tu es Kitty.", messages: [{ role: "assistant", content: "Salut" }, { role: "user", content: "Combien de protéines ?" }] };
const reset = () => { mode = {}; quota = { ok: true, user: "alex", remaining: 41 }; };

test("réponse en flux, sans les pensées, avec les sources et le quota restant", async () => {
  reset();
  const { res, ev } = await ask(Q);
  assert.match(res.headers.get("content-type"), /text\/event-stream/);
  assert.equal(text(ev), "Bonjour Alex !");
  assert.deepEqual(ev.at(-1), { done: true, model: "gemini-flash-latest", version: "gemini-x-flash", cut: false, remaining: 41, blocked: false, sources: [{ url: "https://ex.fr/a", title: "Source A" }] });
  const g = calls.find(c => c.url.includes("generativelanguage"));
  assert.equal(g.headers["x-goog-api-key"], "AQ.cle-de-test");
  assert.deepEqual(g.body.contents.map(c => c.role), ["user"]); // la conversation commence par l'utilisateur
  assert.ok(g.body.systemInstruction.parts[0].text.startsWith("Tu es le coach sportif de l'app GREATNESS"));
  assert.ok(g.body.systemInstruction.parts[0].text.endsWith("Tu es Kitty."));
  assert.deepEqual(g.body.tools, [{ google_search: {} }]);
  const take = calls.find(c => c.url.endsWith("/rpc/gt_ai_take"));
  assert.equal(take.headers.apikey, "sb_secret_abc"); // nouvelle clé secrète, sans en-tête Authorization
  assert.equal(take.headers.Authorization, undefined);
});

test("secours : sans recherche, puis Flash-Lite, puis Gemma (consignes dans le premier message)", async () => {
  reset(); mode = { search429: true };
  assert.equal((await ask(Q)).ev.at(-1).model, "gemini-flash-latest");
  assert.deepEqual(tried(), ["gemini-flash-latest+recherche", "gemini-flash-latest"]);
  mode = { flash429: true };
  assert.equal((await ask(Q)).ev.at(-1).model, "gemini-flash-lite-latest");
  assert.deepEqual(tried(), ["gemini-flash-latest+recherche", "gemini-flash-latest", "gemini-flash-lite-latest+recherche"]);
  mode = { gemmaOnly: true };
  assert.equal((await ask(Q)).ev.at(-1).model, "gemma-3-27b-it");
  const gm = calls.find(c => c.url.includes("gemma"));
  assert.equal(gm.body.systemInstruction, undefined);
  assert.equal(gm.body.tools, undefined);
  assert.match(gm.body.contents[0].parts[0].text, /^Tu es le coach sportif[\s\S]*Tu es Kitty\.[\s\S]*Combien de protéines \?$/);
});

test("réponse vide ou bloquée : on passe au modèle suivant", async () => {
  reset(); mode = { emptyFlash: true };
  const { ev } = await ask(Q);
  assert.equal(text(ev), "Bonjour Alex !");
  assert.equal(ev.at(-1).model, "gemini-flash-lite-latest");
});

test("connexion coupée en cours de réponse : le début est gardé", async () => {
  reset(); mode = { cut: true };
  const { ev } = await ask(Q);
  assert.equal(text(ev), "Bonjour ");
  assert.equal(ev.at(-1).done, true);
  assert.equal(ev.at(-1).cut, true);
});

test("pannes : la cause précise est renvoyée à l'app", async () => {
  reset(); mode = { all429: true };
  let { ev } = await ask(Q);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].error, "DOWN");
  assert.match(ev[0].detail, /gemma-3-27b-it : HTTP 429/);
  mode = { badKey: true };
  ({ ev } = await ask(Q));
  assert.match(ev[0].detail, /API key not valid/);
  assert.equal(tried().length, 3); // un seul essai par modèle
});

test("compte : limite, jeton refusé, requêtes invalides", async () => {
  reset(); quota = { error: "LIMIT" };
  assert.equal((await ask(Q)).ev[0].error, "LIMIT");
  quota = { error: "BAD_TOKEN" };
  assert.equal((await ask(Q)).ev[0].error, "BAD_TOKEN");
  reset();
  for (const bad of [{ token: "t", messages: [] }, "pas du json", { token: "t", messages: "x" }, { messages: Q.messages }, { token: "t", messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] }])
    assert.equal((await ask(bad)).ev[0].error, "BAD_REQUEST");
});

test("004_ai.sql pas encore lancé : le jeton est quand même vérifié", async () => {
  reset(); mode = { noCounter: true };
  const { ev } = await ask(Q);
  assert.equal(ev.at(-1).done, true);
  assert.equal(ev.at(-1).remaining, null);
  assert.match(ev.at(-1).note, /004_ai\.sql/);
  assert.equal((await ask({ ...Q, token: "faux" })).ev[0].error, "BAD_TOKEN");
});

test("GET, CORS et diagnostic (sans aucun secret dans le rapport)", async () => {
  reset();
  const get = await handler(new Request("https://fn.test/coach"));
  assert.match(await get.text(), /^GREATNESS : fonction coach en ligne \(coach-\d+\)\. Clé Gemini : présente\.$/);
  const opt = await handler(new Request("https://fn.test/coach", { method: "OPTIONS" }));
  assert.equal(opt.headers.get("access-control-allow-origin"), "*");
  assert.match(opt.headers.get("access-control-allow-headers"), /apikey/);
  assert.equal((await ask({}, { "x-diag-token": "mauvais" })).ev[0].error, "BAD_REQUEST");
  const res = await handler(new Request("https://fn.test/coach", { method: "POST", headers: { "x-diag-token": "d".repeat(24) }, body: "{}" }));
  const d = await res.json();
  assert.equal(d.ok, true);
  assert.deepEqual(d.models_available, ["gemini-flash-latest"]);
  assert.equal(d.tests.length, 3);
  assert.equal(d.server_key.format, "sb_secret");
  assert.equal(d.stream.model, "gemini-flash-latest");
  assert.equal(d.stream.sources, 1);
  const raw = JSON.stringify(d);
  for (const secret of [env.GEMINI_API_KEY, "sb_secret_abc", "eyJancienne", env.DIAG_TOKEN]) assert.ok(!raw.includes(secret), "secret dans le diagnostic");
});
