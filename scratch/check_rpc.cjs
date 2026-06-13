require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { query: "SELECT 1;" });
  console.log("exec_sql exists?", !error);
}
run();
