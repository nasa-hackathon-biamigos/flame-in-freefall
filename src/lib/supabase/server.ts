import "server-only";
import { createAdminClient } from "./admin";

// App-side entry point: the "server-only" import makes any client-component import a build error.
export function supabaseAdmin() {
  return createAdminClient();
}
