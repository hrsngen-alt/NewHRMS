import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
  console.log("=== Auth Users ===");
  const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error("Auth Error:", authErr);
  } else {
    users.forEach(u => {
      console.log(`User: ${u.email} | ID: ${u.id}`);
    });
  }

  console.log("\n=== User Roles ===");
  const { data: userRoles, error: urErr } = await supabase.from('user_roles').select('*');
  if (urErr) {
    console.error("User Roles Error:", urErr);
  } else {
    userRoles.forEach(ur => {
      console.log(`UserID: ${ur.user_id} | Role: ${ur.role}`);
    });
  }

  console.log("\n=== Custom Roles ===");
  const { data: customRoles, error: crErr } = await supabase.from('custom_roles').select('*');
  if (crErr) {
    console.error("Custom Roles Error:", crErr);
  } else {
    customRoles.forEach(cr => {
      console.log(`Role: ${cr.name} | Code: ${cr.code} | ID: ${cr.id}`);
    });
  }

  console.log("\n=== Employee Custom Roles ===");
  const { data: empCustomRoles, error: ecrErr } = await supabase.from('employee_custom_roles').select('*, employees(email, full_name), custom_roles(name)');
  if (ecrErr) {
    console.error("Employee Custom Roles Error:", ecrErr);
  } else {
    empCustomRoles.forEach(ecr => {
      console.log(`Emp: ${ecr.employees?.email || ecr.employee_id} | Role: ${ecr.custom_roles?.name} | RoleID: ${ecr.role_id}`);
    });
  }

  console.log("\n=== Employees (Partial List) ===");
  const { data: employees, error: empErr } = await supabase.from('employees').select('id, email, full_name, user_id, status').limit(20);
  if (empErr) {
    console.error("Employees Error:", empErr);
  } else {
    employees.forEach(e => {
      console.log(`EmpID: ${e.id} | Email: ${e.email} | Name: ${e.full_name} | UserID: ${e.user_id} | Status: ${e.status}`);
    });
  }
}

run();
