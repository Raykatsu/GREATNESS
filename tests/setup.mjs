// Environnement minimal pour charger les modules de l'app dans Node.
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
};
globalThis.addEventListener ||= () => {};
globalThis.document ||= { addEventListener() {}, hidden: false };
