import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only client with the service role key. All tables have RLS on and no
// public policies, so this is the only way in. Never import from client code.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key, { auth: { persistSession: false } });
}
