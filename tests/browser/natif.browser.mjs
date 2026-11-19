// L'app iPhone simulée dans le navigateur (faux pont Capacitor : GreatnessPlugin et Apple Santé) : la voix du coach
// baisse la musique le temps de parler ; pendant le repos, la Live Activity reçoit l'exercice, le morceau qui joue
// (titre, pochette) et l'accent de l'app ; la fréquence cardiaque de la montre s'affiche en séance puis en fin de
// séance, et reste avec la séance ; Santé déjà reliée : la fréquence cardiaque est demandée une fois. Aucune erreur.
import test from "node:test";
import assert from "node:assert/strict";
import { openApp, signup, seed, go, sleep, png } from "./kit.mjs";

test("app iPhone : morceau dans la Live Activity, cœur de la montre, le coach baisse la musique", { timeout: 180000 }, async () => {
  const app = await openApp();
  const { page, errors } = app;
  const art = `data:image/png;base64,${png(8, 8, () => [200, 40, 60]).toString("base64")}`;
  await page.addInitScript(art => {
    const calls = (window.__native = { rest: [], duck: [], auth: [] });
    // la montre : une mesure par seconde sur les 3 dernières minutes, entre 120 et 129 bpm (séance de test très courte)
    const heart = (from, to) => {
      const out = [], end = Math.min(to, Date.now());
      for (let t = Math.max(from, Date.now() - 180e3), i = 0; t <= end; t += 1e3, i++) {
        out.push({ startDate: new Date(t).toISOString(), endDate: new Date(t).toISOString(), value: 120 + (i % 10), unit: "bpm" });
      }
      return out;
    };
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "ios",
      Plugins: {
        Greatness: {
          restStart: async o => { calls.rest.push(o); return { ok: true }; },
          restEnd: async () => { calls.rest.push(null); },
          widgetSet: async () => {},
          musicNow: async () => ({ status: "authorized", title: "Numb", artist: "Linkin Park", playing: true, id: "1", genre: "Rock", art }),
          duck: async o => { calls.duck.push(o.on); return { ok: true }; },
          webAuth: async () => ({ cancelled: true }),
        },
        Health: {
          isAvailable: async () => ({ available: true }),
          requestAuthorization: async o => { calls.auth.push(o.read); return {}; },
          readSamples: async o => ({ samples: o.dataType === "heartRate" ? heart(Date.parse(o.startDate), Date.parse(o.endDate)) : [] }),
          queryAggregated: async () => ({ samples: [] }),
        },
      },
    };
    // voix simulée : chaque phrase « dure » 50 ms
    speechSynthesis.speak = u => setTimeout(() => { u.onstart?.(); setTimeout(() => u.onend?.(), 50); }, 10);
    speechSynthesis.cancel = () => {};
  }, art);
  await page.reload();
  await page.waitForSelector("#new");
  try {
    await signup(page, "natif", "2468");
    await seed(page);
    // Apple Santé déjà reliée (avant la fréquence cardiaque) ; consignes vocales coupées pour la séance
    await page.evaluate(async () => { const { state, save } = await import("/js/store.js"); state.health = { native: true }; state.profile.voice = false; save(); });
    // retour sur l'app : Santé est relue (même sans compte en ligne) et la fréquence cardiaque demandée une fois
    await page.evaluate(() => {
      const set = hidden => {
        Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
        Object.defineProperty(document, "visibilityState", { value: hidden ? "hidden" : "visible", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      };
      set(true); set(false);
    });
    await page.waitForFunction(() => window.__native.auth.length > 0, null, { timeout: 15000 });
    assert.ok(await page.evaluate(() => window.__native.auth[0].includes("heartRate")), "fréquence cardiaque demandée");

    // la voix du coach : la musique baisse, puis remonte après la phrase
    await page.evaluate(async () => (await import("/js/fx.js")).speak("Dernière série, donne tout !", { force: true }));
    await page.waitForFunction(() => window.__native.duck.length >= 2, null, { timeout: 5000 });
    assert.deepEqual(await page.evaluate(() => window.__native.duck), [true, false]);
    // réglage coupé : on ne touche plus au son
    await page.evaluate(async () => {
      const { state } = await import("/js/store.js");
      state.profile.music = { ...state.profile.music, duck: false };
      (await import("/js/fx.js")).speak("Repos", { force: true });
    });
    await sleep(700);
    assert.equal(await page.evaluate(() => window.__native.duck.length), 2);

    // une séance : la fréquence cardiaque de la montre dans l'en-tête
    await go(page, "#/train");
    await page.click('.prog[data-id="push"]'); await sleep(600);
    await page.click("#start").catch(() => {}); await sleep(600);
    await page.click("#ci-go"); await page.waitForSelector("#log", { timeout: 10000 });
    await page.waitForSelector("#hr:not([hidden])", { timeout: 10000 });
    const bpm = +(await page.$eval("#hr b", e => e.textContent));
    assert.ok(bpm >= 120 && bpm <= 129, `fréquence affichée : ${bpm}`);

    // une série, puis le repos : la Live Activity reçoit l'exercice, le morceau, sa pochette et l'accent
    await page.click("#log");
    await page.waitForFunction(() => window.__native.rest.some(r => r && r.song), null, { timeout: 10000 });
    const live = await page.evaluate(() => window.__native.rest.filter(Boolean).at(-1));
    assert.equal(live.song, "Numb · Linkin Park");
    assert.match(live.art, /^data:image\/png;base64,/);
    assert.match(live.tint, /^#[0-9a-f]{6}$/i);
    assert.ok(live.title && live.detail && live.end > live.start);

    // fin de séance : moyenne et maximum de la montre, gardés avec la séance
    await page.evaluate(() => document.querySelector("#rest-skip")?.click());
    await page.click("#quit"); await sleep(400);
    await page.click('.sheet [data-r="1"]');
    await page.waitForSelector("#fin-hr:not([hidden])", { timeout: 10000 });
    assert.match(await page.$eval("#fin-hr", e => e.innerText.replace(/\s+/g, " ")), /moyenne 12\d · max 12\d bpm/);
    const kept = await page.evaluate(async () => (await import("/js/store.js")).state.sessions.at(-1).hr);
    assert.ok(kept.avg >= 120 && kept.max <= 129 && kept.max >= kept.avg);
    assert.deepEqual(errors, []);
  } finally { await app.close(); }
});
