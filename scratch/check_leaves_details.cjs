const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: leaves, error: leavesErr } = await supabase
    .from("leaves")
    .select("*, employees(*)");
  
  if (leavesErr) {
    console.error("Fetch leaves failed:", leavesErr);
    return;
  }
  
  console.log("Leaves details:");
  leaves.forEach(l => {
    console.log(`- Leaf ID: ${l.id}, Employee: ${l.employees?.full_name}, Dept: ${l.employees?.department}, UserID: ${l.employees?.user_id}`);
  });
}

run();
