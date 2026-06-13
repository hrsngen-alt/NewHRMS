const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Fetching user_roles...");
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("*");
    
  if (error) {
    console.error("Error fetching roles:", error.message);
    return;
  }
  
  console.log(`Total user_roles rows: ${roles.length}`);
  roles.forEach(r => {
    console.log(`- UserID: ${r.user_id}, Role: ${r.role}`);
  });
}

run();
