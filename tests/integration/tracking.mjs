import assert from "node:assert/strict";
import pg from "pg";
export async function runTrackingChecks({ db, asUser, a, b, url }) {
  let checks = 0;
  const outsider = "00000000-0000-4000-8000-000000000099";
  await db.query("insert into auth.users(id) values($1)", [outsider]);
  const points = JSON.stringify([
    { label: "A", latitude: 41, longitude: -8 },
    { label: "B", latitude: 42, longitude: -8 },
  ]);
  const trip = (
    await asUser(
      a,
      "select public.create_trip('Tracking test','2026-12-01T09:00:00Z',$1) as id",
      [points],
    )
  ).rows[0].id;
  const denied = (e) => e.code === "42501";
  const locked = (e) => e.code === "55000";
  const start = (user = a, revision = 1) =>
    asUser(user, "select public.start_trip($1,$2) as id", [trip, revision]);
  const snapshot = (user) =>
    asUser(user, "select public.tracking_snapshot($1) as value", [trip]);
  await assert.rejects(start(b), denied);
  checks++;
  await assert.rejects(start(), (e) => e.message === "ROUTE_REQUIRED");
  checks++;
  await db.query(
    "insert into public.trip_routes(trip_id,geometry,distance_m,duration_s,routing_provider) values($1,$2,1000,100,'openrouteservice')",
    [
      trip,
      JSON.stringify({
        type: "LineString",
        coordinates: [
          [-8, 41],
          [-8, 42],
        ],
      }),
    ],
  );
  await db.query(
    "insert into public.trip_participants(trip_id,user_id,role,status) values($1,$2,'rider','accepted')",
    [trip, b],
  );
  await assert.rejects(snapshot(outsider), denied);
  checks++;
  assert.equal((await snapshot(a)).rows[0].value.session, null);
  checks++;
  const attempt = async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    try {
      await c.query("begin");
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [a]);
      const r = await c.query("select public.start_trip($1,1) as id", [trip]);
      await c.query("commit");
      return r.rows[0].id;
    } finally {
      await c.end();
    }
  };
  const race = await Promise.allSettled([attempt(), attempt()]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(race.find((r) => r.status === "rejected").reason.code, "40001");
  checks++;
  const session = race.find((r) => r.status === "fulfilled").value;
  let state = (await snapshot(b)).rows[0].value;
  assert.equal(state.status, "active");
  assert.equal(state.revision, 2);
  assert.equal(state.session.id, session);
  assert.equal(state.session.ended_at, null);
  checks++;
  assert.deepEqual(state.positions, []);
  checks++;
  await assert.rejects(start(a, 2), locked);
  checks++;
  await assert.rejects(
    asUser(b, "select public.finish_trip($1,2)", [trip]),
    denied,
  );
  checks++;
  await assert.rejects(
    asUser(a, "select public.update_trip($1,$2,$3,$4,2)", [
      trip,
      "Edit",
      "2026-12-01T09:00:00Z",
      points,
    ]),
    locked,
  );
  checks++;
  await assert.rejects(
    asUser(outsider, "select public.start_location_sharing($1)", [session]),
    denied,
  );
  checks++;
  await assert.rejects(
    asUser(b, "select * from public.location_shares"),
    denied,
  );
  checks++;
  const share = async (user) =>
    (
      await asUser(user, "select public.start_location_sharing($1) as id", [
        session,
      ])
    ).rows[0].id;
  const generation = await share(b);
  const publish = (user = b, id = generation, values = {}) =>
    asUser(user, "select public.publish_rider_location($1,$2,$3,$4,$5,$6,$7)", [
      session,
      id,
      values.lat ?? 41,
      values.lng ?? -8,
      values.accuracy ?? 10,
      values.heading ?? null,
      values.time ?? new Date().toISOString(),
    ]);
  await assert.rejects(publish(a), (e) => e.message === "SHARING_STOPPED");
  checks++;
  await assert.rejects(publish(outsider), denied);
  checks++;
  await assert.rejects(
    publish(b, generation, { lat: 91 }),
    (e) => e.code === "23514",
  );
  checks++;
  await assert.rejects(
    publish(b, generation, { accuracy: -1 }),
    (e) => e.code === "23514",
  );
  checks++;
  await assert.rejects(
    publish(b, generation, { heading: 360 }),
    (e) => e.code === "23514",
  );
  checks++;
  await assert.rejects(
    publish(b, generation, {
      time: new Date(Date.now() - 31000).toISOString(),
    }),
    (e) => e.code === "22023",
  );
  checks++;
  await assert.rejects(
    publish(b, generation, {
      time: new Date(Date.now() + 10000).toISOString(),
    }),
    (e) => e.code === "22023",
  );
  checks++;
  await publish();
  state = (await snapshot(a)).rows[0].value;
  assert.equal(state.positions.length, 1);
  assert.equal(state.positions[0].user_id, b);
  assert.equal(state.positions[0].accuracy_m, 10);
  checks++;
  assert.equal(
    (
      await asUser(b, "select * from public.rider_locations where trip_id=$1", [
        trip,
      ])
    ).rowCount,
    1,
  );
  checks++;
  assert.equal(
    (await asUser(outsider, "select * from public.rider_locations")).rowCount,
    0,
  );
  checks++;
  for (const table of ["rider_locations", "tracking_sessions"]) {
    await assert.rejects(asUser(b, `delete from public.${table}`), denied);
    checks++;
  }
  await assert.rejects(publish(), (e) => e.message === "LOCATION_RATE_LIMITED");
  checks++;
  // A stop and new opt-in cannot bypass the per-user update limit.
  await asUser(b, "select public.stop_location_sharing($1,$2)", [
    session,
    generation,
  ]);
  assert.equal(
    (
      await db.query("select * from public.rider_locations where trip_id=$1", [
        trip,
      ])
    ).rowCount,
    0,
  );
  checks++;
  await assert.rejects(publish(), (e) => e.message === "SHARING_STOPPED");
  checks++;
  const second = await share(b);
  assert.notEqual(second, generation);
  checks++;
  await assert.rejects(
    publish(b, second),
    (e) => e.message === "LOCATION_RATE_LIMITED",
  );
  checks++;
  await db.query(
    "update public.location_shares set last_published_at=now()-interval '6 seconds' where session_id=$1 and user_id=$2",
    [session, b],
  );
  await publish(b, second);
  // An older watcher cannot revoke a newer opt-in.
  await asUser(b, "select public.stop_location_sharing($1,$2)", [
    session,
    generation,
  ]);
  assert.equal((await snapshot(a)).rows[0].value.positions.length, 1);
  checks++;
  // Stale vs expired: 35-second positions remain available to be labelled stale.
  await db.query(
    "update public.rider_locations set recorded_at=now()-interval '35 seconds' where trip_id=$1",
    [trip],
  );
  assert.equal((await snapshot(a)).rows[0].value.positions.length, 1);
  checks++;
  await db.query(
    "update public.location_shares set expires_at=now()-interval '1 second' where session_id=$1",
    [session],
  );
  assert.equal(
    (
      await asUser(a, "select * from public.rider_locations where trip_id=$1", [
        trip,
      ])
    ).rowCount,
    0,
  );
  checks++;
  assert.deepEqual((await snapshot(a)).rows[0].value.positions, []);
  checks++;
  assert.equal(
    (
      await db.query("select * from public.rider_locations where trip_id=$1", [
        trip,
      ])
    ).rowCount,
    0,
  );
  checks++;
  await assert.rejects(
    publish(b, second),
    (e) => e.message === "SHARING_STOPPED",
  );
  checks++;
  // Server events contain no coordinates, and clients cannot send trusted events.
  const events = (
    await db.query("select * from realtime.messages where topic=$1", [
      "trip:" + trip,
    ])
  ).rows;
  assert.ok(events.length >= 3);
  assert.ok(
    events.every((e) => JSON.stringify(e.payload) === '{"changed":true}'),
  );
  checks++;
  await assert.rejects(
    asUser(b, "select realtime.send('{}','tracking_changed',$1,true)", [
      "trip:" + trip,
    ]),
    denied,
  );
  checks++;
  await assert.rejects(
    asUser(
      b,
      "insert into realtime.messages(extension,topic,payload) values('broadcast',$1,'{}')",
      ["trip:" + trip],
    ),
    (e) => e.code === "42501" && e.message.includes("row-level security"),
  );
  checks++;
  for (const user of [a, b, outsider]) {
    const r = await asUser(
      user,
      `select set_config('realtime.topic','trip:${trip}',true); select * from realtime.messages`,
    );
    assert.equal(r[1].rowCount, user === outsider ? 0 : events.length);
    checks++;
  }
  await db.query(
    "update public.trip_participants set status='removed' where trip_id=$1 and user_id=$2",
    [trip, b],
  );
  await assert.rejects(snapshot(b), denied);
  checks++;
  assert.equal(
    (
      await asUser(b, "select public.can_receive_trip_tracking($1) as ok", [
        "trip:" + trip,
      ])
    ).rows[0].ok,
    false,
  );
  checks++;
  await db.query(
    "update public.trip_participants set status='accepted' where trip_id=$1 and user_id=$2",
    [trip, b],
  );
  const finalShare = await share(b);
  await db.query(
    "update public.location_shares set last_published_at=now()-interval '6 seconds' where session_id=$1",
    [session],
  );
  await publish(b, finalShare);
  await assert.rejects(
    asUser(a, "select public.finish_trip($1,1)", [trip]),
    (e) => e.code === "40001",
  );
  checks++;
  await asUser(a, "select public.finish_trip($1,2)", [trip]);
  state = (await snapshot(b)).rows[0].value;
  assert.equal(state.status, "completed");
  assert.equal(state.revision, 3);
  assert.ok(
    Date.parse(state.session.ended_at) >= Date.parse(state.session.started_at),
  );
  assert.deepEqual(state.positions, []);
  checks++;
  assert.equal(
    (
      await db.query(
        "select * from public.location_shares where session_id=$1",
        [session],
      )
    ).rowCount,
    0,
  );
  checks++;
  assert.equal(
    (
      await db.query("select * from public.rider_locations where trip_id=$1", [
        trip,
      ])
    ).rowCount,
    0,
  );
  checks++;
  await assert.rejects(publish(b, finalShare), denied);
  checks++;
  await assert.rejects(share(b), denied);
  checks++;
  await assert.rejects(
    asUser(a, "select public.finish_trip($1,3)", [trip]),
    locked,
  );
  checks++;
  await assert.rejects(start(a, 3), locked);
  checks++;
  await db.query("set role anon");
  for (const sql of [
    "select public.start_trip($1,1)",
    "select public.finish_trip($1,1)",
    "select public.start_location_sharing($1)",
    "select public.stop_location_sharing($1,null)",
    "select public.tracking_snapshot($1)",
    "select * from public.rider_locations",
  ]) {
    await assert.rejects(
      db.query(sql, sql.includes("$1") ? [trip] : []),
      denied,
    );
    checks++;
  }
  await db.query("reset role");
  console.log(
    `${checks} tracking checks passed (lifecycle, time, consent, expiry, private events, revocation, quotas).`,
  );
  return checks;
}
