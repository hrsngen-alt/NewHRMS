require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: emps } = await supabase.from('employees').select('id, basic_salary, hra, special_allowance, conveyance, medical, pf_amount, esic_amount').limit(3);
  console.log(emps);
}
run();
