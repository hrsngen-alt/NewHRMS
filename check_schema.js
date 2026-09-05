const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/hardik/Downloads/NewHRMS/.env' });
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('get_schema_info'); // likely won't work
  // just try to insert a fake record to see the error for approved_by
  const { error: err } = await supabase.from('leaves').update({ approved_by: 'Krupa More' }).eq('id', '123e4567-e89b-12d3-a456-426614174000');
  console.log(err);
}
check();
