// SQL des comptes et des amis, exécuté sur un vrai Postgres (PGlite).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec("create schema extensions; create role anon; create role authenticated;");
for (const f of ["supabase/schema.sql", "supabase/002_social.sql"]) {
  const sql = fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  await db.exec(sql); await db.exec(sql); // relançable
}
const call = async (fn, ...args) => {
  await db.exec("set role anon");
  try { return (await db.query(`select public.${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as r`, args)).rows[0].r; }
  finally { await db.exec("reset role"); }
};

test("inscription, connexion, blocage après 5 essais", async () => {
  const a = await call("gt_signup", "miles", "1234");
  assert.equal(a.token.length, 64);
  assert.equal((await call("gt_signup", "Miles", "9999")).error, "USERNAME_TAKEN");
  assert.ok((await call("gt_login", "miles", "1234")).token);
  for (let i = 0; i < 4; i++) assert.equal((await call("gt_login", "miles", "0000")).error, "BAD_CREDENTIALS");
  assert.equal((await call("gt_login", "miles", "0000")).error, "LOCKED");
  assert.equal((await call("gt_login", "miles", "1234")).error, "LOCKED");
  await db.exec("update gt_accounts set locked_until = null, failed = 0");
});

test("les tables ne sont pas lisibles directement", async () => {
  await db.exec("set role anon");
  await assert.rejects(db.query("select * from gt_accounts"));
  await assert.rejects(db.query("select * from gt_friends"));
  await db.exec("reset role");
});

test("amis : demande, acceptation, résumé public, suppression", async () => {
  const m = (await call("gt_login", "miles", "1234")).token;
  const g = (await call("gt_signup", "gwen", "4321")).token;
  await call("gt_push", g, JSON.stringify({ profile: { name: "Gwen" }, public: { name: "Gwen", xp: 300 } }));
  assert.equal((await call("gt_friend_request", m, "nobody")).error, "NOT_FOUND");
  assert.equal((await call("gt_friend_request", m, "miles")).error, "SELF");
  assert.equal((await call("gt_friend_request", m, "gwen")).status, "pending");
  let gf = (await call("gt_friends", g)).friends;
  assert.equal(gf[0].status, "incoming");
  assert.equal((await call("gt_friends", m)).friends[0].public.xp, undefined); // pas de stats avant acceptation
  await call("gt_friend_respond", g, "miles", true);
  const mf = (await call("gt_friends", m)).friends;
  assert.equal(mf[0].status, "accepted");
  assert.equal(mf[0].public.xp, 300);
  await call("gt_friend_remove", m, "gwen");
  assert.equal((await call("gt_friends", g)).friends.length, 0);
});

test("demande croisée = amitié directe", async () => {
  const m = (await call("gt_login", "miles", "1234")).token;
  const g = (await call("gt_login", "gwen", "4321")).token;
  await call("gt_friend_request", g, "miles");
  assert.equal((await call("gt_friend_request", m, "gwen")).status, "accepted");
});

test("rappels push : abonnement, envoi une fois par jour de séance", async () => {
  const sql = fs.readFileSync(new URL("../supabase/003_push.sql", import.meta.url), "utf8");
  await db.exec(sql); await db.exec(sql);
  const m = (await call("gt_login", "miles", "1234")).token;
  const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "x", auth: "y" } };
  assert.equal((await call("gt_push_subscribe", m, { endpoint: "http://bad" }, "Europe/Paris")).error, "BAD_SUB");
  assert.ok((await call("gt_push_subscribe", m, sub, "Europe/Paris")).ok);
  await assert.rejects(call("gt_push_due", "2026-10-12T16:00:00Z")); // réservé au serveur
  // lundi 12 octobre 2026 : séance prévue (jour 0) à 18:00, rappel 15 min avant
  await call("gt_push", m, JSON.stringify({ sessions: [], reminders: { at: "18:00", before: 15, days: { 0: "Haut du corps" } } }));
  const due = async iso => (await db.query("select * from gt_push_due($1)", [iso])).rows;
  assert.equal((await due("2026-10-12T15:30:00Z")).length, 0); // 17:30 à Paris : trop tôt
  const r = await due("2026-10-12T15:50:00Z");                  // 17:50
  assert.equal(r.length, 1);
  assert.equal(r[0].title, "Séance du jour : Haut du corps");
  assert.equal(r[0].sub.keys.auth, "y");
  assert.equal((await due("2026-10-12T16:05:00Z")).length, 0);  // déjà envoyé aujourd'hui
  assert.equal((await due("2026-10-13T15:50:00Z")).length, 0);  // mardi : pas de séance
  // lundi suivant, séance déjà faite : pas de rappel
  await call("gt_push", m, JSON.stringify({ sessions: [{ date: Date.parse("2026-10-19T07:00:00Z") }], reminders: { at: "18:00", before: 15, days: { 0: "Haut du corps" } } }));
  assert.equal((await due("2026-10-19T15:50:00Z")).length, 0);
  await db.query("select gt_push_gone($1)", [["https://push.example/abc"]]);
  assert.equal((await db.query("select count(*)::int n from gt_push_subs")).rows[0].n, 0);
});

test("IA en ligne : jeton vérifié et limite de messages par jour", async () => {
  const sql = fs.readFileSync(new URL("../supabase/004_ai.sql", import.meta.url), "utf8");
  await db.exec(sql); await db.exec(sql);
  const m = (await call("gt_login", "miles", "1234")).token;
  await assert.rejects(call("gt_ai_take", m, 3)); // réservé au serveur
  const take = async (t, lim) => (await db.query("select gt_ai_take($1, $2) as r", [t, lim])).rows[0].r;
  assert.equal((await take("faux", 3)).error, "BAD_TOKEN");
  assert.equal((await take(m, 3)).remaining, 2);
  assert.equal((await take(m, 3)).user, "miles");
  assert.equal((await take(m, 3)).remaining, 0);
  assert.equal((await take(m, 3)).error, "LIMIT");
});

test("notifications des défis entre amis : dépassé, duel, fin de duel, jamais la nuit", async () => {
  const sql = fs.readFileSync(new URL("../supabase/005_social_push.sql", import.meta.url), "utf8");
  await db.exec(sql); await db.exec(sql);
  const m = (await call("gt_login", "miles", "1234")).token;
  const g = (await call("gt_login", "gwen", "4321")).token;
  assert.equal((await call("gt_friends", m)).friends.find(f => f.username === "gwen")?.status, "accepted");
  await call("gt_push_subscribe", m, { endpoint: "https://push.example/miles", keys: { p256dh: "x", auth: "y" } }, "Europe/Paris");
  await assert.rejects(call("gt_push_social", "2026-10-14T10:00:00Z")); // réservé au serveur
  const ws = Date.parse("2026-10-11T22:00:00Z"); // lundi 12 octobre 2026, 0 h à Paris
  const week = (volume, count = 1) => ({ start: ws, volume, count, minutes: 60, prs: 0 });
  const pushAs = (t, name, wk, duels = [], mine = []) => call("gt_push", t, JSON.stringify({ duels: mine, public: { name, week: wk, duels } }));
  const run = async iso => (await db.query("select * from gt_push_social($1)", [iso])).rows;
  await pushAs(m, "Miles", week(5000));
  await pushAs(g, "Gwen", week(4000));
  assert.equal((await run("2026-10-14T10:00:00Z")).length, 0); // mercredi midi : Miles devant, rien à dire
  await pushAs(g, "Gwen", week(6200));
  const over = await run("2026-10-14T10:15:00Z");
  assert.equal(over.length, 1);
  assert.equal(over[0].endpoint, "https://push.example/miles");
  assert.equal(over[0].title, "⚡ Gwen t'a dépassé");
  assert.equal(over[0].body, "Gwen : 6 200 kg cette semaine, toi 5 000 kg. À toi de jouer !");
  assert.equal((await run("2026-10-14T10:30:00Z")).length, 0); // une seule fois par semaine
  // invitation à un duel, mais pas la nuit
  await pushAs(g, "Gwen", week(6200, 2), [{ u: "miles", m: "count", w: ws }]);
  assert.equal((await run("2026-10-14T20:30:00Z")).length, 0); // 22 h 30 à Paris
  const inv = await run("2026-10-15T07:30:00Z");                 // jeudi 9 h 30
  assert.equal(inv[0].title, "⚔️ Gwen te défie en duel");
  assert.match(inv[0].body, /Épreuve : nombre de séances jusqu'à dimanche/);
  assert.equal((await run("2026-10-15T08:00:00Z")).length, 0);
  // Miles relève le défi ; dimanche soir, Gwen mène : dernier rappel
  await pushAs(m, "Miles", week(5000, 1), [{ u: "gwen", m: "count", w: ws }], [{ id: "d1", u: "gwen", m: "count", w: ws, by: "gwen" }]);
  assert.equal((await run("2026-10-18T15:00:00Z")).length, 0); // dimanche 17 h : trop tôt
  const end = await run("2026-10-18T17:00:00Z");
  assert.equal(end[0].title, "⏳ Dernières heures du duel");
  assert.equal((await run("2026-10-18T17:30:00Z")).length, 0);
  await db.query("select gt_push_gone($1)", [["https://push.example/miles"]]);
});

test("rappels pour boire : en retard sur le rythme, dans la plage horaire, au plus toutes les 2 h", async () => {
  const sql = fs.readFileSync(new URL("../supabase/006_water_push.sql", import.meta.url), "utf8");
  await db.exec(sql); await db.exec(sql);
  const m = (await call("gt_login", "miles", "1234")).token;
  await call("gt_push_subscribe", m, { endpoint: "https://push.example/water", keys: { p256dh: "x", auth: "y" } }, "Europe/Paris");
  await assert.rejects(call("gt_push_water", "2026-10-14T10:00:00Z")); // réservé au serveur
  const run = async iso => (await db.query("select * from gt_push_water($1)", [iso])).rows;
  const data = (water, sessions = []) => JSON.stringify({ sessions, food: { "2026-10-14": { items: [], water } },
    reminders: { at: "18:00", days: {}, water: { from: "09:00", to: "21:00", every: 2, goal: 10 } } });
  await call("gt_push", m, data(0));
  assert.equal((await run("2026-10-14T05:00:00Z")).length, 0); // 7 h à Paris : avant la plage
  const r = await run("2026-10-14T09:00:00Z");                  // 11 h : 0 verre, on en attendait 1
  assert.equal(r.length, 1);
  assert.equal(r[0].title, "Pense à boire 💧");
  assert.equal(r[0].body, "Tu en es à 0 L sur 2,5 L aujourd'hui. Un grand verre ?");
  assert.equal((await run("2026-10-14T10:00:00Z")).length, 0); // 1 h plus tard : trop tôt pour un autre rappel
  await call("gt_push", m, data(6));
  assert.equal((await run("2026-10-14T11:30:00Z")).length, 0); // 13 h 30 : 6 verres sur 10, dans les temps
  await call("gt_push", m, data(3, [{ date: Date.parse("2026-10-14T06:00:00Z") }]));
  const t = await run("2026-10-14T15:00:00Z");                  // 17 h, jour d'entraînement : objectif 12 verres
  assert.equal(t[0].body, "Tu en es à 0,75 L sur 3 L aujourd'hui. Un grand verre ?");
  assert.equal((await run("2026-10-14T20:00:00Z")).length, 0); // 22 h : jamais la nuit
  await call("gt_push", m, data(12));
  assert.equal((await run("2026-10-14T18:00:00Z")).length, 0); // objectif atteint : silence
  await db.query("select gt_push_gone($1)", [["https://push.example/water"]]);
});

test("ligue entre amis : dépassé au classement de la saison, dernier jour (descente, juste derrière la montée)", async () => {
  const sql = fs.readFileSync(new URL("../supabase/007_league_push.sql", import.meta.url), "utf8");
  await db.exec(sql); await db.exec(sql);
  const m = (await call("gt_login", "miles", "1234")).token;
  const g = (await call("gt_login", "gwen", "4321")).token;
  const p = (await call("gt_signup", "peter", "1111")).token;
  await call("gt_friend_request", m, "peter"); await call("gt_friend_respond", p, "miles", true);
  await call("gt_push_subscribe", m, { endpoint: "https://push.example/league", keys: { p256dh: "x", auth: "y" } }, "Europe/Paris");
  await assert.rejects(call("gt_push_league", "2026-10-14T10:00:00Z")); // réservé au serveur
  const run = async iso => (await db.query("select * from gt_push_league($1)", [iso])).rows;
  const end10 = Date.parse("2026-11-29T23:00:00Z"); // lundi 30 novembre, 0 h à Paris (après les essais des défis)
  const pushAs = (t, name, pts, s = 10, end = end10) => call("gt_push", t, JSON.stringify({ public: { name, league: { s, end, div: 1, pts, last: { s: s - 1, pts: 300 } } } }));
  await pushAs(m, "Miles", 200); await pushAs(g, "Gwen", 150); await pushAs(p, "Peter", 0, 9, Date.parse("2026-11-01T23:00:00Z")); // Peter : saison d'avant
  assert.equal((await run("2026-11-25T10:00:00Z")).length, 0); // Miles devant
  await pushAs(g, "Gwen", 260);
  const over = await run("2026-11-25T10:15:00Z");
  assert.equal(over.length, 1);
  assert.equal(over[0].endpoint, "https://push.example/league");
  assert.equal(over[0].title, "🎖️ Gwen te passe devant en ligue");
  assert.equal(over[0].body, "Gwen : 260 pts cette saison, toi 200 pts. Une séance pour reprendre ta place ?");
  assert.equal((await run("2026-11-25T10:30:00Z")).length, 0); // une fois par ami et par saison
  // dernier jour : Miles en zone de descente (3e sur 3, sous 160 points)
  await pushAs(m, "Miles", 120); await pushAs(p, "Peter", 300);
  const peter = await run("2026-11-29T13:00:00Z"); // dimanche 14 h : Peter passe devant (Miles menait au début)
  assert.equal(peter[0]?.title, "🎖️ Peter te passe devant en ligue");
  assert.equal((await run("2026-11-29T15:00:00Z")).length, 0); // 16 h : trop tôt pour le dernier jour
  assert.equal((await run("2026-11-29T21:00:00Z")).length, 0); // 22 h : jamais la nuit
  const down = await run("2026-11-29T16:30:00Z");
  assert.equal(down[0]?.title, "⏳ Dernier jour de la saison");
  assert.equal(down[0].body, "Tu es en zone de descente : 40 pts pour assurer ton maintien. Une séance ce soir ?");
  assert.equal((await run("2026-11-29T17:00:00Z")).length, 0); // une fois par saison
  assert.equal((await run("2026-11-30T08:00:00Z")).length, 0); // saison finie : plus rien
  // saison suivante : Miles 2e, juste derrière la zone de montée
  const end11 = Date.parse("2026-12-27T23:00:00Z");
  await pushAs(m, "Miles", 270, 11, end11); await pushAs(g, "Gwen", 260, 11, end11); await pushAs(p, "Peter", 300, 11, end11);
  const up = await run("2026-12-27T16:30:00Z");
  assert.equal(up[0]?.body, "Plus que 31 pts pour passer devant Peter et monter de division !");
  await db.query("select gt_push_gone($1)", [["https://push.example/league"]]);
});
