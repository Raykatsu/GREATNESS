// Fonction Supabase « coach » (supabase/functions/coach/index.ts) avec Deno, Supabase et Gemini simulés.
import test from "node:test";
import assert from "node:assert/strict";

let handler;
const env = { GEMINI_API_KEY: "AQ.cle-de-test", SUPABASE_URL: "https://sb.test", SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_abc" }), SUPABASE_SERVICE_ROLE_KEY: "eyJancienne", DIAG_TOKEN: "d".repeat(24), GEMINI_PRIMARY_MS: "300", GEMINI_FIRST_MS: "300", GEMINI_STALL_MS: "300" };
globalThis.Deno = { env: { get: k => env[k] }, serve: h => { handler = h; } };

const calls = [], marks = [];
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
  // état des modèles partagé entre les instances (009_ai_models.sql)
  if (url.endsWith("/rpc/gt_ai_models_get")) return mode.shared ? Response.json(mode.shared) : new Response('{"code":"PGRST202"}', { status: 404 });
  if (url.endsWith("/rpc/gt_ai_models_mark")) { marks.push(body); return Response.json({ ok: true }); }
  const model = url.split("/models/")[1]?.split(":")[0];
  if (url.includes("/models?")) return Response.json({ models: [{ name: "models/gemini-flash-latest", supportedGenerationMethods: ["generateContent"] }, { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] }] });
  if (!VERSIONS[model]) return fail(404, `models/${model} is not found`);
  if (mode.badKey) return fail(400, "API key not valid. Please pass a valid API key.");
  if (body.generationConfig?.thinkingConfig && (mode.noThinking || []).includes(model)) return fail(400, "Thinking level is not supported for this model.");
  if (body.tools && (mode.noSearch || []).includes(model)) return fail(429, "Resource has been exhausted (e.g. check quota).");
  if (mode.all429 || (mode.flash429 && model === "gemini-flash-latest") || (mode.gemmaOnly && !model.startsWith("gemma"))) return fail(429, "quota");
  if (model === (mode.overloadModel || "gemini-flash-latest") && (mode.overload || (mode.overloadOnce && !mode.overloaded))) { mode.overloaded = true; return fail(503, "This model is currently experiencing high demand."); }
  if (body.generationConfig?.responseMimeType === "application/json") { // analyse d'un repas
    if (mode.foodBroken === model) return Response.json({ candidates: [{ content: { parts: [{ text: "pas du json" }] } }] });
    if (body.generationConfig.responseSchema?.properties?.days) { // plan de repas
      if (mode.emptyPlan) return Response.json({ candidates: [{ content: { parts: [{ text: '{"days":[],"shopping":[]}' }] } }] });
      const meal = (m, n) => ({ meal: m, name: n, items: [{ name: "Blanc de poulet", grams: 150, kcal: 248, protein: 46, carbs: 0, fat: 5 }, { name: "Riz blanc cuit", grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }] });
      const days = Array.from({ length: 9 }, () => ({ meals: [meal("breakfast", "Porridge"), meal("brunch", "x".repeat(80)), meal("dinner", "Saumon")] }));
      const shopping = [{ name: "Riz", qty: "500 g", aisle: "Épicerie" }, { name: "Poulet", qty: "600 g", aisle: "Rayon inconnu" }, { name: "", qty: "1", aisle: "Pain" }];
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ days, shopping, tips: "Prépare le riz à l'avance." }) }] } }], modelVersion: VERSIONS[model] });
    }
    if (body.generationConfig.responseSchema?.properties?.foods) { // un aliment cherché par son nom
      const foods = [{ name: "Phở au bœuf", kcal: 62, protein: 5, carbs: 7, fat: 1.5, fiber: 0.4, portion_label: "bol", portion_grams: 550, liquid: false },
        { name: "Phở au poulet", brand: "", kcal: 58, protein: 5.5, carbs: 7, fat: 1, portion_label: "bol", portion_grams: 550 },
        { name: "", kcal: 0, protein: 0, carbs: 0, fat: 0, portion_label: "", portion_grams: 0 },
        { name: "Trop", kcal: 5000, protein: 900, carbs: 2, fat: 1, sugars: 300, salt: -2, portion_label: "x".repeat(50), portion_grams: 1e6 },
        { name: "En trop", kcal: 50, protein: 1, carbs: 10, fat: 1, portion_label: "pot", portion_grams: 100 }];
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ foods, note: "Valeurs moyennes." }) }] } }], modelVersion: VERSIONS[model] });
    }
    const items = [{ name: "Blanc de poulet", grams: 200, kcal: 330, protein: 62, carbs: 0, fat: 7.2 }, { name: "Riz", grams: -5, kcal: 0, protein: 0, carbs: 0, fat: 0 }, { name: "x".repeat(90), grams: 99999, kcal: 1e9, protein: "12", carbs: 1, fat: 1 }];
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items, note: "Portion de riz estimée." }) }] } }], modelVersion: VERSIONS[model] });
  }
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

test("secours : Flash-Lite, les Flash précédents, puis Gemma (consignes dans le premier message)", async () => {
  await forget(); mode = { flash429: true };
  assert.equal((await ask(Q)).ev.at(-1).model, "gemini-flash-lite-latest");
  assert.deepEqual(tried(), ["gemini-flash-latest", "gemini-flash-lite-latest"]);
  mode = { gemmaOnly: true };
  assert.equal((await ask(Q)).ev.at(-1).model, "gemma-4-26b-a4b-it");
  assert.deepEqual(tried(), ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.7-flash", "gemini-3.6-flash", "gemma-4-26b-a4b-it"]);
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
  assert.deepEqual(tried(), ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.7-flash", "gemini-3.6-flash", "gemma-4-26b-a4b-it", "gemma-4-26b-a4b-it"]);
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
  assert.equal(tried().length, 5); // un seul essai par modèle
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

test("repas : analyse d'une description ou d'une photo, valeurs bornées", async () => {
  await forget();
  const call = async body => { calls.length = 0; const r = await handler(new Request("https://fn.test/coach", { method: "POST", body: JSON.stringify(body) })); return { r, j: await r.json() }; };
  let { r, j } = await call({ token: "t", task: "food", text: "200 g de poulet et du riz" });
  assert.match(r.headers.get("content-type"), /application\/json/);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  assert.equal(j.model, "gemini-flash-lite-latest");
  assert.equal(j.remaining, 41);
  assert.equal(j.note, "Portion de riz estimée.");
  assert.deepEqual(j.items[0], { name: "Blanc de poulet", grams: 200, kcal: 330, protein: 62, carbs: 0, fat: 7.2, fiber: 0 });
  assert.equal(j.items.length, 2); // l'élément vide est retiré
  assert.deepEqual([j.items[1].name.length, j.items[1].grams, j.items[1].kcal, j.items[1].protein], [60, 5000, 6000, 12]);
  const g = gem()[0];
  assert.equal(g.body.generationConfig.responseMimeType, "application/json");
  assert.ok(g.body.generationConfig.responseSchema.properties.items);
  assert.equal(g.body.contents[0].parts.at(-1).text, "200 g de poulet et du riz");
  ({ j } = await call({ token: "t", task: "food", image: { mime: "image/jpeg", data: "AAAA" } }));
  assert.equal(j.items.length, 2);
  assert.deepEqual(gem()[0].body.contents[0].parts[0], { inline_data: { mime_type: "image/jpeg", data: "AAAA" } });
  mode = { foodBroken: "gemini-flash-lite-latest" }; // réponse illisible : modèle suivant
  ({ j } = await call({ token: "t", task: "food", text: "une pomme" }));
  assert.equal(j.model, "gemini-flash-latest");
  mode = { all429: true };
  ({ j } = await call({ token: "t", task: "food", text: "une pomme" }));
  assert.equal(j.error, "DOWN");
  assert.match(j.detail, /HTTP 429/);
  reset();
  assert.equal((await call({ token: "t", task: "food" })).j.error, "BAD_REQUEST");
  assert.equal((await call({ token: "t", task: "food", image: { mime: "text/html", data: "x" } })).j.error, "BAD_REQUEST");
  assert.equal((await call({ task: "food", text: "pomme" })).j.error, "BAD_REQUEST");
  quota = { error: "LIMIT" };
  assert.equal((await call({ token: "t", task: "food", text: "pomme" })).j.error, "LIMIT");
});

test("aliment cherché par son nom : valeurs pour 100 g, variantes, bornes", async () => {
  await forget();
  const call = async body => { calls.length = 0; const r = await handler(new Request("https://fn.test/coach", { method: "POST", body: JSON.stringify(body) })); return await r.json(); };
  const j = await call({ token: "t", task: "food", mode: "info", text: "pho", image: { mime: "image/jpeg", data: "AAAA" } });
  assert.equal(j.foods.length, 3); // 4 variantes au plus, l'élément vide retiré
  assert.deepEqual(j.foods[0], { name: "Phở au bœuf", brand: "", kcal: 62, protein: 5, carbs: 7, fat: 1.5, fiber: 0.4, sugars: 0, salt: 0, portion_label: "bol", portion_grams: 550, liquid: false });
  assert.deepEqual([j.foods[2].kcal, j.foods[2].protein, j.foods[2].sugars, j.foods[2].salt, j.foods[2].portion_label.length, j.foods[2].portion_grams], [900, 100, 100, 0, 30, 2000]);
  assert.equal(j.note, "Valeurs moyennes.");
  const g = gem()[0];
  assert.ok(g.body.generationConfig.responseSchema.properties.foods);
  assert.match(g.body.systemInstruction.parts[0].text, /POUR 100 g/);
  assert.equal(g.body.contents[0].parts.length, 1); // pas de photo pour une recherche
  assert.equal(g.body.contents[0].parts[0].text, "pho");
  await call({ token: "t", task: "food", mode: "info", text: "x".repeat(500) });
  assert.equal(gem()[0].body.contents[0].parts[0].text.length, 120);
  assert.equal((await call({ token: "t", task: "food", mode: "info", text: "" })).error, "BAD_REQUEST");
});

test("plan de repas : jours bornés, repas nettoyés, liste de courses par rayon", async () => {
  await forget();
  const call = async body => { calls.length = 0; const r = await handler(new Request("https://fn.test/coach", { method: "POST", body: JSON.stringify(body) })); return await r.json(); };
  const j = await call({ token: "t", task: "mealplan", days: 3, kcal: 2400, protein: 160, diet: ["Végétarien", "x".repeat(90)], prefs: "Pas de champignons" });
  assert.equal(j.days.length, 3); // jamais plus que demandé
  assert.equal(j.days[0].meals.length, 3);
  assert.deepEqual(j.days[0].meals[0], { meal: "breakfast", name: "Porridge", items: [{ name: "Blanc de poulet", grams: 150, kcal: 248, protein: 46, carbs: 0, fat: 5 }] }); // aliment vide retiré
  assert.equal(j.days[0].meals[1].meal, "snack"); assert.equal(j.days[0].meals[1].name.length, 60);
  assert.deepEqual(j.shopping, [{ name: "Riz", qty: "500 g", aisle: "Épicerie" }, { name: "Poulet", qty: "600 g", aisle: "Épicerie" }]);
  assert.equal(j.tips, "Prépare le riz à l'avance.");
  const ask = gem()[0].body.contents[0].parts[0].text;
  assert.match(ask, /Plan de 3 jour\(s\)\. Chaque jour : environ 2400 kcal et au moins 160 g de protéines\. Régime : Végétarien, x{40}\. Goûts et contraintes : Pas de champignons\./);
  assert.ok(gem()[0].body.generationConfig.responseSchema.properties.shopping);
  await call({ token: "t", task: "mealplan", days: 99, kcal: 99999, protein: -5 });
  assert.match(gem()[0].body.contents[0].parts[0].text, /Plan de 7 jour\(s\)\. Chaque jour : environ 5000 kcal et au moins 40 g/);
  mode = { emptyPlan: true };
  assert.equal((await call({ token: "t", task: "mealplan", days: 2 })).error, "DOWN"); // plan vide partout : erreur
  reset();
  assert.equal((await call({ task: "mealplan", days: 2 })).error, "BAD_REQUEST");
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
  assert.equal(step("repas (IA)").answered, true);
  assert.equal(step("repas (IA)").items, 2);
  assert.equal(lines.filter(l => /^essai /.test(l.step)).length, 8);
  assert.ok(step("essai gemini-flash-latest (réflexion par défaut)"));
  assert.equal(step("essai gemini-3.6-flash").status, 200);
  for (const secret of [env.GEMINI_API_KEY, "sb_secret_abc", "eyJancienne", env.DIAG_TOKEN]) assert.ok(!raw.includes(secret), "secret dans le diagnostic");
});

test("état des modèles partagé : un modèle saturé ailleurs est évité tout de suite, puis réhabilité", async () => {
  await forget(); marks.length = 0;
  mode = { shared: { "gemini-flash-latest": { slow: Date.now() + 60e3 } } };
  const r1 = await ask(Q);
  assert.deepEqual(tried(), ["gemini-flash-lite-latest"]); // pas 7 s perdues sur le modèle saturé
  assert.equal(r1.ev.at(-1).model, "gemini-flash-lite-latest");
  // une surcharge vue ici est partagée
  await forget(); marks.length = 0; mode = { overload: true };
  await ask(Q);
  assert.deepEqual(marks.map(m => [m.p_model, m.p_kind]), [["gemini-flash-latest", "slow"]]);
  // quota de recherche épuisé : partagé aussi
  await forget(); marks.length = 0; mode = { noSearch: ["gemini-flash-latest", "gemini-flash-lite-latest"] };
  await ask(WEBQ);
  assert.deepEqual(marks.filter(m => m.p_kind === "search").map(m => m.p_model), ["gemini-flash-latest", "gemini-flash-lite-latest"]);
  // le modèle signalé répond de nouveau (la période est finie ailleurs) : il est réhabilité pour tous
  await forget(); marks.length = 0;
  mode = { shared: { "gemma-4-26b-a4b-it": { slow: Date.now() + 60e3 } }, gemmaOnly: true };
  assert.equal((await ask(Q)).ev.at(-1).model, "gemma-4-26b-a4b-it"); // essayé en dernier, il répond
  assert.ok(marks.some(m => m.p_model === "gemma-4-26b-a4b-it" && m.p_kind === "ok"));
  // base lente ou table absente : rien ne casse
  await forget(); mode = {};
  assert.equal((await ask(Q)).ev.at(-1).model, "gemini-flash-latest");
});
