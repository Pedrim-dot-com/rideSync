import pg from "pg";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { runMapChecks } from "../tests/integration/maps.mjs";
import { runTripChecks } from "../tests/integration/trips.mjs";
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error(
    "Set TEST_DATABASE_URL to a disposable LOCAL PostgreSQL database. Bootstrap creates test roles and auth tables.",
  );
const parsed = new URL(url);
if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
  throw new Error("Only loopback test databases are allowed.");
const db = new pg.Client({ connectionString: url });
await db.connect();
let checks = 0;
try {
  await db.query(
    await readFile(
      new URL("../tests/integration/bootstrap.sql", import.meta.url),
      "utf8",
    ),
  );
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.query(await readFile(new URL(file, migrations), "utf8"));
  }
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002";
  await db.query("insert into auth.users(id) values ($1),($2)", [a, b]);
  assert.equal(
    (await db.query("select count(*) from public.profiles")).rows[0].count,
    "2",
  );
  checks++;
  const asUser = async (id, sql, args = []) => {
    await db.query("begin");
    try {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        id,
      ]);
      const result = await db.query(sql, args);
      await db.query("commit");
      return result;
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  };
  const bikeA = (
    await asUser(
      a,
      "insert into public.motorcycles(user_id,brand,model) values ($1,'Honda','CB500') returning id",
      [a],
    )
  ).rows[0].id;
  const bikeA2 = (
    await asUser(
      a,
      "insert into public.motorcycles(user_id,brand,model) values ($1,'Yamaha','MT07') returning id",
      [a],
    )
  ).rows[0].id;
  const bikeB = (
    await asUser(
      b,
      "insert into public.motorcycles(user_id,brand,model) values ($1,'BMW','GS') returning id",
      [b],
    )
  ).rows[0].id;
  assert.equal(
    (await asUser(a, "select * from public.motorcycles")).rowCount,
    2,
  );
  checks++;
  assert.equal(
    (
      await asUser(a, "update public.motorcycles set model=$1 where id=$2", [
        "stolen",
        bikeB,
      ])
    ).rowCount,
    0,
  );
  checks++;
  assert.equal(
    (await asUser(a, "delete from public.motorcycles where id=$1", [bikeB]))
      .rowCount,
    0,
  );
  checks++;
  await assert.rejects(
    asUser(
      a,
      "insert into public.motorcycles(user_id,brand,model) values ($1,'X','Y')",
      [b],
    ),
    (e) => e.code === "42501",
  );
  checks++;
  await assert.rejects(
    asUser(a, "update public.motorcycles set user_id=$1 where id=$2", [
      b,
      bikeA,
    ]),
    (e) => e.code === "42501",
  );
  checks++;
  await asUser(a, "select public.set_primary_motorcycle($1)", [bikeA]);
  await asUser(a, "select public.set_primary_motorcycle($1)", [bikeA2]);
  assert.equal(
    (await asUser(a, "select id from public.motorcycles where is_primary"))
      .rows[0].id,
    bikeA2,
  );
  checks++;
  await assert.rejects(
    asUser(a, "select public.set_primary_motorcycle($1)", [bikeB]),
    (e) => e.code === "42501",
  );
  checks++;
  assert.equal(
    (await asUser(a, "select id from public.motorcycles where is_primary"))
      .rows[0].id,
    bikeA2,
  );
  checks++;
  await assert.rejects(
    asUser(a, "update public.motorcycles set is_primary=true where id=$1", [
      bikeA,
    ]),
    (e) => e.code === "23505",
  );
  checks++;
  assert.equal((await asUser(a, "select * from public.profiles")).rowCount, 1);
  checks++;
  assert.equal(
    (
      await asUser(
        a,
        "update public.profiles set display_name='outsider' where id=$1",
        [b],
      )
    ).rowCount,
    0,
  );
  checks++;
  await asUser(
    a,
    "update public.profiles set username='rider_a',display_name='Rider A' where id=$1",
    [a],
  );
  checks++;
  await assert.rejects(
    asUser(b, "update public.profiles set username='rider_a' where id=$1", [b]),
    (e) => e.code === "23505",
  );
  checks++;
  await assert.rejects(
    asUser(
      a,
      "insert into public.motorcycles(user_id,brand,model,engine_cc) values ($1,'Honda','CB',0)",
      [a],
    ),
    (e) => e.code === "23514",
  );
  checks++;
  const parallelSwitch = async (id) => {
    const connection = new pg.Client({ connectionString: url });
    await connection.connect();
    try {
      await connection.query("begin");
      await connection.query("set local role authenticated");
      await connection.query(
        "select set_config('request.jwt.claim.sub',$1,true)",
        [a],
      );
      await connection.query("select public.set_primary_motorcycle($1)", [id]);
      await connection.query("commit");
    } finally {
      await connection.end();
    }
  };
  await Promise.all([parallelSwitch(bikeA), parallelSwitch(bikeA2)]);
  const primaryRows = await asUser(
    a,
    "select id from public.motorcycles where is_primary",
  );
  assert.equal(primaryRows.rowCount, 1);
  assert.ok([bikeA, bikeA2].includes(primaryRows.rows[0].id));
  checks++;
  await db.query("set role anon");
  await assert.rejects(
    db.query("select * from public.motorcycles"),
    (e) => e.code === "42501",
  );
  checks++;
  await assert.rejects(
    db.query("select public.set_primary_motorcycle($1)", [bikeA]),
    (e) => e.code === "42501",
  );
  checks++;
  await db.query("reset role");
  checks += await runTripChecks({ db, asUser, a, b, bikeA, bikeB, url });
  checks += await runMapChecks({ db, asUser, a, b });
  console.log(
    `${checks} database checks passed (ownership, RLS, primary switch, constraints, anonymous access).`,
  );
} finally {
  await db.end();
}
