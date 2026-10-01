const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('attendance').select('check_in, date, employee_name').order('check_in', { ascending: false }).limit(5);
  console.log(data);
}
check();
