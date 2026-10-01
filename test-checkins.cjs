const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="(.*)"/)[1];
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)[1];
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('employees').select('id').limit(5);
  console.log(data, error);
}
check();
