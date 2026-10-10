// Spider-Man, le coach animé : il se balade sur l'écran (marche sur les bords,
// se balance au bout de sa toile, pend la tête en bas pendant les repos, fait des
// saltos sur les records) et parle via des bulles.
import { state } from "./store.js";

const W = 52, H = 70;                 // taille affichée du personnage
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const ease = {
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  out: t => 1 - (1 - t) ** 3,
  back: t => { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const SVG = `
<svg class="sp" viewBox="0 0 60 80" aria-hidden="true">
  <defs>
    <linearGradient id="spRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff3b4e"/><stop offset="1" stop-color="#c3001a"/></linearGradient>
    <linearGradient id="spBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3466ff"/><stop offset="1" stop-color="#1a3bb0"/></linearGradient>
    <pattern id="spWeb" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0H4M0 0V4" stroke="#5a0010" stroke-width=".35" opacity=".55"/></pattern>
  </defs>
  <g class="sp-body">
    <g class="sp-legL"><path d="M26 48 L24 61" stroke="#2549d6" stroke-width="7" stroke-linecap="round"/><path d="M24 61 L24 73" stroke="#dc1428" stroke-width="6.4" stroke-linecap="round"/><ellipse cx="23" cy="75.5" rx="4.2" ry="2.6" fill="#a8001a"/></g>
    <g class="sp-legR"><path d="M34 48 L36 61" stroke="#2549d6" stroke-width="7" stroke-linecap="round"/><path d="M36 61 L36 73" stroke="#dc1428" stroke-width="6.4" stroke-linecap="round"/><ellipse cx="37" cy="75.5" rx="4.2" ry="2.6" fill="#a8001a"/></g>
    <g class="sp-armL"><path d="M20 30 L16 39.5" stroke="#2549d6" stroke-width="5.6" stroke-linecap="round"/><path d="M16 39.5 L14.5 48" stroke="#dc1428" stroke-width="5" stroke-linecap="round"/><circle cx="14.3" cy="49.5" r="3" fill="#d10a22"/></g>
    <g class="sp-torso">
      <path d="M18.5 28 Q30 23.5 41.5 28 L39.5 48.5 Q30 51.5 20.5 48.5 Z" fill="url(#spRed)"/>
      <path d="M18.5 28 Q30 23.5 41.5 28 L39.5 48.5 Q30 51.5 20.5 48.5 Z" fill="url(#spWeb)"/>
      <path d="M18.6 29 L20.6 48 L23.4 48.8 L22.4 31Z M41.4 29 L39.4 48 L36.6 48.8 L37.6 31Z" fill="url(#spBlue)"/>
      <path d="M21 46.5 Q30 49.5 39 46.5" stroke="#7a0012" stroke-width="1" fill="none"/>
      <g class="sp-emblem" fill="#0b0b12"><ellipse cx="30" cy="34.5" rx="1.6" ry="2.4"/><circle cx="30" cy="31.4" r="1.1"/>
        <path d="M29 33 L24.5 29.5 M31 33 L35.5 29.5 M29 34.5 L24 34 M31 34.5 L36 34 M29 36 L25 39.5 M31 36 L35 39.5" stroke="#0b0b12" stroke-width=".6"/></g>
    </g>
    <g class="sp-armR"><path d="M40 30 L44 39.5" stroke="#2549d6" stroke-width="5.6" stroke-linecap="round"/><path d="M44 39.5 L45.5 48" stroke="#dc1428" stroke-width="5" stroke-linecap="round"/><circle cx="45.7" cy="49.5" r="3" fill="#d10a22"/></g>
    <g class="sp-head">
      <ellipse cx="30" cy="14.5" rx="11.2" ry="12.6" fill="url(#spRed)"/>
      <g stroke="#6b0012" stroke-width=".45" fill="none" opacity=".75">
        <path d="M30 2 V27"/><path d="M30 13 L19.5 8 M30 13 L40.5 8 M30 15 L19 16 M30 15 L41 16 M30 17 L21.5 23.5 M30 17 L38.5 23.5"/>
        <path d="M24 5.5 Q30 8.5 36 5.5 M21 11 Q30 15 39 11 M20.5 19 Q30 23 39.5 19 M24 25 Q30 27 36 25"/>
      </g>
      <g class="sp-eyes">
        <path class="sp-eyeL" d="M20.3 12.6 Q24.5 7.6 28.6 13.6 Q26.2 18.6 21.4 17.2 Z" fill="#fff" stroke="#0b0b12" stroke-width="1.5" stroke-linejoin="round"/>
        <path class="sp-eyeR" d="M39.7 12.6 Q35.5 7.6 31.4 13.6 Q33.8 18.6 38.6 17.2 Z" fill="#fff" stroke="#0b0b12" stroke-width="1.5" stroke-linejoin="round"/>
      </g>
    </g>
  </g>
</svg>`;

class Spidey {
  constructor() {
    this.x = innerWidth - 40; this.y = innerHeight - 140; this.rot = 0; this.facing = -1;
    this.surface = "floor"; this.busy = false; this.hanging = false; this.ctx = "app";
    this.anchor = null; this.lineFrom = "hand"; this.enabled = false;
  }

  init() {
    if (this.el) return;
    this.el = document.createElement("div");
    this.el.className = "spidey";
    this.el.innerHTML = `<div class="spidey-rot">${SVG}</div>`;
    this.rotEl = this.el.firstElementChild;
    this.svg = this.el.querySelector("svg");
    this.web = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.web.classList.add("spidey-web");
    this.web.innerHTML = `<line/>`;
    this.line = this.web.firstChild;
    this.bubble = document.createElement("div");
    this.bubble.className = "spidey-bubble";
    document.body.append(this.web, this.el, this.bubble);

    this.bindPointer();
    addEventListener("resize", () => this.enabled && !this.busy && this.goto(this.perch(this.surface), 0));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.schedule(); });
    this.bubble.addEventListener("click", () => { const a = this.bubbleAction; this.hideBubble(); a?.(); });
    this.setEnabled(state.profile.mascot !== false);
  }

  setEnabled(on) {
    this.enabled = on;
    this.el.style.display = this.web.style.display = on ? "" : "none";
    if (!on) { this.hideBubble(); clearTimeout(this.timer); return; }
    const p = this.perch("floor");
    Object.assign(this, { x: p.x, y: p.y - 140, rot: 0, surface: "floor" });
    this.pose("drop");
    this.render();
    this.goto(p, 700, ease.back).then(() => { this.pose("idle"); this.schedule(); });
  }

  /* ---------- Géométrie ---------- */
  bounds() {
    const tab = document.querySelector(".tabbar");
    const tabVisible = tab && getComputedStyle(tab).display !== "none" && !document.body.classList.contains("hide-tabs");
    const floor = tabVisible ? innerHeight - tab.offsetHeight + 2 : innerHeight - 6; // offsetHeight ignore l'animation de la barre
    const top = this.ctx === "live" ? 96 : 8;
    return { floor, top, left: 0, right: innerWidth };
  }

  perch(surface = pick(["floor", "floor", "wallR", "wallL", "ceiling"])) {
    const b = this.bounds();
    const midY = rnd(b.top + 140, b.floor - 140);
    switch (surface) {
      case "wallR": return { x: b.right - H / 2 - 1, y: midY, rot: -90, surface };
      case "wallL": return { x: H / 2 + 1, y: midY, rot: 90, surface };
      case "ceiling": return { x: rnd(60, innerWidth - 60), y: b.top + H / 2, rot: 180, surface };
      default: return { x: pick([innerWidth - 42, 42, rnd(60, innerWidth - 60)]), y: b.floor - H / 2, rot: 0, surface: "floor" };
    }
  }

  // Point d'attache de la toile : main levée (au-dessus de la tête) ou pieds.
  attachPoint(from = this.lineFrom) {
    const a = (this.rot * Math.PI) / 180;
    const d = from === "feet" ? H / 2 - 2 : -H / 2 + 2;
    return { x: this.x - Math.sin(a) * d, y: this.y + Math.cos(a) * d };
  }

  render() {
    this.el.style.transform = `translate(${this.x - W / 2}px, ${this.y - H / 2}px)`;
    this.rotEl.style.transform = `rotate(${this.rot}deg) scaleX(${this.facing})`;
    if (this.anchor) {
      const p = this.attachPoint();
      this.line.setAttribute("x1", this.anchor.x); this.line.setAttribute("y1", this.anchor.y);
      this.line.setAttribute("x2", p.x); this.line.setAttribute("y2", p.y);
      this.web.classList.add("on");
    } else this.web.classList.remove("on");
    if (this.bubble.classList.contains("show")) this.placeBubble();
  }

  pose(name, mood) {
    this.svg.setAttribute("class", `sp pose-${name}${mood ? " mood-" + mood : ""}`);
  }
  mood(m) {
    this.svg.classList.remove("mood-happy", "mood-alert", "mood-party");
    if (m) this.svg.classList.add("mood-" + m);
    clearTimeout(this.moodT);
    this.moodT = setTimeout(() => this.svg.classList.remove("mood-" + m), 2500);
  }

  tween(ms, fn) {
    return new Promise(res => {
      if (ms <= 0) { fn(1); this.render(); return res(); }
      const t0 = performance.now();
      const step = now => {
        const t = Math.min(1, (now - t0) / ms);
        fn(t); this.render();
        t < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
  }

  goto(p, ms = 600, e = ease.inOut) {
    const s = { x: this.x, y: this.y, rot: this.rot };
    let dr = p.rot - s.rot; if (dr > 180) dr -= 360; if (dr < -180) dr += 360;
    this.surface = p.surface || this.surface;
    return this.tween(ms, t => { const k = e(t); this.x = s.x + (p.x - s.x) * k; this.y = s.y + (p.y - s.y) * k; this.rot = s.rot + dr * k; });
  }

  /* ---------- Mouvements ---------- */
  async crawl() {
    const b = this.bounds();
    const vertical = this.surface === "wallL" || this.surface === "wallR";
    const cur = vertical ? this.y : this.x;
    const lo = vertical ? b.top + 80 : 40, hi = vertical ? b.floor - 80 : innerWidth - 40;
    const target = Math.min(hi, Math.max(lo, cur + rnd(-160, 160)));
    const dist = Math.abs(target - cur);
    if (dist < 30) return;
    // sens du regard dans le repère du corps
    const forward = target > cur ? 1 : -1;
    this.facing = this.surface === "ceiling" || this.surface === "wallR" ? -forward : forward;
    this.pose("crawl");
    await this.goto(vertical ? { x: this.x, y: target, rot: this.rot } : { x: target, y: this.y, rot: this.rot }, dist / 0.07, t => t);
    this.pose("idle");
  }

  // Lance une toile vers la destination puis s'y fait tirer.
  async zip(p) {
    const start = { x: this.x, y: this.y };
    this.facing = p.x >= this.x ? 1 : -1;
    this.anchor = { x: p.x + (p.surface === "wallR" ? H / 2 : p.surface === "wallL" ? -H / 2 : 0), y: p.surface === "ceiling" ? p.y - H / 2 : p.surface === "floor" ? Math.max(this.bounds().top, p.y - 220) : p.y };
    this.lineFrom = "hand";
    this.pose("zip");
    this.sound();
    const s = { ...start, rot: this.rot };
    const cx = (start.x + p.x) / 2, cy = Math.min(start.y, p.y) - 80;
    let dr = p.rot - s.rot; if (dr > 180) dr -= 360; if (dr < -180) dr += 360;
    await this.tween(Math.min(1100, 450 + Math.hypot(p.x - s.x, p.y - s.y)), t => {
      const k = ease.inOut(t), u = 1 - k;
      this.x = u * u * s.x + 2 * u * k * cx + k * k * p.x;
      this.y = u * u * s.y + 2 * u * k * cy + k * k * p.y;
      this.rot = s.rot + dr * ease.out(t);
    });
    this.anchor = null; this.surface = p.surface; this.rot = p.rot;
    this.pose("land"); this.render();
    await sleep(260);
    this.pose("idle");
  }

  // Grand balancement d'un côté à l'autre de l'écran.
  async swing() {
    const b = this.bounds();
    if (this.surface !== "floor") { await this.zip(this.perch("floor")); }
    const fromX = this.x, toX = fromX > innerWidth / 2 ? 46 : innerWidth - 46;
    const ax = (fromX + toX) / 2, ay = Math.max(b.top - 30, -30);
    const L = Math.hypot(this.x - ax, this.y - ay);
    const th0 = Math.atan2(this.x - ax, this.y - ay);
    this.anchor = { x: ax, y: ay }; this.lineFrom = "hand";
    this.facing = toX > fromX ? 1 : -1;
    this.pose("swing"); this.sound();
    await this.tween(1500, t => {
      const th = th0 + (-th0 - th0) * ease.sine(t);
      this.x = ax + L * Math.sin(th);
      this.y = ay + L * Math.cos(th);
      this.rot = (-th * 180) / Math.PI;
    });
    this.anchor = null;
    await this.goto({ x: toX, y: b.floor - H / 2, rot: 0, surface: "floor" }, 260, ease.out);
    this.pose("land"); await sleep(260); this.pose("idle");
  }

  async flip() {
    const y0 = this.y, r0 = this.rot;
    this.pose("flip", "party");
    await this.tween(750, t => {
      this.y = y0 - Math.sin(Math.PI * t) * 70;
      this.rot = r0 + 360 * ease.inOut(t) * (this.facing || 1);
    });
    this.rot = r0; this.pose("land"); this.render();
    await sleep(220); this.pose("idle");
  }

  async wave() { this.pose("wave", "happy"); await sleep(1300); this.pose("idle"); }
  async look() { this.pose("look"); await sleep(1800); this.pose("idle"); }

  // Descend la tête en bas au bout d'un fil (pendant les repos).
  async waitIdle() {
    for (let i = 0; i < 60 && this.busy; i++) await sleep(50);
  }

  // On ne garde que l'état voulu le plus récent : pas de file d'attente qui s'accumule.
  hang(on) {
    this.wantHang = on;
    if (!this.enabled || this.hangWorker) return this.hangWorker || Promise.resolve();
    this.hangWorker = (async () => {
      while (this.enabled && this.hanging !== this.wantHang) await this._hang(this.wantHang);
    })().finally(() => { this.hangWorker = null; });
    return this.hangWorker;
  }

  async _hang(on) {
    if (on && !this.hanging) {
      await this.waitIdle();
      this.hanging = true; this.busy = true;
      const b = this.bounds();
      const x = Math.min(innerWidth - 50, Math.max(50, innerWidth * 0.82));
      if (!reduced()) await this.zip({ x, y: b.top + H / 2, rot: 180, surface: "ceiling" });
      else Object.assign(this, { x, y: b.top + H / 2, rot: 180, surface: "ceiling" });
      this.anchor = { x, y: b.top - 4 }; this.lineFrom = "feet";
      this.pose("hang");
      const y0 = this.y, yT = b.top + 120;
      await this.tween(reduced() ? 0 : 900, t => { this.y = y0 + (yT - y0) * ease.back(t); });
      // léger balancement
      const t0 = performance.now();
      const sway = now => {
        if (!this.hanging) return;
        const k = (now - t0) / 1000;
        this.rot = 180 + Math.sin(k * 1.6) * 5;
        this.x = x + Math.sin(k * 1.6) * 6;
        this.render();
        requestAnimationFrame(sway);
      };
      if (!reduced()) requestAnimationFrame(sway);
    } else if (!on && this.hanging) {
      this.hanging = false;
      const b = this.bounds(), y0 = this.y;
      await this.tween(reduced() ? 0 : 450, t => { this.y = y0 + (b.top + H / 2 - y0) * ease.inOut(t); this.rot = 180; });
      this.anchor = null; this.surface = "ceiling";
      this.pose("idle"); this.busy = false;
      if (!reduced() && !this.wantHang) await this.run(() => this.zip(this.perch(this.ctx === "live" ? pick(["wallR", "wallL"]) : "floor")));
      this.schedule();
    }
  }

  /* ---------- Bulles ---------- */
  say(text, { mood, action, ms } = {}) {
    if (!this.enabled || !text) return false;
    this.bubble.innerHTML = `<span>${text.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</span>${action ? `<b>${action.label} →</b>` : ""}`;
    this.bubbleAction = action?.fn;
    this.bubble.classList.add("show");
    this.placeBubble();
    if (mood) this.mood(mood);
    clearTimeout(this.bubbleT);
    this.bubbleT = setTimeout(() => this.hideBubble(), ms || Math.min(9000, 2600 + text.length * 45));
    return true;
  }
  hideBubble() { this.bubble.classList.remove("show"); }
  placeBubble() {
    const bw = this.bubble.offsetWidth, bh = this.bubble.offsetHeight;
    const above = this.y > innerHeight * 0.45;
    let left = Math.min(innerWidth - bw - 12, Math.max(12, this.x - bw / 2));
    const top = above ? this.y - H / 2 - bh - 12 : this.y + H / 2 + 12;
    this.bubble.style.transform = `translate(${left}px, ${Math.max(8, top)}px)`;
    this.bubble.style.setProperty("--tail", `${Math.min(bw - 18, Math.max(18, this.x - left))}px`);
    this.bubble.classList.toggle("below", !above);
  }

  /* ---------- Réactions publiques ---------- */
  async react(kind) {
    if (!this.enabled || this.hanging) return;
    if (kind === "pr" || kind === "party") return this.run(() => this.flip());
    if (kind === "happy") { this.mood("happy"); return this.run(() => this.wave()); }
    if (kind === "alert") { this.mood("alert"); return this.run(() => this.look()); }
  }

  setContext(ctx) {
    this.ctx = ctx;
    if (!this.enabled || this.hanging) return;
    const p = this.perch(ctx === "live" ? pick(["wallR", "wallL", "ceiling"]) : "floor");
    this.run(() => (reduced() ? this.goto(p, 0) : this.zip(p)));
  }

  // Après un changement d'écran : se repose sur le "sol" (au-dessus de la barre d'onglets).
  settle(tries = 0) {
    if (!this.enabled || this.hanging || this.dragging) return;
    if (this.busy) { if (tries < 8) setTimeout(() => this.settle(tries + 1), 300); return; }
    const b = this.bounds();
    if (this.surface === "floor" && Math.abs(this.y - (b.floor - H / 2)) > 3) this.run(() => this.goto({ x: this.x, y: b.floor - H / 2, rot: 0, surface: "floor" }, 350, ease.out));
    else if (this.y > b.floor - H / 2 + 3) this.run(() => this.zip(this.perch("floor")));
  }

  async run(fn) {
    if (this.busy) return;
    this.busy = true;
    try { await fn(); } finally { this.busy = false; }
  }

  sound() {
    if (!state.profile.sound) return;
    this.onWeb?.();
  }

  /* ---------- Vie autonome ---------- */
  schedule() {
    clearTimeout(this.timer);
    if (!this.enabled) return;
    const delay = this.ctx === "live" ? rnd(12000, 22000) : rnd(4500, 10000);
    this.timer = setTimeout(() => this.wander(), delay);
  }

  async wander() {
    if (!this.enabled || this.busy || this.hanging || this.dragging || document.hidden) return this.schedule();
    if (reduced()) { if (Math.random() < 0.3) this.look(); return this.schedule(); }
    const live = this.ctx === "live";
    const options = live
      ? [[() => this.crawl(), 4], [() => this.look(), 3], [() => this.zip(this.perch(pick(["wallR", "wallL", "ceiling"]))), 2]]
      : [[() => this.crawl(), 4], [() => this.zip(this.perch()), 3], [() => this.swing(), 2], [() => this.look(), 2], [() => this.wave(), 1], [() => this.flip(), 1],
         [async () => { this.say(this.tip?.() || ""); }, 2]];
    const total = options.reduce((a, o) => a + o[1], 0);
    let r = Math.random() * total;
    const fn = options.find(o => (r -= o[1]) < 0)[0];
    await this.run(fn);
    this.schedule();
  }

  /* ---------- Glisser / toucher ---------- */
  bindPointer() {
    let sx, sy, moved = false;
    this.el.addEventListener("pointerdown", e => {
      if (this.hanging) return;
      e.preventDefault();
      this.el.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY; moved = false; this.dragging = true;
    });
    this.el.addEventListener("pointermove", e => {
      if (!this.dragging) return;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
      if (!moved) { moved = true; this.busy = true; this.anchor = null; this.pose("dangle"); this.rot = 0; }
      this.x = e.clientX; this.y = e.clientY + H / 3; this.render();
    });
    const up = async () => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!moved) { this.busy = false; return this.onTap?.(); }
      // relâché : il lance une toile vers le bord le plus proche
      const b = this.bounds();
      const d = { floor: b.floor - this.y, ceiling: this.y - b.top, wallL: this.x, wallR: innerWidth - this.x };
      const surface = Object.entries(d).sort((a, c) => a[1] - c[1])[0][0];
      const p = this.perch(surface);
      if (surface === "wallL" || surface === "wallR") p.y = Math.min(b.floor - 80, Math.max(b.top + 80, this.y));
      else p.x = Math.min(innerWidth - 40, Math.max(40, this.x));
      this.busy = false;
      await this.run(() => this.zip(p));
      this.schedule();
    };
    this.el.addEventListener("pointerup", up);
    this.el.addEventListener("pointercancel", up);
  }
}

export const spidey = new Spidey();
