const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Checking pg_policies through PostgREST...");
  const { data, error } = await supabase.from("pg_policies").select("*");
  if (error) {
    console.error("Query pg_policies error:", error.message);
  } else {
    console.log("pg_policies:", data);
  }
}

run();
