import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const { data: employees } = await supabase.from("employees").select("id, full_name, employee_code");
  const { data: attendance } = await supabase.from("attendance").select("*").gte("date", "2026-06-01").lte("date", "2026-06-30");
  const { data: leaves } = await supabase.from("leaves").select("*").eq("status", "approved");

  console.log(`Analyzing target employee EMP1028 (Admin12) and any active employees in June...`);

  employees.forEach(e => {
    const empAtt = attendance.filter(a => a.employee_id === e.id && (a.check_in || a.status === 'present'));
    const empLeaves = leaves.filter(l => l.employee_id === e.id);
    
    // Only print if EMP1028 or if they have clock-ins
    if (e.employee_code === 'EMP1028' || empAtt.length > 0) {
      console.log(`\nEmployee: ${e.full_name} (${e.employee_code})`);
      console.log(`  Clock-ins (present) count: ${empAtt.length}`);
      empAtt.forEach(a => console.log(`    - Date: ${a.date}, status: ${a.status}, check_in: ${a.check_in}`));
      console.log(`  Approved Leaves count: ${empLeaves.length}`);
      empLeaves.forEach(l => console.log(`    - ${l.start_date} to ${l.end_date} (${l.days} days)`));
    }
  });
}

main();
