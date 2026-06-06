const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runTest() {
  console.log("Checking app_role enum values and attempting role assignment...");

  // Try to insert a temporary user_role to check if 'manager' is accepted
  const dummyUserId = "00000000-0000-0000-0000-000000000000"; // Invalid UUID, but we just want to see if the database rejects the enum value or the foreign key constraint
  
  // Let's first query user_roles to see what's in there
  const { data: roles, error: fetchErr } = await supabase
    .from("user_roles")
    .select("*")
    .limit(5);
  
  if (fetchErr) {
    console.error("Fetch Roles Error:", fetchErr);
  } else {
    console.log("Current sample user_roles:", roles);
  }

  // Let's try to insert 'manager' for a valid user
  // Get a valid user_id from auth.users or from employee records
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("user_id, email")
    .not("user_id", "is", null)
    .limit(1);

  if (empErr) {
    console.error("Fetch Employees Error:", empErr);
    return;
  }

  if (employees.length === 0) {
    console.log("No employees with user_id found to test.");
    return;
  }

  const testUser = employees[0];
  console.log(`Testing role change to 'manager' for user: ${testUser.email} (user_id: ${testUser.user_id})`);

  // Try inserting manager role
  const { data: insData, error: insErr } = await supabase
    .from("user_roles")
    .insert({ user_id: testUser.user_id, role: "manager" })
    .select();

  if (insErr) {
    console.error("Failed to insert 'manager' role:", insErr);
  } else {
    console.log("Successfully inserted 'manager' role:", insData);
    // Clean up
    await supabase.from("user_roles").delete().eq("user_id", testUser.user_id).eq("role", "manager");
  }
}

runTest();
