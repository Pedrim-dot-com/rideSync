import assert from "node:assert/strict";
export async function runVoiceChecks({ db, asUser }) {
  let checks = 0;
  const [a, b, c, d] = [41, 42, 43, 44].map(
    (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  );
  await db.query("insert into auth.users(id) values($1),($2),($3),($4)", [
    a,
    b,
    c,
    d,
  ]);
  const trip = (
    await asUser(
      a,
      "select public.create_trip('Voice trip','2026-12-01T09:00Z',$1) as id",
      [
        JSON.stringify([
          { label: "A", latitude: 41, longitude: -8 },
          { label: "B", latitude: 42, longitude: -8 },
        ]),
      ],
    )
  ).rows[0].id;
  const invitation = (
    await asUser(a, "select * from public.create_trip_invitation($1)", [trip])
  ).rows[0];
  await asUser(b, "select public.respond_trip_invitation($1,true)", [
    invitation.token,
  ]);
  const secondInvitation = (
    await asUser(a, "select * from public.create_trip_invitation($1)", [trip])
  ).rows[0];
  await asUser(d, "select public.respond_trip_invitation($1,true)", [
    secondInvitation.token,
  ]);
  const denied = (e) => e.code === "42501";
  const snapshot = async (user = b) =>
    (
      await asUser(user, "select public.trip_voice_snapshot($1) as data", [
        trip,
      ])
    ).rows[0].data;
  const service = async (sql, args) => {
    await db.query("begin");
    try {
      await db.query("set local role service_role");
      const result = await db.query(sql, args);
      await db.query("commit");
      return result;
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  };
  const begin = async (user, action) =>
    (
      await service(
        "select public.begin_trip_voice_operation($1,$2,$3) as data",
        [trip, user, action],
      )
    ).rows[0].data;
  const finish = async (op, success = true) =>
    (
      await service(
        "select public.finish_trip_voice_operation($1,$2,$3) as ok",
        [trip, op, success],
      )
    ).rows[0].ok;
  await assert.rejects(
    asUser(b, "select public.raise_trip_sos($1,'puncture')", [trip]),
    denied,
  );
  checks++;
  await db.query("update public.trips set status='active' where id=$1", [trip]);
  const initial = await snapshot();
  assert.ok(initial.room_epoch);
  assert.equal(initial.speaker_id, null);
  checks++;
  await assert.rejects(snapshot(c), denied);
  checks++;
  await assert.rejects(
    asUser(c, "select public.raise_trip_sos($1,'puncture')", [trip]),
    denied,
  );
  checks++;
  await assert.rejects(
    asUser(b, "select public.begin_trip_voice_operation($1,$2,'speak')", [
      trip,
      b,
    ]),
    denied,
  );
  checks++;
  await assert.rejects(begin(b, "speak"), denied);
  checks++;
  await assert.rejects(begin(c, "join"), denied);
  checks++;
  assert.equal((await begin(b, "join")).can_publish, false);
  checks++;
  const ownerOp = await begin(a, "speak");
  assert.equal((await snapshot()).settling, true);
  assert.equal((await snapshot()).speaker_id, null);
  checks++;
  await assert.rejects(begin(b, "join"), (e) => e.message === "VOICE_BUSY");
  checks++;
  assert.equal(await finish(ownerOp.operation_id), true);
  checks++;
  assert.equal((await snapshot()).speaker_id, a);
  checks++;
  assert.equal((await begin(a, "join")).can_publish, true);
  checks++;
  assert.equal((await begin(b, "join")).can_publish, false);
  checks++;
  await db.query(
    "update public.trip_voice_state set epoch_started_at=now()-interval '61 seconds' where trip_id=$1",
    [trip],
  );
  const renewed = await snapshot();
  assert.notEqual(renewed.room_epoch, ownerOp.room.slice(-36));
  assert.equal(renewed.speaker_id, a);
  checks++;
  await begin(a, "heartbeat");
  assert.equal((await snapshot()).speaker_id, a);
  checks++;
  await asUser(b, "select public.raise_trip_sos($1,'puncture')", [trip]);
  const sos = await snapshot();
  assert.equal(sos.speaker_id, null);
  assert.equal(sos.sos.user_id, b);
  assert.notEqual(sos.room_epoch, ownerOp.room.slice(-36));
  checks++;
  assert.equal((await begin(a, "join")).can_publish, false);
  checks++;
  await assert.rejects(
    begin(a, "speak"),
    (e) => e.message === "SOS_ALREADY_ACTIVE",
  );
  checks++;
  await assert.rejects(
    asUser(a, "select public.raise_trip_sos($1,'other')", [trip]),
    (e) => e.message === "SOS_ALREADY_ACTIVE",
  );
  checks++;
  await assert.rejects(
    asUser(d, "select public.resolve_trip_sos($1)", [trip]),
    denied,
  );
  checks++;
  await assert.rejects(begin(d, "sos"), denied);
  checks++;
  assert.equal((await begin(d, "join")).can_publish, false);
  checks++;
  const sosOp = await begin(b, "sos");
  assert.notEqual(sosOp.room, ownerOp.room);
  checks++;
  await finish(sosOp.operation_id);
  assert.equal((await snapshot()).speaker_id, b);
  checks++;
  assert.equal((await begin(b, "join")).can_publish, true);
  assert.equal((await begin(a, "join")).can_publish, false);
  checks++;
  await assert.rejects(
    asUser(c, "select public.resolve_trip_sos($1)", [trip]),
    denied,
  );
  checks++;
  await asUser(a, "select public.resolve_trip_sos($1)", [trip]);
  assert.equal((await snapshot()).sos, null);
  assert.equal((await snapshot()).speaker_id, null);
  checks++;
  assert.equal((await begin(b, "join")).can_publish, false);
  checks++;
  const failed = await begin(a, "speak");
  await finish(failed.operation_id, false);
  const afterFailure = await snapshot();
  assert.equal(afterFailure.speaker_id, null);
  assert.notEqual(afterFailure.room_epoch, failed.room.slice(-36));
  checks++;
  assert.equal(await finish(failed.operation_id), false);
  checks++;
  const abandoned = await begin(a, "speak");
  await db.query(
    "update public.trip_voice_state set operation_until=now()-interval '1 second' where trip_id=$1",
    [trip],
  );
  const recovered = await snapshot();
  assert.equal(recovered.settling, false);
  assert.notEqual(recovered.room_epoch, abandoned.room.slice(-36));
  checks++;
  assert.equal(await finish(abandoned.operation_id), false);
  checks++;
  const expires = await begin(a, "speak");
  await finish(expires.operation_id);
  await db.query(
    "update public.trip_voice_state set speaker_until=now()-interval '1 second' where trip_id=$1",
    [trip],
  );
  assert.equal((await snapshot()).speaker_id, null);
  checks++;
  for (const table of [
    "trip_sos_alerts",
    "trip_voice_state",
    "trip_voice_limits",
  ]) {
    await assert.rejects(asUser(b, `select * from public.${table}`), denied);
    checks++;
  }
  assert.equal(
    (
      await asUser(b, "select public.can_receive_trip_voice($1) as ok", [
        "voice:" + trip,
      ])
    ).rows[0].ok,
    true,
  );
  checks++;
  assert.equal(
    (
      await asUser(c, "select public.can_receive_trip_voice($1) as ok", [
        "voice:" + trip,
      ])
    ).rows[0].ok,
    false,
  );
  checks++;
  await assert.rejects(
    asUser(
      b,
      "insert into realtime.messages(extension,topic,payload) values('broadcast',$1,'{}')",
      ["voice:" + trip],
    ),
    denied,
  );
  checks++;
  await db.query("update public.trips set status='completed' where id=$1", [
    trip,
  ]);
  assert.equal((await snapshot()).status, "completed");
  checks++;
  assert.equal(
    (
      await db.query(
        "select count(*) from public.trip_voice_state where trip_id=$1",
        [trip],
      )
    ).rows[0].count,
    "0",
  );
  checks++;
  await assert.rejects(begin(a, "join"), denied);
  checks++;
  await db.query("set role anon");
  for (const sql of [
    "select public.trip_voice_snapshot($1)",
    "select public.raise_trip_sos($1,'other')",
    "select public.resolve_trip_sos($1)",
  ]) {
    await assert.rejects(db.query(sql, [trip]), denied);
    checks++;
  }
  await db.query("reset role");
  console.log(
    `${checks} voice/SOS checks passed (priority, token room epochs, roles, expiry, fail-closed recovery, private Realtime).`,
  );
  return checks;
}
