require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: att } = await supabase.from('attendance').select('*').limit(3);
  console.log(`Attendance length:`, att ? att.length : 0);
  
  const { data: leaves } = await supabase.from('leaves').select('*').limit(3);
  console.log(`Leaves length:`, leaves ? leaves.length : 0);
  
  const { data: payslips } = await supabase.from('payslips').select('*').limit(3);
  console.log(`Payslips length:`, payslips ? payslips.length : 0);
}
run();
