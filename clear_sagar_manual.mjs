import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('employees')
    .update({ manual_birthday_date: null })
    .ilike('full_name', '%sagar%')
    .select('id, full_name, manual_birthday_date');
    
  if (error) {
    console.error("Error updating employee:", error);
  } else {
    console.log("Successfully cleared manual birthday date for:", data);
  }
}

main().catch(console.error);
