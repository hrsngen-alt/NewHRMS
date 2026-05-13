import { supabase } from "./src/integrations/supabase/client";

async function diagnoseAdmin() {
  const email = "admin@pulse.com";
  console.log("--- Diagnosing Admin Account: " + email + " ---");

  // 1. Check if employee record exists
  const { data: employee, error: empErr } = await (supabase.from("employees") as any)
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
    console.log("No user_id linked to employee record yet. The user needs to login first.");
  }

  // 3. Check profiles
  if (employee?.user_id) {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", employee.user_id).maybeSingle();
    console.log("Profile Record:", profile ? "FOUND" : "NOT FOUND");
  }

  console.log("-------------------------------------------");
}

diagnoseAdmin();
