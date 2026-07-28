import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const container = `codical-pgx-${randomUUID().slice(0, 8)}`;

function docker(args: string[], input?: string, allowFailure = false) {
  const result = spawnSync("docker", args, { encoding: "utf8", input, stdio: input === undefined ? "pipe" : ["pipe", "pipe", "pipe"] });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`docker ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result;
}

function psql(sql: string) {
  return docker(["exec", "-i", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "codical_pgx_test"], sql);
}

try {
  docker(["run", "--name", container, "-e", "POSTGRES_PASSWORD=pgx_test_password", "-e", "POSTGRES_DB=codical_pgx_test", "-d", "postgres:16-alpine"]);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const check = docker(["exec", container, "psql", "-At", "-U", "postgres", "-d", "codical_pgx_test", "-c", "select 1"], undefined, true);
    if (check.status === 0) {
      ready = true;
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  if (!ready) throw new Error("PostgreSQL test database did not become ready.");
  psql(`
    create table users (id integer primary key, supabase_id text);
    create schema auth;
    create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  `);
  psql(fs.readFileSync("migrations/0005_pgx_phase1_schema.sql", "utf8"));
  const phase2 = fs.readFileSync("migrations/0006_pgx_phase2_evidence_workflow.sql", "utf8");
  psql(phase2);
  psql(phase2);
  const result = psql(`
    select 'tables=' || count(*) from pg_tables where schemaname='public' and tablename like 'pgx_%';
    select 'rls=' || count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'pgx_%' and c.relkind='r' and c.relrowsecurity;
    select 'triggers=' || count(*) from pg_trigger where not tgisinternal and tgname like 'pgx_%';
  `);
  process.stdout.write(result.stdout);
} finally {
  docker(["rm", "-f", container], undefined, true);
}
