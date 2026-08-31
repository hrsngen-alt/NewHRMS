import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: employee } = await supabase
    .from("employees")
    .select("*, attendance_policies(*)")
    .ilike("full_name", "%admin12%")
    .single();

  console.log("Fetching attendance before RPC...");
  const { data: attendanceBefore } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employee?.id)
    .order("created_at", { ascending: false })
    .limit(3);
  console.log("Before:", attendanceBefore);

  console.log("Running RPC process_auto_checkouts...");
  await supabase.rpc("process_auto_checkouts");

  console.log("Running RPC end_of_day_auto_checkout...");
  const { error } = await supabase.rpc("end_of_day_auto_checkout");
  console.log("RPC Error (end_of_day):", error);

  console.log("Fetching attendance after RPC...");
  const { data: attendanceAfter } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employee?.id)
    .order("created_at", { ascending: false })
    .limit(3);
  console.log("After:", attendanceAfter);
}
main().catch(console.error);
