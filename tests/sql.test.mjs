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
