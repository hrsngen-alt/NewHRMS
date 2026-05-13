const { createClient } = require('@supabase/supabase-js');

async function fixAdmin() {
  const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjA5NjAsImV4cCI6MjA5Mzg5Njk2MH0.sENCk7EiY9fqHXZfRpZaAGLERWUMHbAUK37ObG8zXTE";
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const email = "admin@pulse.com";

  console.log("--- Fixing Admin Account: " + email + " ---");

  // 1. Create the employee record if missing
  const { data: existing } = await supabase.from("employees").select("id").ilike("email", email).maybeSingle();
  
  if (!existing) {
    console.log("Creating employee record for admin...");
    const { error: insErr } = await supabase.from("employees").insert({
      full_name: "System Administrator",
      email: email,
      employee_code: "ADMIN-001",
      department: "Management",
      designation: "Admin"
    });
    if (insErr) console.error("Insert Error:", insErr);
    else console.log("Employee record created successfully!");
  } else {
    console.log("Employee record already exists.");
  }

  // 2. We can't set the password directly without Service Key, 
  // but we can tell the user to use the Reset Tool I built.
  
  console.log("\nNEXT STEPS FOR YOU:");
  console.log("1. Go to: https://new-hrms-kappa.vercel.app/dev-reset");
  console.log("2. Use email: " + email);
  console.log("3. Use password: Admin@123");
  console.log("4. Click 'Force Update Password'.");
  console.log("-------------------------------------------");
}

fixAdmin();
