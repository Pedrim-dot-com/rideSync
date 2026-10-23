import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
function docker(args) {
  const r = spawnSync("docker", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || "Docker command failed");
  return r.stdout.trim();
}
const name = `ridesync-test-${randomUUID()}`;
let created = false;
try {
  docker([
    "run",
    "--name",
    name,
    "-e",
    "POSTGRES_PASSWORD=local-test-only",
    "-p",
    "127.0.0.1::5432",
    "-d",
    "postgres:17",
  ]);
  created = true;
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (
      spawnSync("docker", [
        "exec",
        name,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
      ]).status === 0
    ) {
      ready = true;
      break;
    }
    await setTimeout(500);
  }
  if (!ready) throw new Error("PostgreSQL did not become ready");
  const port = docker(["port", name, "5432/tcp"]).split(":").at(-1);
  const result = spawnSync(process.execPath, ["scripts/test-db.mjs"], {
    stdio: "inherit",
    env: {
      ...process.env,
      TEST_DATABASE_URL: `postgres://postgres:local-test-only@127.0.0.1:${port}/postgres`,
    },
  });
  process.exitCode = result.status ?? 1;
} finally {
  if (created) docker(["rm", "-f", name]);
}
