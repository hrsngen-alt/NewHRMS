import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function testPayslipQuery() {
  const { data: runs } = await supabase.from("payroll_runs").select("id").limit(1);
  if (!runs || runs.length === 0) {
    console.log("No payroll runs");
    return;
  }
  const runId = runs[0].id;
  const { data, error } = await supabase.from("payslips")
    .select("*, payroll_runs(period_month, period_year), employees(*)")
    .eq("payroll_run_id", runId);
    
  console.log("Data:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
}

testPayslipQuery();
