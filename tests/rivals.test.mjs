// Défis entre amis : dépassements au classement, records, duels (invitation, acceptation, résultat),
// résultats du défi de la semaine, sans doublon d'une synchronisation à l'autre.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEvents, duelWith, duelScore, duelRecord, unread, mondayOf, weeklyChallenge, sameWeek, weekOf, METRICS } from "../js/rivals.js";

const DAY = 864e5, WEEK = 7 * DAY;
const now = new Date(2026, 9, 14, 12).getTime(); // mercredi
const ws = mondayOf(new Date(now)).getTime();
const wk = (start, volume = 0, count = 0, minutes = 0, prs = 0) => ({ start, volume, count, minutes, prs });
const leo = (week, extra = {}) => ({ username: "leo", status: "accepted", public: { name: "Léo", week, last: wk(ws - WEEK, 9000, 4, 200, 1), duels: [], prs: [], ...extra } });
const mine = (volume, last = wk(ws - WEEK, 8000, 3, 150, 2)) => ({ week: wk(ws, volume, 2, 100, 0), last });

test("semaines et défi de la semaine", () => {
  assert.equal(new Date(ws).getDay(), 1);
  assert.ok(sameWeek(ws, ws + 3600e3) && !sameWeek(ws, ws + WEEK));
  assert.equal(weekOf({ week: wk(ws, 5) }, ws).volume, 5);
  assert.equal(weekOf({ week: wk(ws, 5) }, ws - WEEK).volume, 0);
  assert.ok(weeklyChallenge(new Date(now)).name);
  assert.equal(METRICS.volume.fmt(12400), "12 400 kg");
});

test("dépassement au classement, puis on repasse devant ; pas de doublon", () => {
  let social = {};
  const r1 = computeEvents(social, { me: "sam", mine: mine(5000), friends: [leo(wk(ws, 4000))], now });
  assert.ok(!r1.events.some(e => e.kind === "over" || e.kind === "pass")); // premier passage : on mémorise seulement
  const weekly = r1.events.find(e => e.kind === "weekly");
  assert.match(weekly.text, /tu termines 2e sur 2/); // défi de la semaine passée
  social = r1.social;
  const r2 = computeEvents(social, { me: "sam", mine: mine(5000), friends: [leo(wk(ws, 6200))], now: now + 1000 });
  assert.equal(r2.events.length, 1);
  assert.equal(r2.events[0].kind, "over");
  assert.match(r2.events[0].text, /Léo t'a dépassé au classement : 6 200 kg contre 5 000 kg/);
  social = r2.social;
  const r3 = computeEvents(social, { me: "sam", mine: mine(5000), friends: [leo(wk(ws, 6300))], now: now + 2000 });
  assert.equal(r3.events.length, 0); // toujours devant : rien de neuf
  const r4 = computeEvents(r3.social, { me: "sam", mine: mine(7000), friends: [leo(wk(ws, 6300))], now: now + 3000 });
  assert.deepEqual(r4.events.map(e => e.kind), ["pass"]);
  assert.equal(unread(r4.social), 3); // résultats de la semaine, dépassé, repassé devant
  assert.equal(r4.social.feed[0].kind, "pass");
});

test("records récents d'un ami", () => {
  const first = computeEvents({}, { me: "sam", mine: mine(0), friends: [leo(wk(ws), { prs: [{ n: "Squat", v: 110, unit: "kg", d: now - 5 * DAY }] })], now });
  assert.ok(!first.events.some(e => e.kind === "pr")); // l'historique ne s'affiche pas d'un coup
  const next = computeEvents(first.social, { me: "sam", mine: mine(0), friends: [leo(wk(ws), { prs: [{ n: "Squat", v: 120, unit: "kg", d: now - 3600e3 }, { n: "Squat", v: 110, unit: "kg", d: now - 5 * DAY }] })], now });
  assert.deepEqual(next.events.map(e => e.text), ["Léo a battu un record : Squat (120 kg)."]);
});

test("duel : invitation, acceptation, score, résultat la semaine suivante", () => {
  const inv = { u: "sam", m: "count", w: ws, by: "leo" };
  const r1 = computeEvents({}, { me: "sam", mine: mine(3000), friends: [leo(wk(ws, 2000, 1), { duels: [inv] })], now });
  const e = r1.events.find(x => x.kind === "inv");
  assert.match(e.text, /Léo te défie en duel cette semaine : nombre de séances/);
  const again = computeEvents(r1.social, { me: "sam", mine: mine(3000), friends: [leo(wk(ws, 2000, 1), { duels: [inv] })], now: now + 1000 });
  assert.ok(!again.events.some(x => x.kind === "inv"));
  assert.equal(duelWith("sam", [], "leo", { duels: [inv] }, ws).status, "invited");
  const myDuels = [{ id: "d1", u: "leo", m: "count", w: ws, by: "leo" }];
  const d = duelWith("sam", myDuels, "leo", { duels: [inv] }, ws);
  assert.equal(d.status, "active");
  assert.deepEqual(duelScore(d, mine(3000).week, { week: wk(ws, 2000, 1) }), { me: 2, them: 1, lead: 1 });
  assert.ok(!computeEvents(again.social, { me: "sam", mine: mine(3000), myDuels, friends: [leo(wk(ws, 2000, 1), { duels: [inv] })], now }).events.some(x => x.kind === "acc"));
  // semaine suivante : le duel est réglé une seule fois
  const ws2 = ws + WEEK, me2 = { week: wk(ws2), last: wk(ws, 3000, 3, 100, 0) };
  const leo2 = { username: "leo", public: { name: "Léo", week: wk(ws2), last: wk(ws, 2500, 2), duels: [inv] } };
  const r2 = computeEvents(again.social, { me: "sam", mine: me2, myDuels, friends: [leo2], now: ws2 + DAY });
  const res = r2.events.find(x => x.kind === "duel");
  assert.match(res.text, /Duel gagné contre Léo 🏆 3 séances contre 2 séances/);
  assert.deepEqual(r2.log.map(l => [l.u, l.res, l.me, l.them]), [["leo", "win", 3, 2]]);
  const r3 = computeEvents(r2.social, { me: "sam", mine: me2, myDuels, friends: [leo2], now: ws2 + DAY + 1000 });
  assert.equal(r3.log.length, 0);
  assert.ok(!r3.events.some(x => x.kind === "duel"));
  assert.deepEqual(duelRecord([...r2.log, { res: "loss" }]), { win: 1, loss: 1, draw: 0 });
});

test("mon duel accepté par l'ami", () => {
  const myDuels = [{ id: "d2", u: "zoe", m: "volume", w: ws, by: "sam" }];
  const zoe = d => ({ username: "zoe", public: { name: "Zoé", week: wk(ws, 1000), duels: d } });
  const r1 = computeEvents({}, { me: "sam", mine: mine(2000), myDuels, friends: [zoe([])], now });
  assert.equal(duelWith("sam", myDuels, "zoe", zoe([]).public, ws).status, "pending");
  assert.ok(!r1.events.some(e => e.kind === "acc"));
  const r2 = computeEvents(r1.social, { me: "sam", mine: mine(2000), myDuels, friends: [zoe([{ u: "sam", m: "volume", w: ws, by: "sam" }])], now });
  assert.deepEqual(r2.events.filter(e => e.kind === "acc").map(e => e.text), ["Zoé a accepté ton duel (volume soulevé). Que le meilleur gagne !"]);
});
