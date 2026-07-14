import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
  // Check company_locations
  const { data: locData, error: locError } = await supabase.from('company_locations').select('*').limit(1);
  console.log('company_locations:', { locData, locError });

  // Check employees
  const { data: empData, error: empError } = await supabase.from('employees').select('*').limit(1);
  console.log('employees columns:', empData ? Object.keys(empData[0] || {}) : null);
  if (empError) console.error('employees error:', empError);

  // Check attendance
  const { data: attData, error: attError } = await supabase.from('attendance').select('*').limit(1);
  console.log('attendance columns:', attData ? Object.keys(attData[0] || {}) : null);
  if (attError) console.error('attendance error:', attError);
}

check();
