import { createClient } from '@supabase/supabase-js';

const url = 'https://youbawkwslbaydxbjame.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.rpc('get_tables');
  console.log(data);
}
run();
