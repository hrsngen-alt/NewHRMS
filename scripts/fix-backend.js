import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function fix() {
  console.log("1. Creating Storage Buckets...");
  const buckets = ['expense_receipts', 'employee_documents'];
  for (const b of buckets) {
    const { error } = await supabase.storage.createBucket(b, { public: true });
    if (error) console.log(`Bucket '${b}' might already exist:`, error.message);
    else console.log(`Bucket '${b}' created.`);
  }

  console.log("\n2. Finding Admin User...");
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) return console.error("Error listing users:", userError);
  
  const adminUser = users.users.find(u => u.email === 'admin@pulsehr.com');
  if (!adminUser) return console.error("Admin user not found!");
  
  console.log("Admin ID:", adminUser.id);

  console.log("\n3. Ensuring Profile exists...");
  await supabase.from('profiles').upsert({
    id: adminUser.id,
    full_name: 'HR Admin',
    role: 'admin'
  });

  console.log("\n4. Ensuring Admin Role exists...");
  await supabase.from('user_roles').upsert({
    user_id: adminUser.id,
    role: 'admin'
  });

  console.log("\n5. Creating Admin Employee Record...");
  const { data: emp, error: empError } = await supabase.from('employees').upsert({
    user_id: adminUser.id,
    full_name: 'HR Admin',
    email: 'admin@pulsehr.com',
    employee_code: 'EMP000',
    department: 'Administration',
    designation: 'HR Manager',
    status: 'active'
  }).select();

  if (empError) console.error("Error creating employee:", empError);
  else console.log("Admin employee record created/updated:", emp[0].id);

  console.log("\n6. Fixing RLS Policies (Storage)...");
  // We can't easily run arbitrary SQL via the client without an RPC, 
  // but we already have the SQL file for the user to run.
  // However, the buckets are now created so that's half the battle.
}

fix();
