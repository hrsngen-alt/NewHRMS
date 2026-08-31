import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('employees')
    .update({ date_of_birth: null })
    .ilike('full_name', '%sagar%')
    .select('id, full_name, date_of_birth');
    
  if (error) {
    console.error("Error updating employee:", error);
  } else {
    console.log("Successfully cleared birthday for:", data);
  }
}

main().catch(console.error);
