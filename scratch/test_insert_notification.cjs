const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Testing insert into notifications with 'link' column...");
  // Let's get a valid user_id
  const { data: users } = await supabase.from("user_roles").select("user_id").limit(1);
  if (users.length === 0) {
    console.log("No users found to test.");
    return;
  }
  const userId = users[0].user_id;

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      title: "Test Link",
      message: "Testing link column",
      type: "info",
      is_read: false,
      link: "/test-link"
    })
    .select();
  
  if (error) {
    console.error("Insert failed:", error.message);
  } else {
    console.log("Insert succeeded!", data);
    // Cleanup
    await supabase.from("notifications").delete().eq("id", data[0].id);
  }
}

run();
