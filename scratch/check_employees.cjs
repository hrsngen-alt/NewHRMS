const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: employees, error } = await supabase
    .from("employees")
    .select("*");
  
  if (error) {
    console.error("Fetch employees failed:", error);
    return;
  }

  console.log("Employees table content:");
  employees.forEach(e => {
    console.log(`- Name: ${e.full_name}, Email: ${e.email}, UserID: ${e.user_id}, Dept: ${e.department}, Code: ${e.employee_code}`);
  });
}

run();
