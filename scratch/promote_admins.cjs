const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ADMIN_EMAILS = [
  "admin@pulsehr.com",
  "admin@admin.com",
  "admin1@admin.com",
  "hr@pulsehr.com",
  "hardik@pulsehr.com",
  "hrsngen@gmail.com",
  "admin@pulse.com",
  "admin12@pulse.com"
];

async function run() {
  console.log("Starting admin promotion...");
  
  // Fetch all auth users
  const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error("Auth list error:", authErr.message);
    return;
  }
  
  for (const u of users) {
    const emailLower = u.email.toLowerCase();
    if (ADMIN_EMAILS.includes(emailLower)) {
      console.log(`\nPromoting ${emailLower} (ID: ${u.id})...`);
      
      // 1. Delete existing role entries to prevent duplicates
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", u.id);
      if (delErr) {
        console.error(`  - Failed to delete roles:`, delErr.message);
      }
      
      // 2. Insert admin role
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: u.id, role: "admin" });
      if (insErr) {
        console.error(`  - Failed to insert admin role:`, insErr.message);
      } else {
        console.log(`  - Promoted to admin in user_roles table.`);
      }
      
      // 3. Update profile role
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", u.id);
      if (profErr) {
        console.error(`  - Failed to update profile role:`, profErr.message);
      } else {
        console.log(`  - Promoted to admin in profiles table.`);
      }
    }
  }
}

run();
