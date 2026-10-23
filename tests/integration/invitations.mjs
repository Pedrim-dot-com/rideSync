import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import pg from "pg";
export async function runInvitationChecks({ db, asUser, a, b, bikeB, url }) {
  let checks = 0;
  const c = "00000000-0000-4000-8000-000000000004";
  await db.query("insert into auth.users(id) values ($1)", [c]);
  const points = JSON.stringify([
    { label: "A", latitude: 41, longitude: -8 },
    { label: "B", latitude: 42, longitude: -8 },
  ]);
  const createTrip = async () =>
    (
      await asUser(
        a,
        "select public.create_trip('Invitation test','2026-12-01T09:00:00Z',$1) as id",
        [points],
      )
    ).rows[0].id;
  const trip = await createTrip();
  const create = async (user = a, id = trip) =>
    (
      await asUser(user, "select * from public.create_trip_invitation($1)", [
        id,
      ])
    ).rows[0];
  const respond = (user, token, accept = true) =>
    asUser(user, "select public.respond_trip_invitation($1,$2) as id", [
      token,
      accept,
    ]);
  const unavailable = (e) =>
    e.code === "P0001" && e.message === "INVITATION_UNAVAILABLE";
  const denied = (e) => e.code === "42501";
  const invitation = await create();
  assert.match(invitation.token, /^[0-9a-f]{64}$/);
  checks++;
  const stored = (
    await db.query("select * from public.trip_invitations where id=$1", [
      invitation.invitation_id,
    ])
  ).rows[0];
  assert.equal(
    stored.token_hash,
    createHash("sha256").update(invitation.token).digest("hex"),
  );
  assert.ok(!Object.values(stored).includes(invitation.token));
  checks++;
  assert.equal(stored.expires_at - stored.created_at, 48 * 60 * 60 * 1000);
  checks++;
  for (const user of [a, b]) {
    await assert.rejects(
      asUser(user, "select * from public.trip_invitations"),
      denied,
    );
    checks++;
    await assert.rejects(
      asUser(
        user,
        "insert into public.trip_invitations(trip_id,token_hash,invited_by) values($1,$2,$3)",
        [trip, "a".repeat(64), user],
      ),
      denied,
    );
    checks++;
  }
  const listed = (
    await asUser(a, "select * from public.list_trip_invitations($1)", [trip])
  ).rows;
  assert.equal(listed.length, 1);
  assert.ok(!("token_hash" in listed[0]));
  assert.ok(!("token" in listed[0]));
  checks++;
  await assert.rejects(create(b), denied);
  checks++;
  await assert.rejects(
    asUser(b, "select * from public.list_trip_invitations($1)", [trip]),
    denied,
  );
  checks++;
  await assert.rejects(
    asUser(b, "select public.revoke_trip_invitation($1,$2)", [
      trip,
      invitation.invitation_id,
    ]),
    denied,
  );
  checks++;
  for (const token of [null, "bad", "0".repeat(64)]) {
    await assert.rejects(respond(b, token), unavailable);
    checks++;
  }
  for (const table of [
    "trips",
    "trip_waypoints",
    "trip_routes",
    "trip_participants",
  ]) {
    assert.equal(
      (
        await asUser(
          b,
          `select * from public.${table} where ${table === "trips" ? "id" : "trip_id"}=$1`,
          [trip],
        )
      ).rowCount,
      0,
    );
    checks++;
  }
  await assert.rejects(
    asUser(b, "select * from public.list_trip_members($1)", [trip]),
    denied,
  );
  checks++;
  await assert.rejects(
    respond(a, invitation.token),
    (e) => e.message === "ALREADY_PARTICIPATING",
  );
  checks++;
  assert.equal((await respond(b, invitation.token)).rows[0].id, trip);
  checks++;
  assert.equal(
    (await asUser(b, "select * from public.trips where id=$1", [trip]))
      .rowCount,
    1,
  );
  checks++;
  assert.equal(
    (
      await asUser(b, "select * from public.trip_waypoints where trip_id=$1", [
        trip,
      ])
    ).rowCount,
    2,
  );
  checks++;
  for (const user of [b, c]) {
    await assert.rejects(respond(user, invitation.token), unavailable);
    checks++;
  }
  assert.equal(
    (
      await asUser(
        a,
        "select * from public.trip_participants where trip_id=$1 and user_id=$2",
        [trip, b],
      )
    ).rowCount,
    1,
  );
  checks++;
  // No widening of raw profile/garage visibility.
  assert.equal(
    (await asUser(b, "select * from public.profiles where id=$1", [a]))
      .rowCount,
    0,
  );
  checks++;
  const bikeA = (
    await asUser(
      a,
      "insert into public.motorcycles(user_id,brand,model) values($1,'Honda','NX500') returning id",
      [a],
    )
  ).rows[0].id;
  assert.equal(
    (await asUser(b, "select * from public.motorcycles where id=$1", [bikeA]))
      .rowCount,
    0,
  );
  checks++;
  await assert.rejects(
    asUser(b, "select public.set_trip_motorcycle($1,$2)", [trip, bikeA]),
    denied,
  );
  checks++;
  await assert.rejects(
    asUser(c, "select public.set_trip_motorcycle($1,$2)", [trip, null]),
    denied,
  );
  checks++;
  await asUser(b, "select public.set_trip_motorcycle($1,$2)", [trip, bikeB]);
  const members = (
    await asUser(a, "select * from public.list_trip_members($1)", [trip])
  ).rows;
  assert.equal(members.length, 2);
  assert.equal(members[0].role, "organizer");
  assert.equal(members.find((m) => m.user_id === b).motorcycle_brand, "BMW");
  assert.deepEqual(
    Object.keys(members[0]).sort(),
    [
      "user_id",
      "role",
      "display_name",
      "username",
      "motorcycle_brand",
      "motorcycle_model",
    ].sort(),
  );
  checks++;
  // Selecting a bike doesn't invalidate an itinerary or increment its revision.
  assert.equal(
    (await asUser(a, "select revision from public.trips where id=$1", [trip]))
      .rows[0].revision,
    1,
  );
  checks++;
  await asUser(b, "select public.set_trip_motorcycle($1,$2)", [trip, null]);
  assert.equal(
    (
      await asUser(
        b,
        "select motorcycle_id from public.trip_participants where trip_id=$1 and user_id=$2",
        [trip, b],
      )
    ).rows[0].motorcycle_id,
    null,
  );
  checks++;
  const declined = await create();
  assert.equal((await respond(c, declined.token, false)).rows[0].id, null);
  checks++;
  assert.equal(
    (await asUser(c, "select id from public.trips where id=$1", [trip]))
      .rowCount,
    0,
  );
  checks++;
  await assert.rejects(respond(c, declined.token), unavailable);
  checks++;
  const expired = await create();
  await db.query(
    "update public.trip_invitations set created_at=now()-interval '3 days',expires_at=now()-interval '1 day' where id=$1",
    [expired.invitation_id],
  );
  await assert.rejects(respond(c, expired.token), unavailable);
  checks++;
  const revoked = await create();
  await asUser(a, "select public.revoke_trip_invitation($1,$2)", [
    trip,
    revoked.invitation_id,
  ]);
  await assert.rejects(respond(c, revoked.token), unavailable);
  checks++;
  const retry = await create();
  await respond(c, retry.token);
  assert.equal(
    (await asUser(c, "select id from public.trips where id=$1", [trip]))
      .rowCount,
    1,
  );
  checks++;
  await db.query(
    "update public.trip_participants set status='removed' where trip_id=$1 and user_id=$2",
    [trip, c],
  );
  await assert.rejects(
    asUser(c, "select * from public.list_trip_members($1)", [trip]),
    denied,
  );
  checks++;
  // Two authenticated riders race for the same one-use token.
  const concurrent = await create();
  const riderD = "00000000-0000-4000-8000-000000000005";
  await db.query("insert into auth.users(id) values ($1)", [riderD]);
  const attempt = async (user) => {
    const connection = new pg.Client({ connectionString: url });
    await connection.connect();
    try {
      await connection.query("begin");
      await connection.query("set local role authenticated");
      await connection.query(
        "select set_config('request.jwt.claim.sub',$1,true)",
        [user],
      );
      await connection.query("select public.respond_trip_invitation($1,true)", [
        concurrent.token,
      ]);
      await connection.query("commit");
    } finally {
      await connection.end();
    }
  };
  const race = await Promise.allSettled([attempt(c), attempt(riderD)]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(unavailable(race.find((r) => r.status === "rejected").reason));
  checks++;
  const inactive = await create();
  for (const status of ["active", "completed", "cancelled"]) {
    await db.query("update public.trips set status=$1 where id=$2", [
      status,
      trip,
    ]);
    await assert.rejects(create(), (e) => e.code === "55000");
    checks++;
    await assert.rejects(respond(riderD, inactive.token), unavailable);
    checks++;
    await assert.rejects(
      asUser(b, "select public.set_trip_motorcycle($1,$2)", [trip, bikeB]),
      (e) => e.code === "55000",
    );
    checks++;
  }
  await db.query("update public.trips set status='planned' where id=$1", [
    trip,
  ]);
  // Quota counts used/revoked invitations too, and is serialized per sender.
  const count = Number(
    (
      await db.query(
        "select count(*) from public.trip_invitations where trip_id=$1 and created_at>now()-interval '24 hours'",
        [trip],
      )
    ).rows[0].count,
  );
  for (let i = count; i < 10; i++) await create();
  await assert.rejects(
    create(),
    (e) => e.message === "INVITATION_RATE_LIMITED",
  );
  checks++;
  const other = await createTrip();
  const other2 = await createTrip();
  for (let i = 0; i < 10; i++) {
    await create(a, other);
    await create(a, other2);
  }
  const other3 = await createTrip();
  await assert.rejects(
    create(a, other3),
    (e) => e.message === "INVITATION_RATE_LIMITED",
  );
  checks++;
  await db.query("set role anon");
  for (const sql of [
    "select * from public.create_trip_invitation($1)",
    "select * from public.list_trip_invitations($1)",
    "select * from public.list_trip_members($1)",
    "select public.respond_trip_invitation($1,true)",
    "select public.set_trip_motorcycle($1,null)",
    "select public.revoke_trip_invitation($1,null)",
  ]) {
    await assert.rejects(
      db.query(sql, [sql.includes("respond") ? invitation.token : trip]),
      denied,
    );
    checks++;
  }
  await db.query("reset role");
  console.log(
    `${checks} invitation/participation checks passed (hashes, expiry, one-use, races, quotas, RLS, bike ownership).`,
  );
  return checks;
}
