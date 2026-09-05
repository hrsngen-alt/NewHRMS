import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '/Users/hardik/Downloads/NewHRMS/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

async function run() {
  const { data, error } = await supabase.from('leaves').select('id, status, approved_by').limit(5);
  console.log("Data:", data);
  console.log("Error:", error);
}
run();
