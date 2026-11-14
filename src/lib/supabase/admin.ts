import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Usable from scripts (rag:ingest) and, through server.ts, from the app.
 * All tables have RLS on and no public policies, so this is the only way in.
 * Never import this from client components.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key, { auth: { persistSession: false } });
}
