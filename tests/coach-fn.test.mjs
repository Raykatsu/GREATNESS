// Fonction Supabase « coach » (supabase/functions/coach/index.ts) avec Deno, Supabase et Gemini simulés.
import test from "node:test";
import assert from "node:assert/strict";

let handler;
const env = { GEMINI_API_KEY: "AQ.cle-de-test", SUPABASE_URL: "https://sb.test", SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_abc" }), SUPABASE_SERVICE_ROLE_KEY: "eyJancienne", DIAG_TOKEN: "d".repeat(24), GEMINI_PRIMARY_MS: "300", GEMINI_FIRST_MS: "300", GEMINI_STALL_MS: "300" };
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };

const calls = [];
let mode = {}, quota = { ok: true, user: "alex", remaining: 41 };
const enc = new TextEncoder();
const chunks = (version, search) => [
  { candidates: [{ content: { parts: [{ text: "pensée cachée", thought: true }] } }] },
  { candidates: [{ content: { parts: [{ text: "Bonjour " }] } }], modelVersion: version },
  { candidates: [{ content: { parts: [{ text: "Alex !" }] }, finishReason: "STOP", ...(search ? { groundingMetadata: { groundingChunks: [{ web: { uri: "https://ex.fr/a", title: "Source A" } }] } } : {}) }] },
];
// Flux SSE de Gemini livré par morceaux, lié au signal d'annulation comme un vrai fetch.
// cutAfter : la connexion tombe après n octets ; stallAfter : plus rien n'arrive après n octets.
function stream(list, { cutAfter = 0, stallAfter = 0, signal } = {}) {
  const b = enc.encode(list.map(c => `data: ${JSON.stringify(c)}\r\n\r\n`).join(""));
  const parts = cutAfter ? [b.slice(0, 37), b.slice(37, cutAfter), "ERR"] : stallAfter ? [b.slice(0, 37), b.slice(37, stallAfter), "STALL"] : [b.slice(0, 37), b.slice(37)];
  return new Response(new ReadableStream({
    start(c) { signal?.addEventListener("abort", () => { try { c.error(new DOMException("annulé", "AbortError")); } catch {} }); },
    async pull(c) {
      await new Promise(r => setTimeout(r, 1));
      const p = parts.shift();
      if (p === "ERR") c.error(new Error("connexion perdue"));
      else if (p === "STALL") await new Promise(() => {}); // le serveur ne dit plus rien
      else if (p) c.enqueue(p); else c.close();
    },
  }));
}
// Gemini qui ne répond jamais (jusqu'à l'annulation)
const hang = signal => new Promise((_, rej) => signal?.addEventListener("abort", () => rej(new DOMException("annulé", "AbortError"))));
const VERSIONS = { "gemini-flash-latest": "gemini-3.8-flash", "gemini-flash-lite-latest": "gemini-3.5-flash-lite", "gemini-3.7-flash": "gemini-3.7-flash", "gemma-4-26b-a4b-it": "gemma-4-26b-a4b-it", "gemini-3.5-flash": "gemini-3.5-flash", "gemini-3.6-flash": "gemini-3.6-flash" };
const fail = (status, message) => Response.json({ error: { code: status, message } }, { status });

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
  if (!VERSIONS[model]) return fail(404, `models/${model} is not found`);
  if (mode.badKey) return fail(400, "API key not valid. Please pass a valid API key.");
  if (body.generationConfig?.thinkingConfig && (mode.noThinking || []).includes(model)) return fail(400, "Thinking level is not supported for this model.");
  if (body.tools && (mode.noSearch || []).includes(model)) return fail(429, "Resource has been exhausted (e.g. check quota).");
  if (mode.all429 || (mode.flash429 && model === "gemini-flash-latest") || (mode.gemmaOnly && !model.startsWith("gemma"))) return fail(429, "quota");
  if (model === (mode.overloadModel || "gemini-flash-latest") && (mode.overload || (mode.overloadOnce && !mode.overloaded))) { mode.overloaded = true; return fail(503, "This model is currently experiencing high demand."); }
  if (!url.includes("streamGenerateContent")) return Response.json({ candidates: [{ content: { parts: [{ text: "OK" }] } }], modelVersion: VERSIONS[model] });
  if (mode.hangFlash && model === "gemini-flash-latest") return hang(opts.signal);
  if (mode.emptyFlash && model === "gemini-flash-latest") return stream([{ candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] }], { signal: opts.signal });
  return stream(chunks(VERSIONS[model], !!body.tools), { cutAfter: mode.cut ? 260 : 0, stallAfter: mode.stall ? 260 : 0, signal: opts.signal });
};
console.error = () => {}; // journaux de la fonction
await import(new URL("../supabase/functions/coach/index.ts", import.meta.url));

const ask = async (payload, headers = {}) => {
  calls.length = 0;
  const res = await handler(new Request("https://fn.test/coach", { method: "POST", headers, body: typeof payload === "string" ? payload : JSON.stringify(payload) }));
  const txt = await res.text();
  return { res, ev: txt.split("\n\n").filter(l => l.startsWith("data:")).map(l => JSON.parse(l.slice(5))) };
};
const diagnose = async () => (await handler(new Request("https://fn.test/coach", { method: "POST", headers: { "x-diag-token": "d".repeat(24) }, body: "{}" }))).text();
const gem = () => calls.filter(c => c.url.includes("generativelanguage"));
const tried = () => gem().map(c => c.url.split("/models/")[1].split(":")[0] + (c.body?.tools ? "+recherche" : ""));
const text = ev => ev.map(e => e.t || "").join("");
const question = q => ({ token: "t", system: "Tu es Kitty.", messages: [{ role: "assistant", content: "Salut" }, { role: "user", content: q }] });
const Q = question("Combien de protéines par jour pour prendre du muscle ?");
const WEBQ = question("Quelles sont les dernières études sur la créatine ?");
const reset = () => { mode = {}; quota = { ok: true, user: "alex", remaining: 41 }; };
// La fonction retient les modèles lents et les refus ; le diagnostic remet cette mémoire à zéro.
const forget = async () => { reset(); await diagnose(); };

test("question d'entraînement : meilleur modèle, réflexion courte, sans recherche", async () => {
  await forget();
  const { res, ev } = await ask(Q);
  assert.match(res.headers.get("content-type"), /text\/event-stream/);
  assert.equal(text(ev), "Bonjour Alex !"); // sans les pensées
  assert.deepEqual(ev.at(-1), { done: true, model: "gemini-flash-latest", version: "gemini-3.8-flash", cut: false, remaining: 41, blocked: false, sources: [] });
  assert.deepEqual(tried(), ["gemini-flash-latest"]);
  const g = gem()[0];
  assert.equal(g.headers["x-goog-api-key"], "AQ.cle-de-test");
  assert.deepEqual(g.body.generationConfig.thinkingConfig, { thinkingLevel: "low" });
  assert.equal(g.body.tools, undefined);
  assert.deepEqual(g.body.contents.map(c => c.role), ["user"]); // la conversation commence par l'utilisateur
  assert.ok(g.body.systemInstruction.parts[0].text.startsWith("Tu es le coach sportif de l'app GREATNESS"));
  assert.ok(g.body.systemInstruction.parts[0].text.endsWith("Tu es Kitty."));
  const take = calls.find(c => c.url.endsWith("/rpc/gt_ai_take"));
  assert.equal(take.headers.apikey, "sb_secret_abc"); // nouvelle clé secrète, sans en-tête Authorization
  assert.equal(take.headers.Authorization, undefined);
});

test("question d'actualité : recherche Google et sources", async () => {
  await forget();
  const { ev } = await ask(WEBQ);
  assert.deepEqual(tried(), ["gemini-flash-latest+recherche"]);
  assert.deepEqual(gem()[0].body.generationConfig.thinkingConfig, { thinkingLevel: "low" });
  assert.deepEqual(ev.at(-1).sources, [{ url: "https://ex.fr/a", title: "Source A" }]);
  for (const q of ["Quel est le prix d'une barre olympique ?", "Une vidéo YouTube pour le soulevé de terre ?", "Les résultats des championnats de France 2026 ?"]) {
    await ask(question(q));
    assert.ok(gem()[0].body.tools, q);
  }
  for (const q of ["Fais-moi un programme pour cette semaine", "Je suis fatigué aujourd'hui, je m'entraîne ?", "Comment progresser au squat ?"]) {
    await ask(question(q));
    assert.equal(gem()[0].body.tools, undefined, q);
  }
  await ask({ ...WEBQ, search: false }); // l'app peut demander de ne pas chercher (débrief)
  assert.equal(gem()[0].body.tools, undefined);
});

test("secours : Flash-Lite, le Flash précédent, puis Gemma (consignes dans le premier message)", async () => {
  await forget(); mode = { flash429: true };
  assert.equal((await ask(Q)).ev.at(-1).model, "gemini-flash-lite-latest");
  assert.deepEqual(tried(), ["gemini-flash-latest", "gemini-flash-lite-latest"]);
  mode = { gemmaOnly: true };
  assert.equal((await ask(Q)).ev.at(-1).model, "gemma-4-26b-a4b-it");
  assert.deepEqual(tried(), ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.7-flash", "gemma-4-26b-a4b-it"]);
  const gm = gem().at(-1);
  assert.equal(gm.body.systemInstruction, undefined);
  assert.equal(gm.body.tools, undefined);
  assert.equal(gm.body.generationConfig.thinkingConfig, undefined);
  assert.match(gm.body.contents[0].parts[0].text, /^Tu es le coach sportif[\s\S]*Tu es Kitty\.[\s\S]*Combien de protéines par jour pour prendre du muscle \?$/);
});

test("réponse vide ou bloquée : on passe au modèle suivant", async () => {
  await forget(); mode = { emptyFlash: true };
  const { ev } = await ask(Q);
  assert.equal(text(ev), "Bonjour Alex !");
  assert.equal(ev.at(-1).model, "gemini-flash-lite-latest");
  assert.equal(ev.at(-1).blocked, true);
});

test("connexion coupée en cours de réponse : le début est gardé", async () => {
  await forget(); mode = { cut: true };
  const { ev } = await ask(Q);
  assert.equal(text(ev), "Bonjour ");
  assert.equal(ev.at(-1).done, true);
  assert.equal(ev.at(-1).cut, true);
});

test("réponse qui s'arrête en route : le début est gardé", async () => {
  await forget(); mode = { stall: true };
  const { ev } = await ask(Q);
  assert.equal(text(ev), "Bonjour ");
  assert.equal(ev.at(-1).cut, true);
});

test("Gemini muet : le meilleur modèle a un délai court, puis Flash-Lite ; il est ensuite mis de côté", async () => {
  await forget(); mode = { hangFlash: true };
  let { ev } = await ask(Q);
  assert.equal(text(ev), "Bonjour Alex !");
  assert.equal(ev.at(-1).model, "gemini-flash-lite-latest");
  assert.deepEqual(tried(), ["gemini-flash-latest", "gemini-flash-lite-latest"]);
  ({ ev } = await ask(Q)); // message suivant : on ne réattend pas le modèle muet
  assert.deepEqual(tried(), ["gemini-flash-lite-latest"]);
});

test("surcharge (503) : modèle suivant tout de suite, nouvel essai seulement pour le dernier", async () => {
  await forget(); mode = { overloadOnce: true };
  let { ev } = await ask(Q);
  assert.equal(ev.at(-1).model, "gemini-flash-lite-latest");
  assert.deepEqual(tried(), ["gemini-flash-latest", "gemini-flash-lite-latest"]);
  ({ ev } = await ask(Q)); // le modèle surchargé passe en dernier pendant 10 min
  assert.deepEqual(tried(), ["gemini-flash-lite-latest"]);
  await forget(); mode = { gemmaOnly: true, overloadOnce: true, overloadModel: "gemma-4-26b-a4b-it" };
  ({ ev } = await ask(Q));
  assert.equal(ev.at(-1).model, "gemma-4-26b-a4b-it");
  assert.deepEqual(tried(), ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.7-flash", "gemma-4-26b-a4b-it", "gemma-4-26b-a4b-it"]);
});

test("pannes : la cause précise est renvoyée à l'app", async () => {
  await forget(); mode = { all429: true };
  let { ev } = await ask(Q);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].error, "DOWN");
  assert.match(ev[0].detail, /gemma-4-26b-a4b-it : HTTP 429 quota/);
  mode = { badKey: true };
  ({ ev } = await ask(Q));
  assert.match(ev[0].detail, /API key not valid/);
  assert.equal(tried().length, 4); // un seul essai par modèle
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
  await forget(); mode = { noCounter: true };
  const { ev } = await ask(Q);
  assert.equal(ev.at(-1).done, true);
  assert.equal(ev.at(-1).remaining, null);
  assert.match(ev.at(-1).note, /004_ai\.sql/);
  assert.equal((await ask({ ...Q, token: "faux" })).ev[0].error, "BAD_TOKEN");
});

test("recherche refusée par le quota : modèle suivant, et on n'insiste plus ensuite", async () => {
  await forget(); mode = { noSearch: ["gemini-flash-latest"] };
  let { ev } = await ask(WEBQ);
  assert.equal(ev.at(-1).model, "gemini-flash-lite-latest");
  assert.deepEqual(tried(), ["gemini-flash-latest+recherche", "gemini-flash-lite-latest+recherche"]);
  ({ ev } = await ask(WEBQ));
  assert.deepEqual(tried(), ["gemini-flash-lite-latest+recherche"]);
  mode = { noSearch: ["gemini-flash-lite-latest", "gemini-flash-latest"] };
  ({ ev } = await ask(WEBQ)); // plus aucune recherche possible : réponse sans recherche, par le meilleur modèle
  assert.equal(text(ev), "Bonjour Alex !");
  assert.equal(ev.at(-1).model, "gemini-flash-latest");
  assert.deepEqual(tried(), ["gemini-flash-lite-latest+recherche", "gemini-flash-latest"]);
});

test("modèle qui refuse le réglage de réflexion : réessayé sans, et retenu", async () => {
  await forget(); mode = { noThinking: ["gemini-flash-latest"] };
  let { ev } = await ask(Q);
  assert.equal(ev.at(-1).model, "gemini-flash-latest");
  assert.equal(gem().length, 2);
  assert.ok(gem()[0].body.generationConfig.thinkingConfig);
  assert.equal(gem()[1].body.generationConfig.thinkingConfig, undefined);
  ({ ev } = await ask(Q));
  assert.equal(gem().length, 1);
  assert.equal(gem()[0].body.generationConfig.thinkingConfig, undefined);
});

test("GET, CORS et diagnostic (sans aucun secret dans le rapport)", async () => {
  reset();
  const get = await handler(new Request("https://fn.test/coach"));
  assert.match(await get.text(), /^GREATNESS : fonction coach en ligne \(coach-\d+\)\. Clé Gemini : présente\.$/);
  const opt = await handler(new Request("https://fn.test/coach", { method: "OPTIONS" }));
  assert.equal(opt.headers.get("access-control-allow-origin"), "*");
  assert.match(opt.headers.get("access-control-allow-headers"), /apikey/);
  assert.equal((await ask({}, { "x-diag-token": "mauvais" })).ev[0].error, "BAD_REQUEST");
  mode = { hangFlash: true, noSearch: ["gemini-flash-latest"] }; // mémoire salie avant le diagnostic…
  await ask(Q); await ask(WEBQ);
  mode = {};
  const raw = await diagnose(); // …qu'il oublie : il reteste tout depuis zéro
  const lines = raw.split("\n").filter(l => l.trim()).map(l => JSON.parse(l)); // une ligne JSON par étape
  const step = name => lines.find(l => l.step === name);
  assert.equal(lines.at(-1).ok, true);
  assert.equal(step("configuration").server_key.format, "sb_secret");
  assert.equal(step("configuration").thinking, "low");
  assert.match(step("compteur").result, /HTTP 200/);
  assert.deepEqual(step("modèles disponibles").models, ["gemini-flash-latest"]);
  const coach = step("chat (entraînement)");
  assert.equal(coach.answered, true);
  assert.equal(coach.model, "gemini-flash-latest");
  assert.match(coach.tries[0], /^Gemini gemini-flash-latest → 14 caractères/);
  const web = step("chat (actualité, recherche Google)");
  assert.equal(web.answered, true);
  assert.equal(web.sources, 1);
  assert.equal(lines.filter(l => /^essai /.test(l.step)).length, 7);
  assert.ok(step("essai gemini-flash-latest (réflexion par défaut)"));
  assert.equal(step("essai gemini-3.6-flash").status, 200);
  for (const secret of [env.GEMINI_API_KEY, "sb_secret_abc", "eyJancienne", env.DIAG_TOKEN]) assert.ok(!raw.includes(secret), "secret dans le diagnostic");
});
