require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: policies } = await supabase.rpc('get_policies_for_tables', { tables: ['employees', 'performance_reviews'] });
  if (policies) {
     console.log("Policies:", policies);
  } else {
     // fallback if rpc doesn't exist
     const { data } = await supabase.from('pg_policies').select('*'); // This fails because it's pg_catalog, but wait, maybe not exposed to API.
     console.log(data);
  }
}
run();
