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

  console.log("Fetching attendance before RPC...");
  const { data: attendanceBefore } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employee?.id)
    .is("check_out", null)
    .order("created_at", { ascending: false })
    .limit(1);
  console.log("Before:", attendanceBefore);

  console.log("Running RPC process_auto_checkouts...");
  const { error } = await supabase.rpc("process_auto_checkouts");
  console.log("RPC Error:", error);

  console.log("Fetching attendance after RPC...");
  const { data: attendanceAfter } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employee?.id)
    .order("created_at", { ascending: false })
    .limit(1);
  console.log("After:", attendanceAfter);
}
main().catch(console.error);
