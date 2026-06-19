import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
  console.log("=== RLS Policies ===");
  const { data: policies, error } = await supabase.rpc('get_policies_diagnostics');
  
  if (error) {
    // If RPC doesn't exist, we query pg_policies using an ad-hoc sql execution if possible, or direct fetch via postgres schema tables.
    // Since we don't have direct SQL execution RPC, let's run a select on information_schema or similar.
    console.error("RPC Error (get_policies_diagnostics may not exist):", error.message);
    
    // Let's try executing standard select from pg_catalog/pg_policies via a generic query or check custom table RLS status.
    // Wait, let's just inspect tables directly to see what we can find.
  } else {
    console.log("Policies:", policies);
  }

  // Let's check RLS status of tables:
  const tables = ["custom_roles", "employee_custom_roles", "role_permissions", "user_permission_overrides"];
  for (const t of tables) {
    const { data, error: err } = await supabase.from(t).select('*').limit(1);
    console.log(`Table '${t}' - select check: ${err ? "Error: " + err.message : "Success"}`);
  }
}

run();
