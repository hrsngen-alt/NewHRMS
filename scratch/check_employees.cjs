const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Fetching employees...");
  const { data: employees, error } = await supabase
    .from("employees")
    .select("*");
    
  if (error) {
    console.error("Error fetching employees:", error.message);
    return;
  }
  
  console.log(`Total employees: ${employees.length}`);
  employees.forEach(emp => {
    console.log(`- ID: ${emp.id}, Name: ${emp.full_name}, Email: ${emp.email}, UserID: ${emp.user_id}, Status: ${emp.status}`);
  });
}

run();
