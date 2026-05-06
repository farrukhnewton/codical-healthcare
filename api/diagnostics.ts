import pg from "pg";

const { Pool } = pg;

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    return { ok: false, message: "DATABASE_URL is not set" };
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 1000,
    max: 1,
  });

  try {
    const result = await pool.query(`
      select
        current_database() as database,
        current_schema() as schema,
        to_regclass('public.app_bootstrap_state') is not null as has_bootstrap_state,
        to_regclass('public.users') is not null as has_users,
        to_regclass('public.conversations') is not null as has_conversations,
        to_regclass('public.participants') is not null as has_participants
    `);

    return { ok: true, ...result.rows[0] };
  } catch (error: any) {
    return {
      ok: false,
      code: error?.code || null,
      message: error?.message || "Database check failed",
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || "/api/diagnostics", `https://${req.headers.host || "localhost"}`);
  const includeDb = url.searchParams.get("db") === "1";

  res.status(200).json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    env: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      VITE_SUPABASE_URL: Boolean(process.env.VITE_SUPABASE_URL),
      VITE_SUPABASE_ANON_KEY: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
    },
    database: includeDb ? await checkDatabase() : undefined,
  });
}
