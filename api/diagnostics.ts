export default function handler(_req: any, res: any) {
  res.status(200).json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    env: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      VITE_SUPABASE_URL: Boolean(process.env.VITE_SUPABASE_URL),
      VITE_SUPABASE_ANON_KEY: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
    },
  });
}
