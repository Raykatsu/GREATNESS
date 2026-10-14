// Ligues et saisons entre amis : saisons de 4 semaines, points, classement, montée et descente.
import test from "node:test";
import assert from "node:assert/strict";
import { seasonOf, seasonStart, seasonEnd, weekStats, weekPoints, seasonPoints, leaguePublic, pointsOf, standings, outcome, settleLeague,
  resultText, nextStep, DIVS, SAFE, MIN_UP, SOLO_UP } from "../js/league.js";
import { weeklyChallenge } from "../js/rivals.js";
import { mergeData } from "../js/merge.js";

const D = 864e5;
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const sess = (date, min = 50, prs = 0) => ({ id: String(date) + min, date, durationSec: min * 60, volume: 1000, prs: Array(prs).fill("bench"), sets: [] });

test("saisons de 4 semaines, du lundi au dimanche (heure locale)", () => {
  assert.equal(seasonOf(new Date(2026, 0, 5)), 1);
  assert.equal(seasonOf(new Date(2026, 1, 1, 23)), 1);   // dimanche 1er février au soir
  assert.equal(seasonOf(new Date(2026, 1, 2)), 2);       // lundi 2 février
  assert.equal(seasonOf(new Date(2026, 9, 14)), 11);     // saison 11 : du 12 octobre au 8 novembre
  assert.equal(seasonStart(2), new Date(2026, 1, 2).getTime());
  assert.equal(seasonEnd(1), seasonStart(2));
  assert.equal(seasonStart(11) - seasonStart(10) > 27 * D, true);
});

test("points de la semaine : séances, minutes, records, défi réussi ; plafonnés", () => {
  const ws = new Date(2026, 9, 12).getTime(); // lundi 12 octobre
  const w = weekStats([sess(ws + D, 50, 1), sess(ws + 3 * D, 40), sess(ws + 5 * D, 30), sess(ws - D, 60)], ws);
  assert.deepEqual([w.count, w.minutes, w.prs], [3, 120, 1]);
  const ch = weeklyChallenge(new Date(ws + D)), bonus = ch.val({ week: w }) >= ch.goal ? 25 : 0;
  assert.equal(weekPoints(w), 3 * 20 + 60 + 15 + bonus);
  // plafonds : 6 séances, 6 h
  const many = weekStats(Array.from({ length: 9 }, (_, i) => sess(ws + (i % 7) * D + i * 1000, 90)), ws);
  const chm = weeklyChallenge(new Date(ws + D));
  assert.equal(weekPoints(many), 6 * 20 + 360 / 2 + (chm.val({ week: many }) >= chm.goal ? 25 : 0));
  // le défi de la semaine rapporte 25 points
  for (let k = 0; k < 8; k++) {
    const wk = ws + k * 7 * D, c = weeklyChallenge(new Date(wk + D));
    if (c.m !== "count") continue;
    const four = weekStats([1, 2, 3, 4].map(i => sess(wk + i * D, 10)), wk), three = weekStats([1, 2, 3].map(i => sess(wk + i * D, 10)), wk);
    assert.equal(weekPoints(four) - weekPoints(three), 20 + 5 + 25);
    return;
  }
  assert.fail("pas de semaine « 4 séances » trouvée");
});

test("points de la saison et résumé public", () => {
  const s = 10, start = seasonStart(s), now = start + 9 * D; // 2e semaine de la saison
  const sessions = [sess(start + D), sess(start + 8 * D), sess(start - 2 * D)];
  const sp = seasonPoints(sessions, s, now);
  assert.equal(sp.weeks.length, 4);
  assert.deepEqual(sp.weeks.slice(2), [null, null]);
  assert.equal(sp.total, sp.weeks[0] + sp.weeks[1]);
  assert.ok(sp.weeks[0] >= 45);
  const pub = leaguePublic({ sessions, league: { div: 2 } }, now);
  assert.deepEqual([pub.s, pub.div, pub.pts, pub.end, pub.last.s], [10, 2, sp.total, seasonEnd(10), 9]);
  assert.ok(pub.last.pts > 0);
  // points d'un ami : saison en cours, ou la précédente s'il a déjà changé de saison
  assert.equal(pointsOf({ league: { s: 10, pts: 300 } }, 10), 300);
  assert.equal(pointsOf({ league: { s: 11, pts: 20, last: { s: 10, pts: 280 } } }, 10), 280);
  assert.equal(pointsOf({ league: { s: 8, pts: 999 } }, 10), 0);
  assert.equal(pointsOf({}, 10), 0);
});

test("classement : zones de montée et de descente (un tiers), égalité en ma faveur", () => {
  const friend = (u, pts, div = 0) => ({ username: u, public: { name: u.toUpperCase(), league: { s: 5, pts, div } } });
  const t = standings({ username: "me", name: "Moi", pts: 200, div: 1 }, [friend("a", 300), friend("b", 200, 3), friend("c", 50), friend("d", 120)], 5);
  assert.deepEqual(t.map(r => [r.me ? "moi" : r.username, r.rank, r.up, r.down]), [["a", 1, true, false], ["moi", 2, true, false], ["b", 3, false, false], ["d", 4, false, true], ["c", 5, false, true]]);
  assert.equal(t.find(r => r.username === "b").div, 3);
  const two = standings({ name: "Moi", pts: 10 }, [friend("a", 300)], 5);
  assert.ok(two.every(r => !r.up && !r.down)); // à deux : pas de zones, les paliers comptent
});

test("montée, maintien, descente", () => {
  assert.deepEqual(outcome(1, 1, 6, 300), { to: 2, move: 1 });      // dans le premier tiers, assez de points
  assert.deepEqual(outcome(1, 1, 6, MIN_UP - 1), { to: 1, move: 0 }); // en tête mais trop peu actif
  assert.deepEqual(outcome(1, 6, 6, SAFE - 1), { to: 0, move: -1 });  // dernier, peu actif : descend
  assert.deepEqual(outcome(1, 6, 6, SAFE), { to: 1, move: 0 });       // dernier mais assez actif : maintien
  assert.deepEqual(outcome(0, 6, 6, 0), { to: 0, move: 0 });          // jamais sous le Bronze
  assert.deepEqual(outcome(5, 1, 6, 900), { to: 5, move: 0 });        // la Légende est le sommet
  assert.deepEqual(outcome(0, 1, 1, SOLO_UP[0]), { to: 1, move: 1 }); // seul : palier atteint
  assert.deepEqual(outcome(2, 1, 2, SOLO_UP[2] - 1), { to: 2, move: 0 });
  assert.deepEqual(outcome(2, 2, 2, 20), { to: 1, move: -1 });
});

test("fin de saison : réglée une fois, résultat, historique, texte", () => {
  const s10 = seasonStart(10), st = { sessions: [] };
  assert.equal(settleLeague(st, [], s10 + 3 * D), null); // première fois : on démarre en Bronze
  assert.deepEqual([st.league.div, st.league.season], [0, 10]);
  // une bonne saison seul : 5 séances par semaine
  for (let w = 0; w < 4; w++) for (let d = 0; d < 5; d++) st.sessions.push(sess(s10 + (w * 7 + d) * D, 45));
  assert.equal(settleLeague(st, [], s10 + 20 * D), null); // même saison
  const r = settleLeague(st, [], seasonStart(11) + 2 * D);
  assert.deepEqual([r.s, r.from, r.to, r.move, r.n], [10, 0, 1, 1, 1]);
  assert.ok(r.pts >= SOLO_UP[0]);
  assert.deepEqual([st.league.div, st.league.season, st.league.history.length], [1, 11, 1]);
  assert.equal(resultText(r), "Saison 10 terminée : tu montes en Argent 🥈 !");
  assert.equal(settleLeague(st, [], seasonStart(11) + 5 * D), null);
  // avec des amis : dernier et inactif → descente
  const friends = [{ username: "a", public: { name: "Ana", league: { s: 11, pts: 400 } } }, { username: "b", public: { name: "Bo", league: { s: 12, pts: 10, last: { s: 11, pts: 380 } } } }];
  const r2 = settleLeague(st, friends, seasonStart(12) + D);
  assert.deepEqual([r2.rank, r2.n, r2.move, r2.to], [3, 3, -1, 0]);
  assert.equal(resultText(r2), "Saison 11 terminée : tu redescends en Bronze. Nouvelle saison, nouvelle chance !");
  assert.equal(resultText({ s: 3, rank: 2, n: 4, pts: 250, to: 2, move: 0 }), "Saison 3 terminée : 2e sur 4, tu restes en Or 🥇 (250 points).");
});

test("ce qu'il manque pour monter ou se maintenir", () => {
  const f = (u, pts) => ({ username: u, public: { name: u, league: { s: 1, pts } } });
  const t = (pts, list) => standings({ username: "me", name: "Toi", pts }, list.map(([u, p]) => f(u, p)), 1);
  assert.equal(nextStep(t(150, [["Ana", 200], ["Bo", 100]]), 1), "51 pts pour passer devant Ana et entrer dans la zone de montée");
  assert.equal(nextStep(t(300, [["Ana", 200], ["Bo", 100]]), 1), "Zone de montée : tu montes en Or si tu tiens jusqu'au bout !");
  assert.equal(nextStep(t(100, [["Ana", 200], ["Bo", 150]]), 1), `Zone de descente : ${SAFE - 100} pts pour assurer ton maintien`);
  assert.equal(nextStep(t(120, []), 0), `Encore ${SOLO_UP[0] - 120} pts pour monter en Argent`);
  assert.equal(nextStep(t(SOLO_UP[0], []), 0), "Palier atteint : tu montes en Argent à la fin de la saison !");
  assert.equal(nextStep(t(9999, []), DIVS.length - 1), "Tu es au sommet : garde ta place !");
});

test("synchro : la fin de saison la plus récente gagne, l'historique est réuni", () => {
  const a = { meta: { updatedAt: 200 }, league: { div: 1, season: 11, at: 5, history: [{ s: 10, to: 1 }] } };
  const b = { meta: { updatedAt: 100 }, league: { div: 0, season: 10, at: 9, history: [{ s: 9, to: 0 }] } };
  const m = mergeData(a, b);
  assert.deepEqual([m.league.div, m.league.season], [1, 11]);
  assert.deepEqual(m.league.history.map(h => h.s), [9, 10]);
  assert.equal(mergeData({ meta: {} }, { meta: {} }).league, undefined);
});
