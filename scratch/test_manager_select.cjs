const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function run() {
  console.log("Signing in as a temporary manager (admin@pulsehr.com) in Account department...");
  const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const targetEmail = "admin@pulsehr.com";
  
  const { data: employee } = await adminClient.from("employees").select("id, user_id, department").eq("email", targetEmail).single();
  const oldDept = employee.department;
  console.log(`Target User ID: ${employee.user_id}, Current Dept: ${oldDept}`);

  // Temporarily set department to Account and role to manager
  await adminClient.from("employees").update({ department: "Account" }).eq("id", employee.id);
  await adminClient.from("user_roles").delete().eq("user_id", employee.user_id);
  await adminClient.from("user_roles").insert({ user_id: employee.user_id, role: "manager" });

  // Sign in
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password: "Admin@123"
  });

  if (authErr) {
    console.error("Sign in failed:", authErr.message);
    // Restore
    await adminClient.from("employees").update({ department: oldDept }).eq("id", employee.id);
    await adminClient.from("user_roles").delete().eq("user_id", employee.user_id);
    await adminClient.from("user_roles").insert({ user_id: employee.user_id, role: "admin" });
    return;
  }

  console.log("Signed in successfully. Token user ID:", authData.user.id);

  // Query leaves
  const { data: leaves, error: leavesErr } = await supabase
    .from("leaves")
    .select("*, employees(full_name, department)");
  
  if (leavesErr) {
    console.error("Fetch leaves failed:", leavesErr.message);
  } else {
    console.log(`Fetch leaves succeeded: found ${leaves.length} records.`);
    leaves.forEach(l => {
      console.log(`- Employee: ${l.employees?.full_name}, Dept: ${l.employees?.department}, Status: ${l.status}`);
    });
  }

  // Restore everything
  await adminClient.from("employees").update({ department: oldDept }).eq("id", employee.id);
  await adminClient.from("user_roles").delete().eq("user_id", employee.user_id);
  await adminClient.from("user_roles").insert({ user_id: employee.user_id, role: "admin" });
  console.log("Restored department and role.");
}

run();
