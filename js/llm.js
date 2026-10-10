// IA locale : un vrai modèle de langage (Qwen) qui tourne dans le navigateur grâce à WebGPU.
// Gratuit, privé (rien ne quitte le téléphone), téléchargé une seule fois puis gardé en cache.
const WEBLLM = "https://esm.run/@mlc-ai/web-llm@0.2.85";
const PREF = "greatness.llm";

export const MODELS = [
  { id: "Qwen3.5-0.8B", name: "Léger", size: "≈ 0,6 Go", note: "Rapide, pour les téléphones modestes" },
  { id: "Qwen3.5-2B", name: "Équilibré", size: "≈ 1,4 Go", note: "Le meilleur choix sur un téléphone récent" },
  { id: "Qwen3.5-4B", name: "Puissant", size: "≈ 2,6 Go", note: "Le plus intelligent, pour ordinateur ou téléphone haut de gamme" },
];

let engine = null, loading = null, status = "off", progress = 0, progressText = "", lastError = "", listeners = [];
const emit = () => listeners.forEach(fn => fn(info()));
export const onChange = fn => { listeners.push(fn); return () => (listeners = listeners.filter(f => f !== fn)); };
export const info = () => ({ status, progress, progressText, error: lastError, model: prefs().model, ready: status === "ready" });

export function prefs() {
  try { return { model: "Qwen3.5-2B", enabled: false, ...JSON.parse(localStorage.getItem(PREF) || "{}") }; } catch { return { model: "Qwen3.5-2B", enabled: false }; }
}
function setPrefs(p) { localStorage.setItem(PREF, JSON.stringify({ ...prefs(), ...p })); }

export const supported = () => typeof navigator !== "undefined" && !!navigator.gpu;

// Variante f16 si le GPU la gère (plus légère), sinon f32.
async function modelId(base) {
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("no adapter");
    return `${base}-${adapter.features.has("shader-f16") ? "q4f16_1" : "q4f32_1"}-MLC`;
  } catch {
    return `${base}-q4f32_1-MLC`;
  }
}

export async function enable(base = prefs().model) {
  setPrefs({ model: base, enabled: true });
  return load();
}

export function load() {
  if (!supported()) { status = "unsupported"; emit(); return Promise.resolve(false); }
  if (engine) return Promise.resolve(true);
  if (loading) return loading;
  status = "loading"; progress = 0; progressText = "Préparation…"; lastError = ""; emit();
  loading = (async () => {
    try {
      navigator.storage?.persist?.().catch(() => {});
      const webllm = await import(WEBLLM);
      const id = await modelId(prefs().model);
      const worker = new Worker(new URL("./llm-worker.js", import.meta.url), { type: "module" });
      engine = await webllm.CreateWebWorkerMLCEngine(worker, id, {
        initProgressCallback: r => {
          progress = r.progress || 0;
          progressText = /fetch|download|Loading model from cache/i.test(r.text) ? (/cache/i.test(r.text) ? "Chargement depuis le téléphone…" : "Téléchargement…") : "Préparation…";
          emit();
        },
      });
      status = "ready"; progress = 1; emit();
      return true;
    } catch (e) {
      console.warn("llm", e);
      engine = null;
      status = "error";
      lastError = /memory|OOM|out of/i.test(String(e)) ? "Pas assez de mémoire : essaie le modèle Léger." : "L'IA n'a pas pu démarrer sur ce navigateur.";
      emit();
      return false;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

// Démarre l'IA en arrière-plan si elle a déjà été activée sur cet appareil.
export function autoload() {
  if (prefs().enabled && supported()) setTimeout(() => load(), 1500);
}

export async function disable({ removeFiles = false } = {}) {
  setPrefs({ enabled: false });
  try { await engine?.unload(); } catch { /* déjà déchargé */ }
  engine = null; status = "off"; progress = 0; emit();
  if (removeFiles) {
    try {
      const webllm = await import(WEBLLM);
      for (const m of MODELS) for (const q of ["q4f16_1", "q4f32_1"]) await webllm.deleteModelAllInfoInCache(`${m.id}-${q}-MLC`).catch(() => {});
    } catch { /* hors ligne */ }
  }
}

// Le modèle n'a pas d'avis sur le raisonnement à afficher : on retire les balises de réflexion.
const clean = s => s.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/^\s+/, "");

let busy = Promise.resolve();
export function chat(messages, { onDelta, maxTokens = 700, temperature = 0.6 } = {}) {
  // une seule génération à la fois
  const run = busy.then(async () => {
    if (!engine) throw new Error("IA locale non chargée");
    const stream = await engine.chat.completions.create({
      messages, stream: true, temperature, top_p: 0.9, max_tokens: maxTokens,
      extra_body: { enable_thinking: false },
    });
    let raw = "";
    for await (const chunk of stream) {
      raw += chunk.choices?.[0]?.delta?.content || "";
      onDelta?.(clean(raw));
    }
    return clean(raw).trim();
  });
  busy = run.catch(() => {});
  return run;
}

export const interrupt = () => engine?.interruptGenerate?.();
