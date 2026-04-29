import { createClient } from '@supabase/supabase-js'

type CodicalRuntimeEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

declare global {
  interface Window {
    __CODICAL_ENV__?: CodicalRuntimeEnv;
  }
}

const runtimeEnv = typeof window !== "undefined" ? window.__CODICAL_ENV__ : undefined;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || runtimeEnv?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || runtimeEnv?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase browser configuration.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
