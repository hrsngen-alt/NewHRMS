import { createClient } from '@supabase/supabase-js';

const url = 'https://youbawkwslbaydxbjame.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('employees').select('email, full_name').order('created_at', { ascending: false }).limit(5);
  console.log(error || data);
}
run();
