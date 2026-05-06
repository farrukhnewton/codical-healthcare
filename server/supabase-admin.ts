import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createMissingSupabaseAdminProxy() {
  return new Proxy({}, {
    get() {
      throw new Error(
        "Missing Supabase server environment variables. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.",
      );
    },
  }) as ReturnType<typeof createClient>;
}

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = isSupabaseAdminConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createMissingSupabaseAdminProxy();
