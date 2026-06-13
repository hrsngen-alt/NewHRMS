require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_tables');
  if (error) {
     // fallback: pg_catalog query 
     const { data: tables } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public');
     console.log(tables ? tables.map(t => t.tablename) : "Cannot fetch tables");
  } else {
     console.log(data);
  }
}
run();
