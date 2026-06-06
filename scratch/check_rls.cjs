const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Checking tables and their RLS state...");
  // Querying standard tables
  const tables = ["user_roles", "leaves", "attendance", "expense_claims", "employees"];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    console.log(`Table '${table}' query result: ${error ? "Error: " + error.message : "Success (" + (data ? data.length : 0) + " rows)"}`);
  }
}

run();
