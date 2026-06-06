const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Checking if 'notifications' table exists in the database...");
  const { data, error } = await supabase.from("notifications").select("*").limit(5);
  if (error) {
    console.error("Notifications table error:", error.message);
  } else {
    console.log("Notifications table exists! Current sample rows:", data);
  }
}

run();
