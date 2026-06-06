const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function runTest() {
  console.log("Signing in as admin@pulsehr.com...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "admin@pulsehr.com",
    password: "Admin@123"
  });

  if (authErr) {
    console.error("Sign in failed:", authErr);
    return;
  }

  console.log("Signed in successfully. Token user ID:", authData.user.id);

  // Now, try to delete and insert a role for another user as this signed-in user
  // Let's get another user's ID
  const { data: users, error: userErr } = await supabase
    .from("user_roles")
    .select("user_id")
    .neq("user_id", authData.user.id)
    .limit(1);

  if (userErr) {
    console.error("Fetch other user role failed:", userErr);
    return;
  }

  if (users.length === 0) {
    console.log("No other user found to test role change.");
    return;
  }

  const targetUserId = users[0].user_id;
  console.log("Attempting to delete role for user:", targetUserId);

  const { data: delData, error: delErr } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", targetUserId);

  if (delErr) {
    console.error("Delete role failed (RLS error?):", delErr);
  } else {
    console.log("Delete role succeeded.");
  }

  console.log("Attempting to insert 'employee' role for user:", targetUserId);
  const { data: insData, error: insErr } = await supabase
    .from("user_roles")
    .insert({ user_id: targetUserId, role: "employee" })
    .select();

  if (insErr) {
    console.error("Insert role failed (RLS error?):", insErr);
  } else {
    console.log("Insert role succeeded:", insData);
  }
}

runTest();
