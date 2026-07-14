import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envFile = fs.readFileSync(envPath, "utf8");
const envVars = Object.fromEntries(
  envFile.split("\n").filter(line => line && !line.startsWith("#")).map(line => {
    const [key, ...rest] = line.split("=");
    return [key, rest.join("=").replace(/^"(.*)"$/, "$1")];
  })
);

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_PUBLISHABLE_KEY);

async function main() {
  console.log("Checking employee...");
  const { data: employee } = await supabase
    .from("employees")
    .select("*, attendance_policies(*)")
    .eq("email", "hardikparmar0306@gmail.com")
    .single();

  console.log("Employee Policy:", JSON.stringify(employee?.attendance_policies, null, 2));
  console.log("Employee Dept:", employee?.department);

  const { data: attendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employee?.id)
    .is("check_out", null)
    .order("created_at", { ascending: false })
    .limit(1);

  console.log("Active Attendance:", JSON.stringify(attendance, null, 2));

  if (attendance && attendance.length > 0) {
    const checkIn = new Date(attendance[0].check_in);
    const now = new Date();
    const diffMins = (now.getTime() - checkIn.getTime()) / 60000;
    console.log(`Minutes since check-in: ${diffMins}`);
  }

  console.log("Running RPC...");
  const { error } = await supabase.rpc("process_auto_checkouts");
  console.log("RPC Error:", error);
}

main().catch(console.error);
