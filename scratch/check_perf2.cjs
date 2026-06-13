require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: perf, error: err2 } = await supabase.from('performance_reviews').select('*');
  console.log(`Performance length:`, perf ? perf.length : 0);
  console.log(`Performance data:`, perf);
  
  const { data: emps, error: err3 } = await supabase.from('employees').select('id, full_name, user_id').limit(5);
  console.log(`Employees:`, emps);
}
run();
