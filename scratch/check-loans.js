import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
  console.log("Checking loans table...");
  const { data: loans, error: errorLoans } = await supabase.from("loans").select("*").limit(1);
  if (errorLoans) {
    console.error("Loans Table Error:", errorLoans.message);
  } else {
    console.log("Loans Table Exists. Sample:", loans);
  }

  console.log("Checking payroll_addons table...");
  const { data: addons, error: errorAddons } = await supabase.from("payroll_addons").select("*").limit(1);
  if (errorAddons) {
    console.error("Payroll Addons Table Error:", errorAddons.message);
  } else {
    console.log("Payroll Addons Table Exists. Sample:", addons);
  }

  console.log("Checking attendance table columns...");
  const { data: att, error: errorAtt } = await supabase.from("attendance").select("overtime_hours, is_half_day, is_late, late_minutes").limit(1);
  if (errorAtt) {
    console.error("Attendance Columns Error:", errorAtt.message);
  } else {
    console.log("Attendance Columns Exist. Sample:", att);
  }

  console.log("Checking payslips table columns...");
  const { data: payslip, error: errorPayslip } = await supabase.from("payslips").select("overtime_hours, overtime_pay, incentives, loan_deductions, absent_days, leave_days, half_days, late_marks").limit(1);
  if (errorPayslip) {
    console.error("Payslip Columns Error:", errorPayslip.message);
  } else {
    console.log("Payslip Columns Exist. Sample:", payslip);
  }
}

check();
