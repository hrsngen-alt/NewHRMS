require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: emps, error: err1 } = await supabase.from('employees').select('*').limit(3);
  console.log("Employees:", emps);

  if (emps && emps.length > 0) {
    const empId = emps[0].id;
    const { data: perf, error: err2 } = await supabase.from('performance_reviews').select('*').eq('employee_id', empId);
    console.log(`Performance for ${empId}:`, perf);
  }
}
run();
