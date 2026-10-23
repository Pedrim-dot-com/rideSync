import assert from "node:assert/strict";
export async function runMapChecks({ db, asUser, a, b }) {
  let checks = 0;
  const points = JSON.stringify([
    { label: "Porto", latitude: 41.15, longitude: -8.62 },
    { label: "Gaia", latitude: 41.13, longitude: -8.61 },
  ]);
  const id = (
    await asUser(a, "select public.create_trip($1,$2,$3) as id", [
      "Maps test",
      "2026-11-01T09:00:00Z",
      points,
    ])
  ).rows[0].id;
  const geometry = JSON.stringify({
    type: "LineString",
    coordinates: [
      [-8.62, 41.15],
      [-8.61, 41.13],
    ],
  });
  const sql = "select public.store_trip_route($1,$2,$3,$4,$5,$6,$7)";
  const args = [id, a, 1, geometry, 1000, 100, "2026-10-23T12:00:00Z"];
  await assert.rejects(asUser(a, sql, args), (e) => e.code === "42501");
  checks++;
  await assert.rejects(
    asUser(a, "select * from public.map_request_limits"),
    (e) => e.code === "42501",
  );
  checks++;
  for (let i = 0; i < 10; i++)
    await asUser(a, "select public.consume_map_request('calculate-route')");
  await assert.rejects(
    asUser(a, "select public.consume_map_request('calculate-route')"),
    (e) => e.code === "P0001" && e.message === "RATE_LIMITED",
  );
  checks++;
  await asUser(b, "select public.consume_map_request('calculate-route')");
  checks++;
  await asUser(a, "select public.consume_map_request('search-places')");
  checks++;
  await assert.rejects(
    asUser(a, "select public.consume_map_request('invalid')"),
    (e) => e.code === "22023",
  );
  checks++;
  await db.query(
    "update public.map_request_limits set window_started_at=now()-interval '61 seconds' where user_id=$1",
    [a],
  );
  await asUser(a, "select public.consume_map_request('calculate-route')");
  checks++;
  const service = async (values) => {
    await db.query("begin");
    try {
      await db.query("set local role service_role");
      const result = await db.query(sql, values);
      await db.query("commit");
      return result;
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  };
  await assert.rejects(
    service([id, b, ...args.slice(2)]),
    (e) => e.code === "42501",
  );
  checks++;
  await assert.rejects(
    service([
      id,
      a,
      1,
      JSON.stringify({
        type: "LineString",
        coordinates: [
          [181, 41],
          [0, 0],
        ],
      }),
      ...args.slice(4),
    ]),
    (e) => e.code === "22023",
  );
  checks++;
  await assert.rejects(
    service([id, a, 1, geometry, -1, 100, args[6]]),
    (e) => e.code === "23514",
  );
  checks++;
  await service(args);
  assert.equal(
    (await asUser(a, "select * from public.trip_routes where trip_id=$1", [id]))
      .rows[0].distance_m,
    1000,
  );
  checks++;
  assert.equal(
    (await asUser(a, "select revision from public.trips where id=$1", [id]))
      .rows[0].revision,
    2,
  );
  checks++;
  await assert.rejects(service(args), (e) => e.code === "40001");
  checks++;
  await asUser(a, "select public.update_trip($1,$2,$3,$4,$5)", [
    id,
    "Changed",
    "2026-11-01T09:00:00Z",
    points,
    2,
  ]);
  assert.equal(
    (await asUser(a, "select * from public.trip_routes where trip_id=$1", [id]))
      .rowCount,
    0,
  );
  checks++;
  await db.query("update public.trips set status='active' where id=$1", [id]);
  await assert.rejects(
    service([id, a, 3, ...args.slice(3)]),
    (e) => e.code === "55000",
  );
  checks++;
  console.log(`${checks} map-service database checks passed.`);
  return checks;
}
