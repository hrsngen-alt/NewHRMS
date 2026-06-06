const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Checking if 'notes' column exists in 'employees' table...");
  const { data, error } = await supabase.from("employees").select("*").limit(1);
  if (error) {
    console.error("Select error:", error.message);
  } else {
    console.log("Success! Columns in row:", data.length > 0 ? Object.keys(data[0]) : "No rows in table to inspect");
  }
}

run();
