require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('employees').select('total_experience').limit(1);
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Success! Column exists. Data:", data);
  }
}
run();
