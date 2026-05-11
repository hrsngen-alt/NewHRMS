import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function testUpdate() {
  console.log("Starting update...");
  // Try to update admin@pulsehr.com with a valid user.id
  // We need to fetch the real user.id from auth.users via admin API
  const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) return console.error("Auth Err:", authErr);
  
  const adminUser = users.find(u => u.email === "admin@pulsehr.com");
  if (!adminUser) return console.error("Admin user not found in auth.users");
  
  console.log("Real Auth user.id:", adminUser.id);
  
  const { data: emp } = await supabase.from("employees").select("*").eq("email", "admin@pulsehr.com").single();
  console.log("Employee currently has user_id:", emp.user_id);
  
  if (emp.user_id !== adminUser.id) {
    console.log("Updating employee user_id...");
    const { error: updateErr } = await supabase.from("employees").update({ user_id: adminUser.id }).eq("id", emp.id);
    console.log("Update Error:", updateErr);
  } else {
    console.log("Already matched");
  }
}

testUpdate();
