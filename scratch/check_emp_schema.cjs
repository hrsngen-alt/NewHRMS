require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('employees').select('*').limit(1);
  if (data && data.length > 0) {
     console.log(Object.keys(data[0]));
  }
}
run();
