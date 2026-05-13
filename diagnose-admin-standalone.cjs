const { createClient } = require('@supabase/supabase-js');

async function diagnoseAdmin() {
  const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjA5NjAsImV4cCI6MjA5Mzg5Njk2MH0.sENCk7EiY9fqHXZfRpZaAGLERWUMHbAUK37ObG8zXTE";
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const email = "admin@pulse.com";

  console.log("--- Diagnosing Admin Account: " + email + " ---");

  // 1. Check if employee record exists
  const { data: employee, error: empErr } = await supabase
    .from("employees")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  
  if (empErr) console.error("Employee Error:", empErr);
  else console.log("Employee Record:", employee ? "FOUND (ID: " + employee.id + ")" : "NOT FOUND");

  // 2. Check user roles
  if (employee?.user_id) {
    const { data: roles, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", employee.user_id);
    
    if (roleErr) console.error("Role Error:", roleErr);
    else console.log("Roles assigned to user_id:", roles?.map(r => r.role).join(", ") || "NONE");
  } else {
    console.log("No user_id linked to employee record yet.");
  }

  // 3. Try to fetch user from Auth (This requires Service Role, but we can try basic check)
  console.log("\nTrying to check Auth status via metadata search...");
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .ilike("full_name", "%admin%")
    .limit(5);
  
  console.log("Profiles containing 'admin':", profile?.length || 0);
  if (profile) {
    profile.forEach(p => console.log(`- ${p.full_name} (${p.id})`));
  }

  console.log("-------------------------------------------");
}

diagnoseAdmin();
