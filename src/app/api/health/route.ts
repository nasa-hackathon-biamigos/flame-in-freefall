import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase: "ok" | string = "ok";
  try {
    // Not head:true — supabase-js drops the error body on HEAD, hiding a missing table.
    const { error } = await supabaseAdmin().from("rag_chunks").select("id").limit(1);
    if (error) supabase = error.message;
  } catch (e) {
    supabase = e instanceof Error ? e.message : "unknown error";
  }
  return Response.json({ ok: supabase === "ok", supabase });
}
