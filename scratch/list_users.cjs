const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Listing auth users...");
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Auth users error:", error.message);
  } else {
    console.log("Auth users:");
    users.forEach(u => console.log(`- Email: ${u.email}, ID: ${u.id}`));
  }
}

run();
