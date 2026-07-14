import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: employee } = await supabase
    .from("employees")
    .select("*, attendance_policies(*)")
    .eq("email", "hardikparmar0306@gmail.com")
    .single();

  console.log("Employee Policy:", employee?.attendance_policies);

  const { data: attendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employee?.id)
    .is("check_out", null)
    .order("created_at", { ascending: false })
    .limit(1);

  console.log("Latest Active Attendance:", attendance);
}
main().catch(console.error);
