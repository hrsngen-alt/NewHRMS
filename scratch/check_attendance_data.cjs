const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Fetching attendance records...");
  const { data: attendance, error } = await supabase
    .from("attendance")
    .select("*, employees(full_name, email)");
    
  if (error) {
    console.error("Error fetching attendance:", error.message);
    return;
  }
  
  console.log(`Total attendance records: ${attendance.length}`);
  
  const grouped = {};
  attendance.forEach(rec => {
    const empName = rec.employees?.full_name || rec.employee_id;
    if (!grouped[empName]) grouped[empName] = [];
    grouped[empName].push(rec);
  });
  
  for (const empName in grouped) {
    console.log(`\nEmployee: ${empName} (${grouped[empName].length} records)`);
    grouped[empName].slice(0, 10).forEach(rec => {
      console.log(`  - Date: ${rec.date}, CheckIn: ${rec.check_in}, CheckOut: ${rec.check_out}`);
    });
    if (grouped[empName].length > 10) {
      console.log(`  - ... and ${grouped[empName].length - 10} more records`);
    }
  }
}

run();
