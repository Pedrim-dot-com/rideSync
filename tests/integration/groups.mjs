import assert from "node:assert/strict";
import pg from "pg";
export async function runGroupChecks({ db, asUser, url }) {
  let checks = 0;
  const [a, b, c, d] = [31, 32, 33, 34].map(
    (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  );
  await db.query("insert into auth.users(id) values($1),($2),($3),($4)", [
    a,
    b,
    c,
    d,
  ]);
  const denied = (e) => e.code === "42501";
  const error = (name) => (e) => e.message === name;
  const create = async (user, name = "Motard association") =>
    (
      await asUser(
        user,
        "select public.save_motard_group(null,null,$1,'Description','Legal association','Declared registration','Public headquarters',41,-8) as id",
        [name],
      )
    ).rows[0].id;
  const action = (user, group, kind, target = null) =>
    asUser(user, "select public.change_group_membership($1,$2,$3)", [
      group,
      kind,
      target,
    ]);
  const roster = async (user, group) =>
    (await asUser(user, "select * from public.list_group_members($1)", [group]))
      .rows;
  const group = await create(a);
  assert.equal((await roster(a, group))[0].role, "leader");
  checks++;
  assert.equal(
    (
      await asUser(b, "select id from public.motard_groups where id=$1", [
        group,
      ])
    ).rowCount,
    1,
  );
  checks++;
  assert.equal(
    (
      await asUser(
        b,
        "select * from public.group_memberships where group_id=$1",
        [group],
      )
    ).rowCount,
    0,
  );
  checks++;
  await assert.rejects(
    asUser(b, "select created_by from public.motard_groups where id=$1", [
      group,
    ]),
    denied,
  );
  checks++;
  await assert.rejects(roster(b, group), denied);
  checks++;
  await assert.rejects(
    asUser(b, "update public.motard_groups set name='forged' where id=$1", [
      group,
    ]),
    denied,
  );
  checks++;
  await assert.rejects(
    asUser(
      b,
      "insert into public.group_memberships(group_id,user_id,status,role) values($1,$2,'accepted','leader')",
      [group, b],
    ),
    denied,
  );
  checks++;
  await assert.rejects(action(b, group, "request", c), denied);
  checks++;
  await action(b, group, "request");
  assert.equal(
    (
      await asUser(
        b,
        "select status from public.group_memberships where group_id=$1",
        [group],
      )
    ).rows[0].status,
    "pending",
  );
  checks++;
  assert.equal(
    (await roster(a, group)).filter((m) => m.status === "pending").length,
    1,
  );
  checks++;
  await assert.rejects(action(b, group, "approve", b), denied);
  checks++;
  await action(a, group, "approve", b);
  assert.equal(
    (await roster(b, group)).filter((m) => m.status === "accepted").length,
    2,
  );
  checks++;
  await assert.rejects(create(b), error("GROUP_MEMBERSHIP_EXISTS"));
  checks++;
  await assert.rejects(action(b, group, "promote", b), denied);
  checks++;
  await action(a, group, "promote", b);
  assert.equal(
    (await roster(b, group)).filter((m) => m.role === "leader").length,
    2,
  );
  checks++;
  await asUser(
    b,
    "select public.save_motard_group($1,1,'Renamed group','','Legal','','Public place',40,-7)",
    [group],
  );
  assert.equal(
    (
      await asUser(a, "select revision from public.motard_groups where id=$1", [
        group,
      ])
    ).rows[0].revision,
    2,
  );
  checks++;
  await assert.rejects(
    asUser(
      a,
      "select public.save_motard_group($1,1,'Stale group','','','','Public place',40,-7)",
      [group],
    ),
    (e) => e.code === "40001",
  );
  checks++;
  await action(a, group, "leave");
  await assert.rejects(action(b, group, "leave"), error("GROUP_LAST_LEADER"));
  checks++;
  await assert.rejects(
    action(b, group, "demote", b),
    error("GROUP_LAST_LEADER"),
  );
  checks++;
  await assert.rejects(
    asUser(
      a,
      "select public.save_motard_group($1,2,'Forged group','','','','Public place',40,-7)",
      [group],
    ),
    denied,
  );
  checks++;
  await action(a, group, "request");
  await action(b, group, "approve", a);
  await action(b, group, "promote", a);
  const other = await create(c, "Other association");
  await assert.rejects(
    action(b, other, "request"),
    error("GROUP_MEMBERSHIP_EXISTS"),
  );
  checks++;
  await action(d, group, "request");
  assert.ok(!(await roster(a, group)).some((m) => m.user_id === c));
  checks++;
  await assert.rejects(
    action(d, other, "request"),
    error("GROUP_MEMBERSHIP_EXISTS"),
  );
  checks++;
  await action(d, group, "withdraw");
  await action(d, other, "request");
  await assert.rejects(
    action(a, group, "approve", d),
    error("GROUP_REQUEST_UNAVAILABLE"),
  );
  checks++;
  await action(c, other, "reject", d);
  assert.equal(
    (
      await asUser(
        d,
        "select status from public.group_memberships where group_id=$1",
        [other],
      )
    ).rows[0].status,
    "declined",
  );
  checks++;
  // Both leaders try to leave concurrently; the group lock preserves one leader.
  const attempt = async (user) => {
    const con = new pg.Client({ connectionString: url });
    await con.connect();
    try {
      await con.query("begin");
      await con.query("set local role authenticated");
      await con.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
      ]);
      await con.query("select public.change_group_membership($1,'leave')", [
        group,
      ]);
      await con.query("commit");
    } finally {
      await con.end();
    }
  };
  const race = await Promise.allSettled([attempt(a), attempt(b)]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  checks++;
  assert.ok(
    error("GROUP_LAST_LEADER")(
      race.find((r) => r.status === "rejected").reason,
    ),
  );
  checks++;
  assert.equal(
    (
      await db.query(
        "select count(*) from public.group_memberships where group_id=$1 and status='accepted' and role='leader'",
        [group],
      )
    ).rows[0].count,
    "1",
  );
  checks++;
  await db.query("set role anon");
  for (const sql of [
    "select * from public.motard_groups",
    "select * from public.group_memberships",
    "select * from public.list_group_members($1)",
    "select public.change_group_membership($1,'request')",
  ]) {
    await assert.rejects(
      db.query(sql, sql.includes("$1") ? [group] : []),
      denied,
    );
    checks++;
  }
  await db.query("reset role");
  console.log(
    `${checks} group checks passed (directory, privacy, approval, multiple leaders, last leader, races, one group).`,
  );
  return checks;
}
