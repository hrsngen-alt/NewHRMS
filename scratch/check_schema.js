import { createClient } from '@supabase/supabase-js';

const url = 'https://youbawkwslbaydxbjame.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.rpc('get_tables');
  
  const tables = ['leaves', 'resignations', 'expense_claims'];
  for (const t of tables) {
    const { data: cols } = await supabase.from(t).select('*').limit(1);
    console.log(t, cols && cols.length > 0 ? Object.keys(cols[0]) : "No data or columns hidden");
  }
}
run();
