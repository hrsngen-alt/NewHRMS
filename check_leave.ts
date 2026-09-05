import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '/Users/hardik/Downloads/NewHRMS/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('leaves')
    .select('*, employees!leaves_employee_id_fkey(full_name)')
    .eq('start_date', '2026-09-05');
  console.log(JSON.stringify(data, null, 2));
}
check();
