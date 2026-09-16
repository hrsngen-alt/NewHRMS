import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('attendance').select('id, check_in_lat, check_in_lng, check_in_address, check_out_address').order('created_at', { ascending: false }).limit(5);
  console.log('Error:', error);
  console.log('Data:', data);
}
run();
