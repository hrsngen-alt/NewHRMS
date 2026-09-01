import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const url = 'https://youbawkwslbaydxbjame.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, date, check_in, check_out, check_out_type')
    .eq('check_out_type', 'Forget Check Out')
    .order('created_at', { ascending: false })
    .limit(1);
    
  console.log(JSON.stringify(data, null, 2));
}

run();
