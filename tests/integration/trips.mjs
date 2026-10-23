import assert from "node:assert/strict";
import pg from "pg";
export async function runTripChecks({ db, asUser, a, b, bikeA, bikeB, url }) {
  let checks = 0;
  const title = "Passeio ao Gerês";
  const date = "2026-11-01T09:00:00Z";
  const points = [
    { label: "Porto", latitude: 41.1579, longitude: -8.6291 },
    { label: "Gerês", latitude: 41.727, longitude: -8.162 },
  ];
  const json = JSON.stringify(points);
  const create = async (user, waypoints = json) =>
    (
      await asUser(user, "select public.create_trip($1,$2,$3) as id", [
        title,
        date,
        waypoints,
      ])
    ).rows[0].id;
  const outsider = "00000000-0000-4000-8000-000000000003";
  await db.query("insert into auth.users(id) values ($1)", [outsider]);
  const trip = await create(a);
  const owner = (
    await asUser(a, "select * from public.trip_participants where trip_id=$1", [
      trip,
    ])
  ).rows;
  assert.equal(owner.length, 1);
  assert.equal(owner[0].user_id, a);
  assert.equal(owner[0].role, "organizer");
  assert.equal(owner[0].status, "accepted");
  checks++;
  assert.equal(
    (
      await asUser(
        a,
        "select * from public.trip_waypoints where trip_id=$1 order by position",
        [trip],
      )
    ).rowCount,
    2,
  );
  checks++;
  for (const table of [
    "trips",
    "trip_participants",
    "trip_waypoints",
    "trip_routes",
  ]) {
    assert.equal(
      (await asUser(b, `select * from public.${table}`)).rowCount,
      0,
    );
    checks++;
  }
  // An invitation/declined membership must not unlock the trip.
  await db.query(
    "insert into public.trip_participants(trip_id,user_id,role,status) values ($1,$2,'rider','invited')",
    [trip, b],
  );
  assert.equal((await asUser(b, "select * from public.trips")).rowCount, 0);
  checks++;
  await db.query(
    "update public.trip_participants set status='declined' where trip_id=$1 and user_id=$2",
    [trip, b],
  );
  assert.equal((await asUser(b, "select * from public.trips")).rowCount, 0);
  checks++;
  await db.query(
    "update public.trip_participants set status='accepted' where trip_id=$1 and user_id=$2",
    [trip, b],
  );
  assert.equal((await asUser(b, "select * from public.trips")).rowCount, 1);
  checks++;
  assert.equal(
    (await asUser(b, "select * from public.trip_waypoints")).rowCount,
    2,
  );
  checks++;
  await assert.rejects(
    asUser(b, "select public.update_trip($1,$2,$3,$4,$5)", [
      trip,
      "Spoofed",
      date,
      json,
      1,
    ]),
    (e) => e.code === "42501",
  );
  checks++;
  await assert.rejects(
    asUser(
      b,
      "update public.trip_participants set role='organizer' where user_id=$1",
      [b],
    ),
    (e) => e.code === "42501",
  );
  checks++;
  await assert.rejects(
    asUser(
      a,
      "insert into public.trips(created_by,title,departure_at) values ($1,'Forged',$2)",
      [b, date],
    ),
    (e) => e.code === "42501",
  );
  checks++;
  await assert.rejects(
    asUser(a, "update public.trips set status='active' where id=$1", [trip]),
    (e) => e.code === "42501",
  );
  checks++;
  await assert.rejects(
    asUser(a, "select public.replace_trip_waypoints($1,$2)", [trip, json]),
    (e) => e.code === "42501",
  );
  checks++;
  await assert.rejects(
    asUser(a, "delete from public.trip_waypoints where trip_id=$1", [trip]),
    (e) => e.code === "42501",
  );
  checks++;
  // Invalid create is atomic, including its automatically-created organizer.
  const countBefore = (await db.query("select count(*) from public.trips"))
    .rows[0].count;
  await assert.rejects(
    create(a, JSON.stringify([points[0]])),
    (e) => e.code === "22023",
  );
  checks++;
  await assert.rejects(
    create(a, JSON.stringify([{ ...points[0], latitude: 91 }, points[1]])),
    (e) => e.code === "23514",
  );
  checks++;
  await assert.rejects(
    create(a, JSON.stringify([{ ...points[0], latitude: null }, points[1]])),
    (e) => e.code === "22023",
  );
  checks++;
  assert.equal(
    (await db.query("select count(*) from public.trips")).rows[0].count,
    countBefore,
  );
  checks++;
  // Only trusted backend writes can create routes; clients cannot fabricate geometry/ETA.
  await assert.rejects(
    asUser(
      a,
      "insert into public.trip_routes(trip_id,geometry,distance_m,duration_s,routing_provider) values ($1,$2,1,1,'openrouteservice')",
      [
        trip,
        JSON.stringify({
          type: "LineString",
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        }),
      ],
    ),
    (e) => e.code === "42501",
  );
  checks++;
  await db.query(
    "insert into public.trip_routes(trip_id,geometry,distance_m,duration_s,routing_provider) values ($1,$2,1000,60,'openrouteservice')",
    [
      trip,
      JSON.stringify({
        type: "LineString",
        coordinates: [
          [-8.6291, 41.1579],
          [-8.162, 41.727],
        ],
      }),
    ],
  );
  assert.equal(
    (await asUser(b, "select * from public.trip_routes")).rowCount,
    1,
  );
  checks++;
  for (const table of [
    "trips",
    "trip_participants",
    "trip_waypoints",
    "trip_routes",
  ]) {
    assert.equal(
      (await asUser(outsider, `select * from public.${table}`)).rowCount,
      0,
    );
    checks++;
  }
  await db.query(
    "update public.trip_participants set status='removed' where trip_id=$1 and user_id=$2",
    [trip, b],
  );
  assert.equal((await asUser(b, "select * from public.trips")).rowCount, 0);
  checks++;
  await db.query(
    "update public.trip_participants set status='accepted' where trip_id=$1 and user_id=$2",
    [trip, b],
  );
  const reordered = [
    points[0],
    { label: "Braga", latitude: 41.55, longitude: -8.42 },
    points[1],
  ];
  await asUser(a, "select public.update_trip($1,$2,$3,$4,$5)", [
    trip,
    title,
    date,
    JSON.stringify(reordered),
    1,
  ]);
  assert.deepEqual(
    (
      await asUser(
        a,
        "select label from public.trip_waypoints order by position",
      )
    ).rows.map((p) => p.label),
    ["Porto", "Braga", "Gerês"],
  );
  checks++;
  assert.equal(
    (await asUser(a, "select * from public.trip_routes")).rowCount,
    0,
  );
  checks++;
  await assert.rejects(
    asUser(a, "select public.update_trip($1,$2,$3,$4,$5)", [
      trip,
      "Stale",
      date,
      json,
      1,
    ]),
    (e) => e.code === "40001",
  );
  checks++;
  await assert.rejects(
    asUser(a, "select public.update_trip($1,$2,$3,$4,$5)", [
      trip,
      "Invalid",
      date,
      "[]",
      2,
    ]),
    (e) => e.code === "22023",
  );
  checks++;
  assert.equal(
    (await asUser(a, "select revision from public.trips where id=$1", [trip]))
      .rows[0].revision,
    2,
  );
  checks++;
  await assert.rejects(
    asUser(b, "select public.set_trip_status($1,$2,$3)", [trip, "planned", 2]),
    (e) => e.code === "42501",
  );
  checks++;
  await asUser(a, "select public.set_trip_status($1,$2,$3)", [
    trip,
    "planned",
    2,
  ]);
  await assert.rejects(
    asUser(a, "select public.set_trip_status($1,$2,$3)", [trip, "active", 3]),
    (e) => e.code === "55000",
  );
  checks++;
  await assert.rejects(
    asUser(a, "select public.delete_trip($1,$2)", [trip, 3]),
    (e) => e.code === "55000",
  );
  checks++;
  // Selection must belong to the participant, even for privileged writes.
  await assert.rejects(
    db.query(
      "update public.trip_participants set motorcycle_id=$1 where trip_id=$2 and user_id=$3",
      [bikeB, trip, a],
    ),
    (e) => e.code === "42501",
  );
  checks++;
  await db.query(
    "update public.trip_participants set motorcycle_id=$1 where trip_id=$2 and user_id=$3",
    [bikeA, trip, a],
  );
  await asUser(a, "delete from public.motorcycles where id=$1", [bikeA]);
  assert.equal(
    (
      await asUser(
        a,
        "select motorcycle_id from public.trip_participants where user_id=$1",
        [a],
      )
    ).rows[0].motorcycle_id,
    null,
  );
  checks++;
  assert.equal(
    (await asUser(a, "select id from public.trips where id=$1", [trip]))
      .rowCount,
    1,
  );
  checks++;
  await db.query("update public.trips set status='active' where id=$1", [trip]);
  await assert.rejects(
    asUser(a, "select public.update_trip($1,$2,$3,$4,$5)", [
      trip,
      title,
      date,
      json,
      3,
    ]),
    (e) => e.code === "55000",
  );
  checks++;
  await db.query("update public.trips set status='planned' where id=$1", [
    trip,
  ]);
  // Concurrent editors: exactly one wins, no last-write-wins loss.
  const attempt = async (name) => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    try {
      await c.query("begin");
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [a]);
      await c.query("select public.update_trip($1,$2,$3,$4,$5)", [
        trip,
        name,
        date,
        json,
        3,
      ]);
      await c.query("commit");
    } finally {
      await c.end();
    }
  };
  const results = await Promise.allSettled([
    attempt("First edit"),
    attempt("Second edit"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.code,
    "40001",
  );
  checks++;
  await asUser(a, "select public.set_trip_status($1,$2,$3)", [
    trip,
    "cancelled",
    4,
  ]);
  await assert.rejects(
    asUser(a, "select public.update_trip($1,$2,$3,$4,$5)", [
      trip,
      title,
      date,
      json,
      5,
    ]),
    (e) => e.code === "55000",
  );
  checks++;
  await assert.rejects(
    asUser(a, "select public.set_trip_status($1,$2,$3)", [trip, "draft", 5]),
    (e) => e.code === "55000",
  );
  checks++;
  await assert.rejects(
    asUser(b, "select public.delete_trip($1,$2)", [trip, 5]),
    (e) => e.code === "42501",
  );
  checks++;
  await asUser(a, "select public.delete_trip($1,$2)", [trip, 5]);
  assert.equal(
    (
      await db.query("select * from public.trip_waypoints where trip_id=$1", [
        trip,
      ])
    ).rowCount,
    0,
  );
  checks++;
  assert.equal(
    (
      await db.query(
        "select * from public.trip_participants where trip_id=$1",
        [trip],
      )
    ).rowCount,
    0,
  );
  checks++;
  await db.query("set role anon");
  await assert.rejects(
    db.query("select * from public.trips"),
    (e) => e.code === "42501",
  );
  checks++;
  await assert.rejects(
    db.query("select public.create_trip($1,$2,$3)", [title, date, json]),
    (e) => e.code === "42501",
  );
  checks++;
  await db.query("reset role");
  console.log(
    `${checks} trip checks passed (private membership, atomic edits, state transitions, concurrent editors).`,
  );
  return checks;
}
