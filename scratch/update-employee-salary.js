import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from("employees")
    .update({
      basic_salary: 18746,
      hra: 15945,
      bonus: 2800,
      pf_amount: 0,
      esic_amount: 141,
      gratuity_amount: 900,
      conveyance: 0,
      medical: 0,
      special_allowance: 0
    })
    .eq("email", "hr@sngenelab.com")
    .select();

  if (error) {
    console.error("Update failed:", error);
  } else {
    console.log("Update succeeded. New record details:", data[0]);
  }
}

run();
