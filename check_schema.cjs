const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '/Users/hardik/Downloads/NewHRMS/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await supabase.from('leaves').select('*').limit(1);
  console.log("Keys:", data && data.length > 0 ? Object.keys(data[0]) : []);
}
run();
