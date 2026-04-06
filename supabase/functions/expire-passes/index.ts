import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Expire unused visitor passes
  const { data: expiredPasses, error: e1 } = await supabase.rpc("expire_unused_visitor_passes");
  
  // 2. Cleanup expired sessions
  const { data: expiredSessions, error: e2 } = await supabase.rpc("cleanup_expired_sessions");

  const result = {
    expired_passes: expiredPasses ?? 0,
    expired_sessions: expiredSessions ?? 0,
    errors: [e1?.message, e2?.message].filter(Boolean),
    timestamp: new Date().toISOString(),
  };

  console.log("[expire-passes]", JSON.stringify(result));

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
