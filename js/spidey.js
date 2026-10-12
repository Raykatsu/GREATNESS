// Le coach animé : il se balade sur l'écran selon son mode de déplacement — toile (Spider-Man),
// vol, petits sauts, course de ninja ou marche —, parle via des bulles, réagit aux séances
// (records, repos, sommeil) et se laisse attraper. Le personnage vient du registre js/chars/.
import { state } from "./store.js";
import { current, coachLine, figure, coachFace, fxRgb, onCoachChange, sync as syncCoach, loadAll } from "./chars/index.js";

const W = 52, H = 70;                 // taille affichée du personnage
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const turn = (from, to) => { let d = to - from; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
const ease = {
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  out: t => 1 - (1 - t) ** 3,
  back: t => { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  dash: t => 1 - (1 - t) ** 2.4,
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Surfaces : rotation du corps et direction « vers le haut » (s'éloigner du support).
const ROT = { floor: 0, ceiling: 180, wallL: 90, wallR: -90, air: 0 };
const UP = { floor: [0, -1], ceiling: [0, 1], wallL: [1, 0], wallR: [-1, 0], air: [0, -1] };
const vertical = s => s === "wallL" || s === "wallR";

// Particules (traînées) : formes simples, recyclées.
const SHAPES = {
  sparks: '<svg viewBox="0 0 10 10"><path d="M5 0 6.1 3.9 10 5 6.1 6.1 5 10 3.9 6.1 0 5 3.9 3.9Z" fill="currentColor"/></svg>',
  stars: '<svg viewBox="0 0 10 10"><path d="m5 .4 1.4 2.9 3.2.5-2.3 2.2.5 3.2L5 7.7 2.2 9.2l.5-3.2L.4 3.8l3.2-.5z" fill="currentColor"/></svg>',
  hearts: '<svg viewBox="0 0 10 10"><path d="M5 9.2S.3 6.3.3 3.3A2.4 2.4 0 0 1 5 2.3a2.4 2.4 0 0 1 4.7 1C9.7 6.3 5 9.2 5 9.2z" fill="currentColor"/></svg>',
  leaves: '<svg viewBox="0 0 10 10"><path d="M1 9C1 4.2 4.2 1 9 1c0 4.8-3.2 8-8 8z" fill="currentColor"/><path d="M1.8 8.2 6.8 3.2" stroke="rgba(0,0,0,.25)" stroke-width=".7"/></svg>',
};
const TRAIL = {
  sparks: () => ({ dx: rnd(-14, 14), dy: rnd(-14, 10), s0: rnd(0.7, 1), s1: 0.2, spin: rnd(-90, 90), ms: 460 }),
  stars: () => ({ dx: rnd(-12, 12), dy: rnd(-18, 4), s0: rnd(0.6, 1), s1: 0.25, spin: rnd(-140, 140), ms: 640 }),
  hearts: () => ({ dx: rnd(-10, 10), dy: rnd(-34, -20), s0: 0.5, s1: 1.05, ms: 900 }),
  smoke: () => ({ dx: rnd(-8, 8), dy: rnd(-14, -4), s0: 0.55, s1: 1.7, ms: 700 }),
  bubbles: () => ({ dx: rnd(-10, 10), dy: rnd(-40, -24), s0: 0.4, s1: 1, ms: 950 }),
  leaves: () => ({ dx: rnd(-20, 20), dy: rnd(14, 30), s0: rnd(0.7, 1), s1: 0.8, spin: rnd(-220, 220), ms: 1050 }),
  aura: () => ({ dx: rnd(-6, 6), dy: rnd(-26, -14), s0: 0.5, s1: 1.5, ms: 640 }),
};

class Coach {
  constructor() {
    this.x = innerWidth - 40; this.y = innerHeight - 140; this.rot = 0; this.facing = -1; this.sq = 1;
    this.surface = "floor"; this.busy = false; this.hanging = false; this.ctx = "app";
    this.anchor = null; this.lineFrom = "hand"; this.enabled = false; this.char = null; this.poseName = "";
    this.pts = []; this.pi = 0; this.lastTrail = 0; this.lastStreak = 0;
  }

  get travel() { return this.char?.travel || "web"; }
  get climbs() { return !!this.char?.climb; }

  init() {
    if (this.el) return;
    this.el = document.createElement("div");
    this.el.className = "spidey";
    this.el.innerHTML = `<div class="spidey-rot"><div class="spidey-pop"></div></div>`;
    this.rotEl = this.el.firstElementChild;
    this.pop = this.rotEl.firstElementChild;
    this.web = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.web.classList.add("spidey-web");
    this.web.innerHTML = `<line class="glow"/><line class="core"/>`;
    this.lines = [...this.web.children];
    this.fxBox = document.createElement("div");
    this.fxBox.className = "spidey-fx";
    this.bubble = document.createElement("div");
    this.bubble.className = "spidey-bubble";
    this.bubble.innerHTML = `<div class="sb-in"></div>`;
    this.bubbleIn = this.bubble.firstElementChild;
    document.body.append(this.web, this.fxBox, this.el, this.bubble);

    this.build(current());
    this.bindPointer();
    addEventListener("resize", () => this.enabled && !this.busy && !this.hanging && this.goto(this.perch(this.surface), 0));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { this.schedule(); this.blinkLoop(); } });
    document.addEventListener("scroll", () => this.onScroll(), { capture: true, passive: true });
    this.bubble.addEventListener("click", () => { const a = this.bubbleAction; this.hideBubble(); a?.(); });
    onCoachChange((c, why) => this.swap(c, why));
    loadAll(); // le reste du catalogue arrive en arrière-plan (dont le coach choisi s'il n'est pas Spider-Man)
    this.setEnabled(state.profile.mascot !== false);
  }

  /* ---------- Personnage ---------- */
  build(c) {
    this.char = c;
    this.pop.innerHTML = figure(c, { pose: "idle" });
    this.svg = this.pop.firstElementChild;
    this.poseName = "";
    this.el.dataset.travel = c.travel;
    for (const n of [this.web, this.fxBox]) { n.style.setProperty("--fx", c.fx.color); n.style.setProperty("--fx-rgb", fxRgb(c)); }
    this.setTab(c);
  }

  // L'onglet Coach de la barre du bas montre le visage du coach.
  setTab(c = this.char) {
    const old = document.querySelector('.tabbar a[data-tab="coach"] svg');
    if (!old || !c || old.dataset.coach === c.id) return;
    const t = document.createElement("div");
    t.innerHTML = coachFace("tab-face", c);
    t.firstElementChild.dataset.coach = c.id;
    old.replaceWith(t.firstElementChild);
  }

  // Changement de coach : petit nuage « pouf », puis le nouveau tombe en place et dit bonjour.
  async swap(c, why) {
    if (!this.el || c === this.char) return;
    this.setTab(c);
    const quiet = !this.enabled || why !== "set" || reduced() || this.dragging || this.hanging || document.hidden;
    if (quiet) {
      this.build(c);
      if (!this.peeker) this.unpeek();
      if (!this.climbs && ["wallL", "wallR", "ceiling"].includes(this.surface)) Object.assign(this, this.perch("floor"));
      if (this.surface === "air" && this.travel !== "fly") Object.assign(this, this.perch("floor"));
      this.sq = 1;
      this.pose(this.hanging ? this.restPose() : this.idlePose());
      this.render();
      return;
    }
    this.swapping = true;
    clearTimeout(this.timer);
    await this.waitIdle();
    this.busy = true;
    try {
      this.hideBubble();
      this.unpeek();
      this.anchor = null; this.sq = 1; this.render();
      this.puff(this.x, this.y);
      const out = this.pop.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.2) rotate(-25deg)", opacity: 0 }], { duration: 200, easing: "ease-in", fill: "forwards" });
      await out.finished.catch(() => {});
      this.build(c);
      const fly = this.travel === "fly", b = this.bounds();
      const p = this.perch(fly ? "air" : "floor");
      p.x = clamp(this.x, 40, innerWidth - 40);
      if (fly) p.y = clamp(this.y, b.top + 60, b.floor - 150);
      Object.assign(this, { x: p.x, y: p.y - 170, rot: 0, sq: 1, surface: p.surface, facing: p.x > innerWidth / 2 ? -1 : 1 });
      this.pose(fly ? "float" : "drop");
      this.render();
      out.cancel();
      this.pop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
      await this.goto(p, fly ? 700 : 520, fly ? ease.out : t => t * t);
      if (!fly) await this.squash(0.74, 360);
      this.pose("wave", "happy");
      this.burst(this.x, this.y - 6, 8);
      const hello = coachLine("hello", c);
      if (hello) this.say(hello, { mood: "happy" });
      await sleep(1300);
      if (this.poseName === "wave") this.pose(this.idlePose());
    } finally {
      this.busy = false; this.swapping = false;
      this.schedule();
    }
  }

  setEnabled(on) {
    this.enabled = on;
    this.el.style.display = this.web.style.display = this.fxBox.style.display = on ? "" : "none";
    if (!on) { this.hideBubble(); clearTimeout(this.timer); clearTimeout(this.blinkT); return; }
    const fly = this.travel === "fly";
    const p = this.perch(fly ? "air" : "floor");
    Object.assign(this, { x: p.x, y: p.y - 140, rot: 0, sq: 1, surface: p.surface });
    this.pose(fly ? "float" : "drop");
    this.render();
    this.goto(p, 700, fly ? ease.out : ease.back).then(() => { this.pose(this.idlePose()); this.schedule(); });
    this.blinkLoop();
  }

  /* ---------- Géométrie ---------- */
  bounds() {
    if (this.ctx === "live") {
      // en séance, le « sol » est le haut du bouton du bas : on ne cache jamais Valider ni le minuteur
      const dock = document.getElementById("dock")?.getBoundingClientRect();
      const head = document.querySelector(".live-head")?.getBoundingClientRect();
      const floor = dock && dock.height > 0 && dock.top > 200 ? dock.top : innerHeight - 6;
      return { floor, top: Math.max(96, (head?.bottom || 0) + 14), left: 0, right: innerWidth };
    }
    const tab = document.querySelector(".tabbar");
    const tabVisible = tab && getComputedStyle(tab).display !== "none" && !document.body.classList.contains("hide-tabs");
    let floor = tabVisible ? innerHeight - tab.offsetHeight + 2 : innerHeight - 6; // offsetHeight ignore l'animation de la barre
    // la zone de saisie du Coach sert de rebord : il se tient dessus, jamais devant
    const comp = document.querySelector(".composer form")?.getBoundingClientRect();
    if (comp && comp.height && comp.top > innerHeight / 2 && comp.top < floor) floor = comp.top;
    return { floor, top: 8, left: 0, right: innerWidth };
  }

  // Ne pas se planter devant un bouton flottant (le « + » des Séances).
  safeX(x) {
    const f = this.ctx === "live" ? null : document.querySelector(".fab")?.getBoundingClientRect();
    if (!f || !f.width || x <= f.left - W / 2 + 4 || x >= f.right + W / 2 - 4) return x;
    return f.left - W / 2 - 2 > 30 ? f.left - W / 2 - 2 : f.right + W / 2 + 2;
  }

  surfaces() {
    if (this.travel === "web") return ["floor", "floor", "wallR", "wallL", "ceiling"];
    if (this.travel === "fly") return this.climbs ? ["floor", "air", "air", "wallR", "wallL"] : ["floor", "air", "air"];
    return this.climbs ? ["floor", "floor", "wallR", "wallL", "ceiling"] : ["floor"];
  }

  perch(surface = pick(this.surfaces())) {
    const b = this.bounds();
    const midY = rnd(b.top + 140, b.floor - 140);
    switch (surface) {
      case "wallR": return { x: b.right - H / 2 - 1, y: midY, rot: -90, surface };
      case "wallL": return { x: H / 2 + 1, y: midY, rot: 90, surface };
      case "ceiling": return { x: rnd(60, innerWidth - 60), y: b.top + H / 2, rot: 180, surface };
      case "air": {
        // en séance : plane à droite du titre (comme Spider-Man suspendu), jamais devant les réglages
        if (this.ctx === "live") return { x: clamp(innerWidth * 0.82 + rnd(-10, 6), 50, innerWidth - 40), y: b.top + rnd(104, 128), rot: 0, surface };
        const y = rnd(b.top + 90, Math.max(b.top + 100, b.floor - 190));
        return { x: pick([rnd(40, 100), rnd(innerWidth - 100, innerWidth - 40)]), y, rot: 0, surface };
      }
      default: return { x: this.safeX(pick([innerWidth - 42, 42, rnd(60, innerWidth - 60)])), y: b.floor - H / 2, rot: 0, surface: "floor" };
    }
  }

  livePerch() {
    if (this.climbs) return this.perch(pick(["wallR", "wallL", "ceiling"]));
    if (this.travel === "fly") return this.perch("air");
    return this.perch("floor");
  }

  idlePose() { return this.peekDepth ? (this.peekDepth === "rest" ? "peek" : "lurk") : this.surface === "air" ? "float" : "idle"; }

  // Ni toile, ni vol, ni murs : en séance, il se cache derrière la barre du bas et seule sa tête dépasse.
  get peeker() { return !this.climbs && this.travel !== "fly"; }
  async lurk(rest = false) {
    const R = reduced(), seat = this.seat();
    rest &&= seat.free !== false; // pas de place au-dessus : on ne montre que les yeux
    const yP = seat.ledge + (rest ? 5 : 13); // repos : tête et mains sur le rebord · sinon : juste les yeux
    if (!this.peekDepth) {
      // se pose sur le rebord là où il est, puis plonge derrière la barre
      const p = { x: clamp(this.x, 30, innerWidth - 30), y: seat.ledge - H / 2, rot: 0, surface: "floor" };
      if (R) Object.assign(this, p);
      else if (this.surface !== "floor") await this.leap(p);
      else await this.goto(p, 200, ease.out);
      this.rot = 0; this.surface = "floor";
      this.el.classList.add("peek");
    }
    if (!this.peekDepth || Math.abs(this.x - seat.x) > 24) {
      // caché derrière la barre, il file jusqu'à l'endroit le plus dégagé
      const x0 = this.x, y0 = this.y;
      this.facing = seat.x > x0 ? 1 : -1;
      this.pose("lurk");
      await this.tween(R ? 0 : 220, t => { this.y = lerp(y0, seat.ledge + 34, t * t); });
      await this.tween(R ? 0 : clamp(Math.abs(seat.x - x0) * 2.5, 0, 800), t => { this.x = lerp(x0, seat.x, ease.inOut(t)); });
    }
    this.peekDepth = rest ? "rest" : "deep";
    this.pose(this.idlePose());
    const y0 = this.y;
    await this.tween(R ? 0 : 320, t => { this.y = lerp(y0, yP, ease.out(t)); });
  }
  // Ressort de derrière la barre (fin de séance, glisser-déposer).
  unpeek() {
    if (!this.peekDepth) return;
    this.peekDepth = null;
    this.el.classList.remove("peek");
    this.y = Math.min(this.y, this.bounds().floor - H / 2);
    this.pose(this.idlePose());
    this.render();
  }

  // Point d'attache de la toile : main levée (au-dessus de la tête) ou pieds.
  attachPoint(from = this.lineFrom) {
    const a = (this.rot * Math.PI) / 180;
    const d = from === "feet" ? H / 2 - 2 : -H / 2 + 2;
    return { x: this.x - Math.sin(a) * d, y: this.y + Math.cos(a) * d };
  }

  render() {
    this.el.style.transform = `translate3d(${this.x - W / 2}px, ${this.y - H / 2}px, 0)`;
    const s = this.sq;
    // écrasement / étirement ancré aux pieds
    this.rotEl.style.transform = s === 1 ? `rotate(${this.rot}deg) scaleX(${this.facing})`
      : `rotate(${this.rot}deg) translateY(${((H / 2) * (1 - s)).toFixed(2)}px) scale(${(this.facing * (1 + (1 - s) * 0.7)).toFixed(3)}, ${s.toFixed(3)})`;
    if (this.anchor) {
      const p = this.attachPoint();
      for (const l of this.lines) { l.setAttribute("x1", this.anchor.x); l.setAttribute("y1", this.anchor.y); l.setAttribute("x2", p.x); l.setAttribute("y2", p.y); }
      this.web.classList.add("on");
    } else this.web.classList.remove("on");
    if (this.bubble.classList.contains("show")) this.placeBubble();
  }

  pose(name, mood) {
    if (this.sleeping && name !== "sleep") return; // il dort : rien ne change sa pose
    this.poseName = name;
    this.svg.setAttribute("class", `sp pose-${name} ch-${this.char.id}${mood ? " mood-" + mood : ""}`);
    this.el.dataset.pose = name;
  }
  mood(m) {
    this.svg.classList.remove("mood-happy", "mood-alert", "mood-party");
    if (m) this.svg.classList.add("mood-" + m);
    clearTimeout(this.moodT);
    this.moodT = setTimeout(() => this.svg.classList.remove("mood-" + m), 2500);
  }

  // Clignement des yeux par minuterie (pas d'animation qui tourne en continu).
  blinkLoop() {
    clearTimeout(this.blinkT);
    if (!this.enabled || document.hidden) return;
    this.blinkT = setTimeout(() => {
      if (!this.sleeping) { this.svg.classList.add("blink"); setTimeout(() => this.svg.classList.remove("blink"), 130); }
      this.blinkLoop();
    }, rnd(2400, 5600));
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
    const dr = turn(s.rot, p.rot ?? s.rot);
    this.surface = p.surface || this.surface;
    return this.tween(ms, t => { const k = e(t); this.x = s.x + (p.x - s.x) * k; this.y = s.y + (p.y - s.y) * k; this.rot = s.rot + dr * k; });
  }

  // Écrasement à l'atterrissage, puis rebond élastique.
  async squash(amount = 0.8, ms = 320) {
    this.pose("land");
    if (!reduced()) {
      this.dust();
      await this.tween(ms, t => { this.sq = 1 + (amount - 1) * Math.cos(t * Math.PI * 1.5) * (1 - t) ** 1.5; });
    }
    this.sq = 1; this.render();
    this.pose(this.idlePose());
  }

  /* ---------- Déplacements ---------- */
  // Va jusqu'à un point d'accroche à la manière du personnage.
  moveTo(p) {
    const t = this.travel;
    if (t === "web") return this.zip(p);
    if (t === "fly") return this.flyTo(p);
    if (p.surface === this.surface) return this.alongTo(vertical(p.surface) ? p.y : p.x);
    if (t === "dash" && p.surface === "ceiling") return this.zip(p, { grapple: true });
    return this.leap(p, { spin: t === "dash" ? 360 : 0 });
  }

  // Petite promenade sur le support actuel (ou d'un point à l'autre du ciel).
  stroll() {
    if (this.travel === "fly") return this.flyTo(this.ctx === "live" ? this.perch("air") : this.perch(Math.random() < 0.75 ? "air" : "floor"));
    const b = this.bounds();
    const v = vertical(this.surface);
    const cur = v ? this.y : this.x;
    const lo = v ? b.top + 80 : 40, hi = v ? b.floor - 80 : innerWidth - 40;
    const reach = this.travel === "dash" ? 260 : 160;
    const to = clamp(cur + rnd(-reach, reach), lo, hi);
    return this.alongTo(this.surface === "floor" ? this.safeX(to) : to);
  }
  crawl() { return this.stroll(); }

  // Avance le long du support jusqu'à la coordonnée voulue (x au sol et au plafond, y aux murs).
  async alongTo(target) {
    const v = vertical(this.surface);
    const cur = v ? this.y : this.x;
    const dist = Math.abs(target - cur);
    if (dist < 30) return;
    const forward = target > cur ? 1 : -1;
    // sens du regard dans le repère du corps
    this.facing = this.surface === "ceiling" || this.surface === "wallR" ? -forward : forward;
    const to = v ? { x: this.x, y: target, rot: this.rot } : { x: target, y: this.y, rot: this.rot };
    const t = this.travel;
    if (t === "hop") return this.hopTo(target);
    if (t === "dash") {
      const base = ROT[this.surface] ?? this.rot, s = { x: this.x, y: this.y };
      this.pose("dash");
      await this.tween(Math.max(240, dist / 0.55), k => {
        const e = ease.dash(k);
        this.x = lerp(s.x, to.x, e); this.y = lerp(s.y, to.y, e);
        this.rot = base + this.facing * 16 * (1 - k ** 3); // penché en avant, se redresse au freinage
        this.streak();
      });
      this.rot = base;
      return this.squash(0.9, 220);
    }
    this.pose(t === "walk" ? "walk" : "crawl");
    await this.goto(to, dist / (t === "walk" ? 0.055 : 0.07), x => x);
    this.pose(this.idlePose());
  }

  // Série de petits sauts le long du support.
  async hopTo(target) {
    const v = vertical(this.surface);
    const cur = v ? this.y : this.x;
    const n = Math.max(1, Math.round(Math.abs(target - cur) / 44)), per = 330, h = 22;
    const [nx, ny] = UP[this.surface] || UP.floor;
    const bx = this.x, by = this.y;
    let last = -1;
    this.pose("hop");
    await this.tween(n * per, t => {
      const f = Math.min(n - 1e-6, t * n), i = Math.floor(f), u = f - i;
      const along = cur + (target - cur) * ((i + ease.inOut(u)) / n);
      const lift = Math.sin(Math.PI * u) * h;
      if (v) { this.y = along; this.x = bx + nx * lift; } else { this.x = along; this.y = by + ny * lift; }
      const c = Math.max(0, 1 - Math.min(u, 1 - u) / 0.13); // 1 au contact du sol
      this.sq = 1 - 0.17 * c + 0.07 * Math.sin(Math.PI * u) * (1 - c);
      if (i !== last) { last = i; if (i > 0) this.dust(); }
      this.trail();
    });
    if (v) this.x = bx; else this.y = by;
    return this.squash(0.86, 240);
  }

  // Saut en cloche vers un autre support (murs, plafond, sol).
  async leap(p, { spin = 0, apex = 70 } = {}) {
    const s = { x: this.x, y: this.y, rot: this.rot };
    const dist = Math.hypot(p.x - s.x, p.y - s.y);
    const ms = clamp(380 + dist * 0.55, 420, 900);
    this.facing = p.x >= s.x ? 1 : -1;
    this.pose("crouch");
    await this.tween(110, t => { this.sq = 1 - 0.14 * ease.out(t); });
    this.pose("hop");
    const dr = turn(s.rot, p.rot) + spin * this.facing;
    const cx = (s.x + p.x) / 2, cy = Math.min(s.y, p.y) - apex;
    await this.tween(ms, t => {
      const u = 1 - t;
      this.x = u * u * s.x + 2 * u * t * cx + t * t * p.x;
      this.y = u * u * s.y + 2 * u * t * cy + t * t * p.y;
      this.rot = s.rot + dr * ease.inOut(t);
      this.sq = t < 0.2 ? lerp(0.86, 1.08, t / 0.2) : lerp(1.08, 1, Math.min(1, (t - 0.2) / 0.3));
      this.trail();
    });
    this.surface = p.surface; this.rot = p.rot; this.sq = 1;
    return this.squash(0.8);
  }

  // Vol en courbe douce, penché dans le sens du vol ; arrivée en vol stationnaire ou posé.
  async flyTo(p) {
    const s = { x: this.x, y: this.y, rot: this.rot };
    const dx = p.x - s.x, dy = p.y - s.y, dist = Math.hypot(dx, dy) || 1;
    if (dist < 12) return;
    const ms = clamp(600 + dist * 1.1, 700, 1600);
    this.facing = dx >= 0 ? 1 : -1;
    const b = this.bounds();
    const side = pick([-1, 1]) * Math.min(110, dist * 0.35);
    const nx = -dy / dist, ny = dx / dist;
    const cp = (k, f) => ({ x: clamp(s.x + dx * k + nx * side * f, 30, innerWidth - 30), y: clamp(s.y + dy * k + ny * side * f - 40, b.top + 20, b.floor - 40) });
    const c1 = cp(0.28, 1), c2 = cp(0.72, 0.6);
    const endRot = p.rot ?? 0;
    if (this.surface !== "air") { this.pose("crouch"); await this.tween(100, t => { this.sq = 1 - 0.12 * t; }); this.sq = 1; }
    this.pose("fly"); this.surface = "air";
    await this.tween(ms, t => {
      const k = ease.inOut(t), u = 1 - k;
      this.x = u ** 3 * s.x + 3 * u * u * k * c1.x + 3 * u * k * k * c2.x + k ** 3 * p.x;
      this.y = u ** 3 * s.y + 3 * u * u * k * c1.y + 3 * u * k * k * c2.y + k ** 3 * p.y;
      const vx = 3 * u * u * (c1.x - s.x) + 6 * u * k * (c2.x - c1.x) + 3 * k * k * (p.x - c2.x);
      const tilt = clamp(vx / (dist * 1.2), -1, 1) * 24;
      const land = clamp((t - 0.78) / 0.22, 0, 1);
      this.rot = lerp(lerp(s.rot, 0, Math.min(1, t * 4)) + tilt, endRot, ease.inOut(land));
      this.trail();
    });
    this.surface = p.surface || "air"; this.rot = endRot;
    if (this.surface === "air") this.pose("float");
    else await this.squash(0.88, 260);
  }

  // Looping (pour ceux qui volent), en avançant vers le milieu de l'écran pour ne jamais en sortir.
  async loop() {
    const r = 46, x0 = this.x, cy = this.y - r;
    const dir = x0 < innerWidth / 2 ? 1 : -1, drift = dir * Math.min(90, Math.abs(innerWidth / 2 - x0));
    if (cy - r < this.bounds().top + 10) return this.flip(true);
    this.facing = dir;
    this.pose("fly", "party");
    await this.tween(1200, t => {
      const k = ease.inOut(t), th = Math.PI / 2 - dir * 2 * Math.PI * k;
      this.x = x0 + drift * k + r * Math.cos(th);
      this.y = cy + r * Math.sin(th);
      this.rot = (th * 180) / Math.PI - 90; // la tête vers le centre de la boucle
      this.trail();
    });
    this.rot = 0; this.render();
    this.pose(this.idlePose());
  }

  // Lance une toile (ou un grappin) vers la destination puis s'y fait tirer.
  async zip(p, { grapple = false } = {}) {
    const start = { x: this.x, y: this.y };
    this.facing = p.x >= this.x ? 1 : -1;
    this.anchor = { x: p.x + (p.surface === "wallR" ? H / 2 : p.surface === "wallL" ? -H / 2 : 0), y: p.surface === "ceiling" ? p.y - H / 2 : p.surface === "floor" ? Math.max(this.bounds().top, p.y - 220) : p.y };
    this.lineFrom = "hand";
    this.pose("zip");
    this.sound();
    const s = { ...start, rot: this.rot };
    const cx = (start.x + p.x) / 2, cy = Math.min(start.y, p.y) - (grapple ? 30 : 80);
    const dr = turn(s.rot, p.rot);
    const dist = Math.hypot(p.x - s.x, p.y - s.y);
    await this.tween(grapple ? Math.min(560, 260 + dist * 0.5) : Math.min(1100, 450 + dist), t => {
      const k = ease.inOut(t), u = 1 - k;
      this.x = u * u * s.x + 2 * u * k * cx + k * k * p.x;
      this.y = u * u * s.y + 2 * u * k * cy + k * k * p.y;
      this.rot = s.rot + dr * ease.out(t);
      if (grapple) this.streak();
    });
    this.anchor = null; this.surface = p.surface; this.rot = p.rot;
    this.pose("land"); this.render();
    await sleep(260);
    this.pose(this.idlePose());
  }

  // Grand balancement d'un côté à l'autre de l'écran (toile).
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

  // Le « numéro » propre à chaque mode de déplacement.
  showoff() {
    const b = this.bounds(), far = this.safeX(this.x > innerWidth / 2 ? 50 : innerWidth - 50);
    switch (this.travel) {
      case "web": return this.swing();
      case "fly": return this.loop();
      case "dash": return this.alongTo(vertical(this.surface) ? (this.y > innerHeight / 2 ? b.top + 90 : b.floor - 90) : far);
      case "hop": return this.surface === "floor" ? this.hopTo(far) : this.flip();
      default: return this.surface === "floor" ? this.alongTo(far) : this.wave();
    }
  }

  // Salto (s'éloigne de son support, tourne, revient).
  async flip(force) {
    if (this.surface === "air" && !force) return this.loop();
    const x0 = this.x, y0 = this.y, r0 = this.rot;
    const [nx, ny] = UP[this.surface] || UP.floor;
    this.pose("flip", "party");
    await this.tween(750, t => {
      const h = Math.sin(Math.PI * t) * 70;
      this.x = x0 + nx * h; this.y = y0 + ny * h;
      this.rot = r0 + 360 * ease.inOut(t) * (this.facing || 1);
    });
    this.x = x0; this.y = y0; this.rot = r0;
    this.pose("land"); this.render();
    await sleep(220); this.pose(this.idlePose());
  }

  // Soulève un haltère (pendant les séries).
  async lift(ms = 3600) {
    if (!this.enabled || this.busy || this.hanging) return;
    return this.run(async () => { this.pose("lift", "happy"); await sleep(ms); this.pose(this.idlePose()); });
  }

  // S'endort (pas de séance depuis plusieurs jours) jusqu'à ce qu'on le touche.
  sleep(text) {
    if (!this.enabled || this.hanging || this.sleeping) return;
    if (this.surface === "air") { // il se pose d'abord
      if (!this.busy) this.run(async () => { await this.flyTo(this.perch("floor")); this.sleep(text); });
      return;
    }
    this.sleeping = true;
    this.pose("sleep");
    const own = coachLine("sleep"), days = text?.match(/\d+ jours? sans séance/)?.[0];
    const msg = own ? (days ? `${own} (${days})` : own) : text;
    if (msg) this.say(msg, { ms: 6000 });
  }
  wake() {
    if (!this.sleeping) return false;
    this.sleeping = false;
    this.hideBubble();
    this.pose(this.idlePose());
    this.react("party");
    return true;
  }

  async wave() { this.pose("wave", "happy"); await sleep(1300); this.pose(this.idlePose()); }
  async look() { this.pose(this.surface === "air" ? "float" : "look"); await sleep(1800); this.pose(this.idlePose()); }

  async waitIdle() {
    for (let i = 0; i < 60 && this.busy; i++) await sleep(50);
  }

  /* ---------- Repos de séance ---------- */
  // On ne garde que l'état voulu le plus récent : pas de file d'attente qui s'accumule.
  hang(on) {
    this.wantHang = on;
    if (!this.enabled || this.hangWorker) return this.hangWorker || Promise.resolve();
    this.hangWorker = (async () => {
      while (this.enabled && this.hanging !== this.wantHang) await this._hang(this.wantHang);
    })().finally(() => { this.hangWorker = null; });
    return this.hangWorker;
  }

  // Toile : suspendu au fil · vol : plane en haut · ninja grimpeur : accroché au plafond · autres : assis sur le rebord.
  restMode() {
    if (this.travel === "web") return "web";
    if (this.travel === "fly") return "float";
    if (this.travel === "dash" && this.climbs) return "cling";
    return "sit";
  }
  restPose() { return { web: "hang", float: "float", cling: "crouch", sit: "peek" }[this.restMode()]; }

  async _hang(on) {
    const R = reduced();
    if (on && !this.hanging) {
      await this.waitIdle();
      this.hanging = true; this.busy = true;
      this.el.classList.add("resting");
      this.ghost(false);
      const b = this.bounds();
      const x = Math.min(innerWidth - 50, Math.max(50, innerWidth * 0.82));
      const mode = (this.restKind = this.restMode());
      if (mode === "web") {
        if (!R) await this.zip({ x, y: b.top + H / 2, rot: 180, surface: "ceiling" });
        else Object.assign(this, { x, y: b.top + H / 2, rot: 180, surface: "ceiling" });
        this.anchor = { x, y: b.top - 4 }; this.lineFrom = "feet";
        this.pose("hang");
        const y0 = this.y, yT = b.top + 120;
        await this.tween(R ? 0 : 900, t => { this.y = y0 + (yT - y0) * ease.back(t); });
        if (this.hanging && !R) this.sway(true); // léger balancement, en CSS : rien ne tourne en JS
      } else if (mode === "float") {
        const p = { x, y: b.top + 116, rot: 0, surface: "air" };
        if (!R) await this.flyTo(p); else Object.assign(this, p);
        this.pose("float");
      } else if (mode === "cling") {
        const p = { x, y: b.top + H / 2, rot: 180, surface: "ceiling" };
        if (!R) await this.moveTo(p); else Object.assign(this, p);
        this.pose("crouch");
      } else {
        await sleep(60); // le minuteur vient d'apparaître
        await this.lurk(true);
      }
      this.render();
      this.restLine(2600, 2);
    } else if (!on && this.hanging) {
      this.hanging = false;
      clearTimeout(this.restT);
      this.el.classList.remove("resting");
      if (this.restKind === "web") {
        this.sway(false);
        const b = this.bounds(), y0 = this.y;
        await this.tween(R ? 0 : 450, t => { this.y = y0 + (b.top + H / 2 - y0) * ease.inOut(t); this.rot = 180; });
        this.anchor = null; this.surface = "ceiling";
        this.pose("idle"); this.busy = false;
        if (!R && !this.wantHang) await this.run(() => this.zip(this.perch(this.ctx === "live" ? pick(["wallR", "wallL"]) : "floor")));
      } else {
        if (this.restKind === "sit" && this.ctx === "live" && this.peeker) {
          await sleep(80); // le bouton Valider remplace le minuteur
          await this.lurk(false);
        } else if (this.restKind === "sit") {
          const y0 = this.y, yT = this.bounds().floor - H / 2;
          this.peekDepth = null;
          this.pose("idle");
          await this.tween(R ? 0 : 240, t => { this.y = lerp(y0, yT, ease.out(t)); });
          this.el.classList.remove("peek");
        } else this.pose(this.idlePose());
        this.busy = false;
        if (this.ctx !== "live" && !R && !this.wantHang) await this.run(() => this.moveTo(this.perch(this.travel === "fly" ? "air" : "floor")));
      }
      this.schedule();
      this.checkCover();
    }
  }

  // Balancement du pendule autour du point d'accroche : animation CSS de `rotate` (sur le compositeur).
  sway(on) {
    const nodes = [this.el, this.web];
    if (on && this.anchor) {
      const o = `${this.anchor.x}px ${this.anchor.y}px`;
      nodes.forEach(n => { n.style.transformOrigin = o; n.classList.add("sway"); });
    } else {
      nodes.forEach(n => {
        if (!n.classList.contains("sway")) return;
        const r = getComputedStyle(n).rotate;
        n.classList.remove("sway");
        if (r && r !== "none" && parseFloat(r)) n.animate([{ rotate: r }, { rotate: "0deg" }], { duration: 240, easing: "ease-out" });
      });
    }
  }

  // Place sur le rebord du minuteur : la tête dépasse juste au-dessus, on choisit l'endroit le plus dégagé
  // (sans bouton ni texte) pour ne rien cacher.
  seat() {
    // le conteneur fixe (pas le minuteur, qui glisse encore pendant son apparition)
    const r = document.getElementById("dock")?.getBoundingClientRect();
    if (!r || !r.width) return { x: innerWidth * 0.5, ledge: this.bounds().floor };
    const y = r.top - 16, mine = e => e.closest(".spidey, .spidey-bubble, .spidey-web, .spidey-fx");
    const busy = x => {
      const e = document.elementsFromPoint(x, y).find(n => !mine(n) && !n.closest(".dock")); // le dégradé de la barre ne compte pas
      if (!e || e === document.body || e === document.documentElement) return false;
      if (e.closest("button, a, input, select, textarea, label, [data-s], .stepper, .chip")) return true;
      return [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    };
    let run = 0, best = { len: 0, x: r.right - 34 };
    for (let x = r.left + 26; x <= r.right - 26; x += 6) {
      run = busy(x) ? 0 : run + 6;
      if (run > best.len) best = { len: run, x: x - run / 2 + 3 };
    }
    const free = best.len >= 40;
    return { x: clamp(free ? best.x : r.right - 34, 30, innerWidth - 30), ledge: r.top, free };
  }

  // Une réplique de repos, seulement si personne d'autre ne parle déjà.
  restLine(delay, tries) {
    clearTimeout(this.restT);
    this.restT = setTimeout(() => {
      if (!this.hanging || this.quiet) return;
      if (this.bubble.classList.contains("show")) return tries > 1 && this.restLine(3200, tries - 1);
      const l = coachLine("rest");
      if (l) this.say(l, { ms: 3400 });
    }, delay);
  }

  /* ---------- En séance : ne jamais cacher les commandes ---------- */
  onScroll() {
    if (this.ctx !== "live" || !this.enabled) return;
    clearTimeout(this.scrollT);
    this.scrollT = setTimeout(() => this.checkCover(), 140);
  }

  // S'il se retrouve devant un réglage ou le bouton du bas, il s'efface (et laisse passer les doigts).
  checkCover() {
    if (!this.enabled || this.ctx !== "live" || this.dragging) return this.ghost(false);
    const v = Math.abs(Math.sin((this.rot * Math.PI) / 180)) > 0.7;
    const w = (v ? H : W) * 0.78, h = (v ? W : H) * 0.78;
    const me = { l: this.x - w / 2, r: this.x + w / 2, t: this.y - h / 2, b: this.y + h / 2 };
    const onLedge = this.surface === "floor";
    const hit = [...document.querySelectorAll(".stepper, [data-s], #dock button, #rest")].some(e => {
      if (onLedge && e.closest("#dock")) return false; // posé dessus, pas devant
      const q = e.getBoundingClientRect();
      return q.width && me.l < q.right && me.r > q.left && me.t < q.bottom && me.b > q.top;
    });
    this.ghost(hit);
  }
  ghost(on) { this.el?.classList.toggle("ghost", !!on); }

  /* ---------- Particules ---------- */
  spawn(kind, x, y, { dx = 0, dy = -16, s0 = 0.7, s1 = 1, spin = 0, rot = rnd(-30, 30), ms = 600 } = {}) {
    if (!this.enabled || reduced()) return;
    if (!this.pts.length) {
      for (let i = 0; i < 12; i++) { const n = document.createElement("i"); n.className = "sp-pt"; this.fxBox.appendChild(n); this.pts.push(n); }
    }
    const el = this.pts[(this.pi = (this.pi + 1) % this.pts.length)];
    if (el._k !== kind) { el.className = `sp-pt k-${kind}`; el.innerHTML = SHAPES[kind] || ""; el._k = kind; }
    el._a?.cancel();
    el._a = el.animate([
      { transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${s0})`, opacity: 1 },
      { transform: `translate(${x + dx}px, ${y + dy}px) rotate(${rot + spin}deg) scale(${s1})`, opacity: 0 },
    ], { duration: ms, easing: "cubic-bezier(.2,.7,.3,1)" });
  }
  // Traînée pendant les déplacements (une particule toutes les ~70 ms).
  trail() {
    const k = this.char?.fx.trail;
    if (!k || k === "none") return;
    const now = performance.now();
    if (now - this.lastTrail < 70) return;
    this.lastTrail = now;
    this.spawn(k, this.x - this.facing * 8 + rnd(-6, 6), this.y + rnd(-8, 14), TRAIL[k]());
  }
  // Lignes de vitesse (ninja) + traînée.
  streak() {
    const now = performance.now();
    if (now - this.lastStreak > 45) {
      this.lastStreak = now;
      const a = (ROT[this.surface] ?? 0) * Math.PI / 180;
      const dirX = Math.cos(a) * this.facing, dirY = Math.sin(a) * this.facing;
      this.spawn("streak", this.x - dirX * 18 + rnd(-4, 4) * Math.abs(dirY), this.y - dirY * 18 + rnd(-18, 18) * Math.abs(dirX), { dx: -dirX * 26, dy: -dirY * 26, s0: 1, s1: 0.5, rot: (Math.atan2(dirY, dirX) * 180) / Math.PI, ms: 320 });
    }
    this.trail();
  }
  // Petit nuage de poussière sous les pieds (atterrissages).
  dust() {
    const [nx, ny] = UP[this.surface] || UP.floor, tx = -ny, ty = nx;
    const fx = this.x - nx * (H / 2 - 4), fy = this.y - ny * (H / 2 - 4);
    for (const s of [-1, 1]) this.spawn("dust", fx + s * 8 * tx, fy + s * 8 * ty, { dx: s * 16 * tx + nx * 5, dy: s * 16 * ty + ny * 5, s0: 0.5, s1: 1.2, rot: 0, ms: 420 });
  }
  burst(x, y, n = 10) {
    const k = this.char?.fx.trail && this.char.fx.trail !== "none" ? this.char.fx.trail : "stars";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3), d = rnd(34, 58);
      this.spawn(k, x, y, { dx: Math.cos(a) * d, dy: Math.sin(a) * d - 8, s0: 0.5, s1: rnd(0.9, 1.25), spin: rnd(-160, 160), ms: rnd(650, 900) });
    }
  }
  puff(x, y) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, d = rnd(16, 30);
      this.spawn("puff", x + Math.cos(a) * 6, y + Math.sin(a) * 8, { dx: Math.cos(a) * d, dy: Math.sin(a) * d - 6, s0: 0.6, s1: rnd(1.5, 2), rot: 0, ms: rnd(520, 700) });
    }
  }

  /* ---------- Bulles ---------- */
  say(text, { mood, action, ms } = {}) {
    if (!this.enabled || !text) return false;
    // typographie française : jamais de « ? » ou « ! » seul en début de ligne
    const t = String(text).replace(/ ([?!:;»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
    this.bubbleIn.innerHTML = `<span>${t.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</span>${action ? `<b>${action.label} →</b>` : ""}`;
    this.bubbleAction = action?.fn;
    this.bw = this.bubble.offsetWidth; this.bh = this.bubble.offsetHeight; // mesurée une fois, pas à chaque image
    this.placeBubble();
    this.bubble.classList.add("show");
    if (mood) this.mood(mood);
    clearTimeout(this.bubbleT);
    this.bubbleT = setTimeout(() => this.hideBubble(), ms || Math.min(9000, 2600 + text.length * 45));
    return true;
  }
  hideBubble() { this.bubble?.classList.remove("show"); }
  placeBubble() {
    const bw = this.bw, bh = this.bh;
    const above = this.y > innerHeight * 0.45;
    const left = Math.min(innerWidth - bw - 12, Math.max(12, this.x - bw / 2));
    const top = above ? this.y - H / 2 - bh - 12 : this.y + H / 2 + 12;
    this.bubble.style.transform = `translate3d(${left}px, ${Math.max(8, top)}px, 0)`;
    this.bubble.style.setProperty("--tail", `${Math.min(bw - 18, Math.max(18, this.x - left))}px`);
    this.bubble.classList.toggle("below", !above);
  }

  /* ---------- Réactions publiques ---------- */
  async react(kind) {
    if (!this.enabled || this.hanging || this.sleeping) return;
    if (kind === "pr" || kind === "party") {
      if (kind === "pr") {
        const l = coachLine("pr");
        if (l) setTimeout(() => this.say(l, { mood: "party", ms: 3400 }), 900);
      }
      return this.run(async () => { this.burst(this.x, this.y - 10, kind === "pr" ? 12 : 8); await this.flip(); });
    }
    if (kind === "happy") { this.mood("happy"); return this.run(() => this.wave()); }
    if (kind === "alert") { this.mood("alert"); return this.run(() => this.look()); }
  }

  setContext(ctx) {
    this.ctx = ctx;
    if (ctx === "live") this.wake();
    else { this.ghost(false); this.unpeek(); }
    if (!this.enabled || this.hanging) return;
    if (ctx === "live" && this.peeker) return this.run(() => this.lurk());
    const p = ctx === "live" ? this.livePerch() : this.perch(this.travel === "fly" ? pick(["air", "floor"]) : "floor");
    this.run(async () => { await (reduced() ? this.goto(p, 0) : this.moveTo(p)); this.checkCover(); });
  }

  // Après un changement d'écran : se repose sur le "sol" (au-dessus de la barre d'onglets).
  settle(tries = 0) {
    syncCoach(); // compte qui vient de se connecter, coach choisi sur un autre appareil…
    this.setTab();
    if (!this.enabled || this.hanging || this.dragging) return;
    if (this.busy) { if (tries < 8) setTimeout(() => this.settle(tries + 1), 300); return; }
    const b = this.bounds();
    if (this.surface === "air") { if (this.y > b.floor - H / 2 - 30) this.run(() => this.moveTo(this.perch("air"))); return; }
    if (this.surface === "floor" && Math.abs(this.y - (b.floor - H / 2)) > 3) this.run(() => this.goto({ x: this.x, y: b.floor - H / 2, rot: 0, surface: "floor" }, 350, ease.out));
    else if (this.y > b.floor - H / 2 + 3) this.run(() => this.moveTo(this.perch("floor")));
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
    if (!this.enabled || this.busy || this.hanging || this.dragging || this.sleeping || this.swapping || document.hidden) return this.schedule();
    if (reduced()) { if (Math.random() < 0.3) this.look(); return this.schedule(); }
    const live = this.ctx === "live";
    const tip = [async () => { if (!this.quiet) this.say(this.tip?.() || ""); }, 2];
    const t = this.travel;
    const options = live && this.peeker
      ? [[() => this.lurk(), 3], [() => this.look(), 3]]
      : live
      ? [[() => this.stroll(), 4], [() => this.look(), 3], [() => this.moveTo(this.livePerch()), 2]]
      : t === "web"
        ? [[() => this.crawl(), 4], [() => this.zip(this.perch()), 3], [() => this.swing(), 2], [() => this.look(), 2], [() => this.wave(), 1], [() => this.flip(), 1], tip]
        : t === "fly"
          ? [[() => this.stroll(), 4], [() => this.moveTo(this.perch()), 2], [() => this.loop(), 2], [() => this.look(), 2], [() => this.wave(), 1], tip]
          : [[() => this.stroll(), 4], [() => this.moveTo(this.perch()), this.climbs ? 3 : 1], [() => this.showoff(), 2], [() => this.look(), 2], [() => this.wave(), 1], [() => this.flip(), 1], tip];
    const total = options.reduce((a, o) => a + o[1], 0);
    let r = Math.random() * total;
    const fn = options.find(o => (r -= o[1]) < 0)[0];
    await this.run(fn);
    if (live) this.checkCover();
    this.schedule();
  }

  /* ---------- Glisser / toucher ---------- */
  bindPointer() {
    let sx, sy, moved = false;
    this.el.addEventListener("pointerdown", e => {
      if (this.hanging || this.swapping) return;
      e.preventDefault();
      this.el.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY; moved = false; this.dragging = true;
    });
    this.el.addEventListener("pointermove", e => {
      if (!this.dragging) return;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
      if (!moved) { moved = true; this.busy = true; if (this.peekDepth) { this.peekDepth = null; this.el.classList.remove("peek"); } this.anchor = null; this.sq = 1; this.pose("dangle"); this.rot = 0; this.ghost(false); }
      this.x = e.clientX; this.y = e.clientY + H / 3; this.render();
    });
    const up = async () => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!moved) { this.busy = false; return this.tap(); }
      this.busy = false;
      await this.run(() => this.release());
      this.checkCover();
      this.schedule();
    };
    this.el.addEventListener("pointerup", up);
    this.el.addEventListener("pointercancel", up);
  }

  tap() {
    if (this.wake()) return this.say("Ah ! Je suis réveillé. On s'entraîne ?", { mood: "happy" });
    const own = coachLine("tap");
    if (own && this.ctx !== "live" && !this.quiet && Math.random() < 0.5) {
      this.react(Math.random() < 0.5 ? "party" : "happy");
      return this.say(own);
    }
    this.onTap?.();
  }

  // Relâché : la toile vers le bord le plus proche, un bond vers un mur, le vol sur place… ou la chute.
  async release() {
    const b = this.bounds();
    this.x = clamp(this.x, 26, innerWidth - 26);
    this.y = clamp(this.y, b.top + 20, b.floor - H / 2);
    if (this.travel === "fly") {
      if (b.floor - this.y < H) return this.flyTo({ x: this.x, y: b.floor - H / 2, rot: 0, surface: "floor" });
      this.surface = "air"; this.rot = 0; this.pose("float"); this.render();
      return;
    }
    if (this.climbs) {
      const d = { floor: b.floor - this.y, ceiling: this.y - b.top, wallL: this.x, wallR: innerWidth - this.x };
      const surface = Object.entries(d).sort((a, c) => a[1] - c[1])[0][0];
      const p = this.perch(surface);
      if (surface === "wallL" || surface === "wallR") p.y = Math.min(b.floor - 80, Math.max(b.top + 80, this.y));
      else p.x = Math.min(innerWidth - 40, Math.max(40, surface === "floor" ? this.safeX(this.x) : this.x));
      return this.travel === "web" ? this.zip(p) : this.leap(p, { apex: 30 });
    }
    // chute libre jusqu'au sol, puis atterrissage écrasé
    const y0 = this.y, d = Math.max(0, b.floor - H / 2 - y0);
    Object.assign(this, { rot: 0, surface: "floor" });
    this.pose("drop");
    await this.tween(Math.sqrt((2 * d) / 0.0032), t => { this.y = y0 + d * t * t; });
    return this.squash(0.72, 380);
  }
}

export const spidey = new Coach();
