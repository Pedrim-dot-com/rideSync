import assert from "node:assert/strict";
import pg from "pg";
export async function runGroupInvitationChecks({ db, asUser, url }) {
  let checks = 0;
  const [leader, member, recipient, outsider, otherLeader] = [
    61, 62, 63, 64, 65,
  ].map((n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
  for (const [index, id] of [
    leader,
    member,
    recipient,
    outsider,
    otherLeader,
  ].entries()) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    await asUser(
      id,
      "update public.profiles set username=$1,display_name=$2 where id=$3",
      ["invite_user_" + index, "Invitation " + index, id],
    );
  }
  const create = async (user, name) =>
    (
      await asUser(
        user,
        "select public.save_motard_group(null,null,$1,'','','','Headquarters',0,0) as id",
        [name],
      )
    ).rows[0].id;
  const group = await create(leader, "Invitation group");
  const other = await create(otherLeader, "Other invitation group");
  const change = (user, g, action, target = null) =>
    asUser(user, "select public.change_group_membership($1,$2,$3)", [
      g,
      action,
      target,
    ]);
  await change(member, group, "request");
  await change(leader, group, "approve", member);
  const invite = async (user, g = group, username = "invite_user_2") =>
    (
      await asUser(user, "select public.invite_group_member($1,$2) as id", [
        g,
        username,
      ])
    ).rows[0].id;
  const review = (user, id, approve = true, g = group) =>
    asUser(user, "select public.review_group_invitation($1,$2,$3)", [
      g,
      id,
      approve,
    ]);
  const received = async (user) =>
    (
      await asUser(
        user,
        "select * from public.list_received_group_invitations()",
      )
    ).rows;
  const sent = async (user, g = group) =>
    (
      await asUser(
        user,
        "select * from public.list_sent_group_invitations($1)",
        [g],
      )
    ).rows;
  const respond = (user, id, accept = true) =>
    asUser(user, "select public.respond_group_invitation($1,$2) as group_id", [
      id,
      accept,
    ]);
  const revoke = (user, id, g = group) =>
    asUser(user, "select public.revoke_group_invitation($1,$2)", [g, id]);
  const denied = (e) => e.code === "42501";
  const unavailable = (e) => e.message === "GROUP_INVITATION_UNAVAILABLE";
  const id = await invite(member);
  assert.equal(await invite(member), id);
  checks++;
  assert.equal((await sent(member))[0].status, "review");
  checks++;
  assert.equal((await sent(leader)).length, 1);
  checks++;
  assert.equal((await received(recipient)).length, 0);
  checks++;
  assert.equal((await received(outsider)).length, 0);
  checks++;
  assert.equal(
    (
      await asUser(
        recipient,
        "select * from public.group_memberships where group_id=$1",
        [group],
      )
    ).rowCount,
    0,
  );
  checks++;
  await assert.rejects(invite(outsider), denied);
  checks++;
  await assert.rejects(invite(recipient), denied);
  checks++;
  await assert.rejects(review(member, id), denied);
  checks++;
  await assert.rejects(review(outsider, id), denied);
  checks++;
  await assert.rejects(review(otherLeader, id, true, group), denied);
  checks++;
  await assert.rejects(respond(recipient, id), unavailable);
  checks++;
  await assert.rejects(respond(member, id), denied);
  checks++;
  await assert.rejects(
    asUser(member, "select * from public.group_invitations"),
    denied,
  );
  checks++;
  await review(leader, id);
  assert.equal((await received(recipient))[0].status, "pending");
  checks++;
  assert.equal(
    (
      await asUser(
        recipient,
        "select * from public.group_memberships where group_id=$1",
        [group],
      )
    ).rowCount,
    0,
  );
  checks++;
  await assert.rejects(change(member, group, "approve", recipient), denied);
  checks++;
  await assert.rejects(change(recipient, group, "approve", recipient), denied);
  checks++;
  assert.equal((await respond(recipient, id)).rows[0].group_id, group);
  checks++;
  assert.equal((await received(recipient))[0].status, "joined");
  checks++;
  assert.deepEqual(
    (
      await asUser(
        recipient,
        "select role,status from public.group_memberships where group_id=$1",
        [group],
      )
    ).rows[0],
    { role: "member", status: "accepted" },
  );
  checks++;
  await assert.rejects(respond(recipient, id), unavailable);
  checks++;
  // A person admitted by invitation is a normal member and can propose invitations.
  const newlyJoinedProposal = await invite(recipient, group, "invite_user_3");
  assert.equal(
    (await sent(recipient)).find((i) => i.invitation_id === newlyJoinedProposal)
      .status,
    "review",
  );
  checks++;
  await revoke(recipient, newlyJoinedProposal);
  await change(recipient, group, "leave");
  assert.equal((await received(recipient))[0].status, "left");
  checks++;
  // Leader invitation is already approved; acceptance joins without a new application.
  const direct = await invite(leader);
  assert.equal(
    (await received(recipient)).find((i) => i.invitation_id === direct).status,
    "pending",
  );
  checks++;
  await assert.rejects(review(member, direct), denied);
  checks++;
  await respond(recipient, direct);
  assert.equal(
    (
      await asUser(
        recipient,
        "select status from public.group_memberships where group_id=$1",
        [group],
      )
    ).rows[0].status,
    "accepted",
  );
  checks++;
  await change(recipient, group, "leave");
  // Rejected proposals never reach the recipient, and sender cannot approve them.
  const rejected = await invite(member);
  await review(leader, rejected, false);
  assert.equal(
    (await sent(member)).find((i) => i.invitation_id === rejected).status,
    "rejected",
  );
  checks++;
  assert.ok(
    !(await received(recipient)).some((i) => i.invitation_id === rejected),
  );
  checks++;
  await assert.rejects(respond(recipient, rejected), unavailable);
  checks++;
  // A leader inviting the same person explicitly approves an existing proposal.
  const upgraded = await invite(member);
  assert.equal(await invite(leader), upgraded);
  checks++;
  assert.equal(
    (await received(recipient)).find((i) => i.invitation_id === upgraded)
      .status,
    "pending",
  );
  checks++;
  await revoke(leader, upgraded);
  const own = await invite(member);
  await revoke(member, own);
  checks++;
  const decline = await invite(member);
  await review(leader, decline);
  assert.equal(
    (await respond(recipient, decline, false)).rows[0].group_id,
    null,
  );
  checks++;
  assert.equal(
    (await received(recipient)).find((i) => i.invitation_id === decline).status,
    "declined",
  );
  checks++;
  // Expiry and replacement apply to review proposals too.
  const expired = await invite(member);
  await db.query(
    "update public.group_invitations set created_at=now()-interval '9 days',expires_at=now()-interval '2 days' where id=$1",
    [expired],
  );
  await assert.rejects(review(leader, expired), unavailable);
  checks++;
  const replacement = await invite(member);
  assert.notEqual(replacement, expired);
  checks++;
  await review(leader, replacement);
  await respond(recipient, replacement);
  await change(recipient, group, "leave");
  // Privacy: ordinary members see only their own proposals/invites, not a leader's.
  assert.ok(!(await sent(member)).some((i) => i.invitation_id === direct));
  checks++;
  await assert.rejects(revoke(member, direct), unavailable);
  checks++;
  // Two approved invitations race: exactly one group is joined.
  const first = await invite(member);
  await review(leader, first);
  const second = await invite(otherLeader, other);
  const attempt = async (invitation) => {
    const connection = new pg.Client({ connectionString: url });
    await connection.connect();
    try {
      await connection.query("begin");
      await connection.query("set local role authenticated");
      await connection.query(
        "select set_config('request.jwt.claim.sub',$1,true)",
        [recipient],
      );
      await connection.query(
        "select public.respond_group_invitation($1,true)",
        [invitation],
      );
      await connection.query("commit");
    } finally {
      await connection.end();
    }
  };
  const race = await Promise.allSettled([attempt(first), attempt(second)]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  checks++;
  assert.equal(
    race.find((r) => r.status === "rejected").reason.message,
    "GROUP_MEMBERSHIP_EXISTS",
  );
  checks++;
  const memberships = (
    await asUser(
      recipient,
      "select group_id,status from public.group_memberships where status='accepted'",
    )
  ).rows;
  assert.equal(memberships.length, 1);
  checks++;
  assert.equal(
    (
      await asUser(
        recipient,
        "select * from public.group_memberships where status='pending'",
      )
    ).rowCount,
    0,
  );
  checks++;
  const loser = memberships[0].group_id === group ? second : first;
  assert.equal(
    (await received(recipient)).find((i) => i.invitation_id === loser).status,
    "unavailable",
  );
  checks++;
  await assert.rejects(
    respond(recipient, loser),
    (e) => e.message === "GROUP_MEMBERSHIP_EXISTS",
  );
  checks++;
  await assert.rejects(
    invite(member, group, "invite_user_0"),
    (e) => e.message === "GROUP_RECIPIENT_UNAVAILABLE",
  );
  checks++;
  await assert.rejects(
    invite(member, group, "unknown_user"),
    (e) => e.message === "GROUP_RECIPIENT_UNAVAILABLE",
  );
  checks++;
  await assert.rejects(
    invite(member, group, "%"),
    (e) => e.message === "GROUP_RECIPIENT_UNAVAILABLE",
  );
  checks++;
  await db.query("set role anon");
  for (const [sql, args] of [
    ["select public.invite_group_member($1,$2)", [group, "invite_user_3"]],
    ["select public.review_group_invitation($1,$2,true)", [group, first]],
    ["select * from public.list_sent_group_invitations($1)", [group]],
    ["select public.revoke_group_invitation($1,$2)", [group, first]],
    ["select * from public.list_received_group_invitations()", []],
    ["select public.respond_group_invitation($1,true)", [first]],
    ["select * from public.group_invitations", []],
  ]) {
    await assert.rejects(db.query(sql, args), denied);
    checks++;
  }
  await db.query("reset role");
  console.log(
    `${checks} group invitation checks passed (member proposals, leader review, direct leader invitations, recipient consent, privacy, expiry, races).`,
  );
  return checks;
}
