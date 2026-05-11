import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkAndFix() {
  console.log("--- Checking User Roles ---");
  const { data: roles, error: roleErr } = await supabase.from("user_roles").select("*");
  console.log("Current Roles:", roles);

  const targetUser = "162891c0-f65a-4a02-aeb2-2040798da8e9"; // hrsngen@gmail.com

  console.log("--- Ensuring Admin Role for hrsngen@gmail.com ---");
  const { error: insErr } = await supabase.from("user_roles").upsert({
    user_id: targetUser,
    role: "admin"
  }, { onConflict: 'user_id,role' });

  if (insErr) console.error("Error inserting role:", insErr);
  else console.log("Success: Role assigned.");

  console.log("--- Ensuring Profile Exists ---");
  const { error: profErr } = await supabase.from("profiles").upsert({
    id: targetUser,
    full_name: "Hardik Admin",
    created_at: new Date().toISOString()
  }, { onConflict: 'id' });

  if (profErr) console.error("Error inserting profile:", profErr);
  else console.log("Success: Profile created/updated.");
}

checkAndFix();
