import assert from "node:assert/strict";
import pg from "pg";
export async function runNotificationChecks({ db, asUser, url }) {
  let checks = 0;
  const [owner, rider, other] = [21, 22, 23].map(
    (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  );
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    owner,
    rider,
    other,
  ]);
  const trip = (
    await asUser(
      owner,
      "select public.create_trip('Saved invitation','2026-12-01T09:00Z',$1) as id",
      [
        JSON.stringify([
          { label: "A", latitude: 41, longitude: -8 },
          { label: "B", latitude: 42, longitude: -8 },
        ]),
      ],
    )
  ).rows[0].id;
  const create = async () =>
    (
      await asUser(owner, "select * from public.create_trip_invitation($1)", [
        trip,
      ])
    ).rows[0];
  const remember = async (user, token) =>
    (
      await asUser(user, "select public.remember_trip_invitation($1) as id", [
        token,
      ])
    ).rows[0].id;
  const list = async (user) =>
    (
      await asUser(
        user,
        "select * from public.list_received_trip_invitations()",
      )
    ).rows;
  const respond = (user, id, accept = true) =>
    asUser(
      user,
      "select public.respond_received_trip_invitation($1,$2) as id",
      [id, accept],
    );
  const denied = (e) => e.code === "42501";
  const unavailable = (e) => e.message === "INVITATION_UNAVAILABLE";
  const invite = await create();
  const receipt = await remember(rider, invite.token);
  assert.equal(await remember(rider, invite.token), receipt);
  checks++;
  const saved = (await list(rider))[0];
  assert.equal(saved.receipt_id, receipt);
  assert.equal(saved.status, "pending");
  assert.equal(saved.trip_id, null);
  assert.equal(saved.title, "Saved invitation");
  assert.deepEqual(
    Object.keys(saved).sort(),
    [
      "receipt_id",
      "title",
      "departure_at",
      "inviter_name",
      "expires_at",
      "received_at",
      "status",
      "trip_id",
    ].sort(),
  );
  checks++;
  assert.equal((await list(other)).length, 0);
  checks++;
  await assert.rejects(respond(other, receipt), denied);
  checks++;
  await assert.rejects(
    respond(rider, "00000000-0000-4000-8000-000000000099"),
    denied,
  );
  checks++;
  await assert.rejects(
    asUser(rider, "select * from public.trip_invitation_receipts"),
    denied,
  );
  checks++;
  await assert.rejects(
    asUser(rider, "select public.respond_invitation_internal($1,true)", [
      invite.invitation_id,
    ]),
    denied,
  );
  checks++;
  for (const token of [null, "bad", "f".repeat(64)]) {
    await assert.rejects(remember(rider, token), unavailable);
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
          rider,
          `select * from public.${table} where ${table === "trips" ? "id" : "trip_id"}=$1`,
          [trip],
        )
      ).rowCount,
      0,
    );
    checks++;
  }
  // New transactions represent a new session/device: no raw bearer is needed.
  assert.equal((await list(rider))[0].receipt_id, receipt);
  checks++;
  assert.equal((await respond(rider, receipt, false)).rows[0].id, null);
  checks++;
  assert.equal((await list(rider))[0].status, "declined");
  checks++;
  assert.equal(
    (await asUser(rider, "select id from public.trips where id=$1", [trip]))
      .rowCount,
    0,
  );
  checks++;
  await assert.rejects(respond(rider, receipt, true), unavailable);
  checks++;
  const expired = await create();
  const expiredReceipt = await remember(rider, expired.token);
  await db.query(
    "update public.trip_invitations set created_at=now()-interval '3 days',expires_at=now()-interval '1 day' where id=$1",
    [expired.invitation_id],
  );
  assert.equal(
    (await list(rider)).find((r) => r.receipt_id === expiredReceipt).status,
    "expired",
  );
  checks++;
  await assert.rejects(respond(rider, expiredReceipt), unavailable);
  checks++;
  await assert.rejects(remember(other, expired.token), unavailable);
  checks++;
  const revoked = await create();
  const revokedReceipt = await remember(rider, revoked.token);
  await asUser(owner, "select public.revoke_trip_invitation($1,$2)", [
    trip,
    revoked.invitation_id,
  ]);
  assert.equal(
    (await list(rider)).find((r) => r.receipt_id === revokedReceipt).status,
    "revoked",
  );
  checks++;
  await assert.rejects(respond(rider, revokedReceipt), unavailable);
  checks++;
  const locked = await create();
  const lockedReceipt = await remember(rider, locked.token);
  for (const state of ["active", "completed", "cancelled"]) {
    await db.query("update public.trips set status=$1 where id=$2", [
      state,
      trip,
    ]);
    assert.equal(
      (await list(rider)).find((r) => r.receipt_id === lockedReceipt).status,
      "unavailable",
    );
    checks++;
    await assert.rejects(respond(rider, lockedReceipt), unavailable);
    checks++;
  }
  await db.query("update public.trips set status='planned' where id=$1", [
    trip,
  ]);
  const concurrent = await create();
  const riderReceipt = await remember(rider, concurrent.token);
  const otherReceipt = await remember(other, concurrent.token);
  const attempt = async (user, sql, arg) => {
    const connection = new pg.Client({ connectionString: url });
    await connection.connect();
    try {
      await connection.query("begin");
      await connection.query("set local role authenticated");
      await connection.query(
        "select set_config('request.jwt.claim.sub',$1,true)",
        [user],
      );
      await connection.query(sql, [arg]);
      await connection.query("commit");
    } finally {
      await connection.end();
    }
  };
  const race = await Promise.allSettled([
    attempt(
      rider,
      "select public.respond_received_trip_invitation($1,true)",
      riderReceipt,
    ),
    attempt(
      other,
      "select public.respond_trip_invitation($1,true)",
      concurrent.token,
    ),
  ]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  checks++;
  assert.ok(unavailable(race.find((r) => r.status === "rejected").reason));
  checks++;
  const winner = race[0].status === "fulfilled" ? rider : other;
  const winnerReceipt = winner === rider ? riderReceipt : otherReceipt;
  const loser = winner === rider ? other : rider;
  assert.equal(
    (await list(winner)).find((r) => r.receipt_id === winnerReceipt).status,
    "accepted",
  );
  checks++;
  assert.equal(
    (await list(winner)).find((r) => r.receipt_id === winnerReceipt).trip_id,
    trip,
  );
  checks++;
  assert.equal(
    (await list(loser)).find((r) =>
      [riderReceipt, otherReceipt].includes(r.receipt_id),
    ).status,
    "used",
  );
  checks++;
  await db.query(
    "update public.trip_participants set status='removed' where trip_id=$1 and user_id=$2",
    [trip, winner],
  );
  assert.equal(
    (await list(winner)).find((r) => r.receipt_id === winnerReceipt).trip_id,
    null,
  );
  checks++;
  const joinedInvite = await create();
  const joinedReceipt = await remember(winner, joinedInvite.token);
  await db.query(
    "update public.trip_participants set status='accepted' where trip_id=$1 and user_id=$2",
    [trip, winner],
  );
  assert.equal(
    (await list(winner)).find((r) => r.receipt_id === joinedReceipt).status,
    "joined",
  );
  checks++;
  await assert.rejects(
    respond(winner, joinedReceipt),
    (e) => e.message === "ALREADY_PARTICIPATING",
  );
  checks++;
  await db.query("set role anon");
  for (const [sql, args] of [
    ["select public.remember_trip_invitation($1)", [invite.token]],
    ["select public.respond_received_trip_invitation($1,true)", [receipt]],
    ["select * from public.list_received_trip_invitations()", []],
    ["select * from public.trip_invitation_receipts", []],
  ]) {
    await assert.rejects(db.query(sql, args), denied);
    checks++;
  }
  await db.query("reset role");
  await db.query("delete from public.trips where id=$1", [trip]);
  assert.equal(
    (
      await db.query(
        "select * from public.trip_invitation_receipts where user_id in ($1,$2)",
        [rider, other],
      )
    ).rowCount,
    0,
  );
  checks++;
  console.log(
    `${checks} notification checks passed (receipt ownership, persistence, expiry, legacy races, RLS, privacy).`,
  );
  return checks;
}
