require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: emps } = await supabase.from('employees').select('id, full_name, reporting_manager');
  console.log(emps);
}
run();
