import { createClient } from '@supabase/supabase-js';

const url = 'https://youbawkwslbaydxbjame.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI';
const supabase = createClient(url, key);

async function run() {
  const testEmail = `test_security_${Date.now()}@gmail.com`;
  
  // 1. Create a dummy user
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    email_confirm: true,
    user_metadata: { full_name: 'Security Test' }
  });
  
  if (authErr) {
    console.error("Failed to create user:", authErr);
    return;
  }
  
  console.log("Created user with ID:", authData.user.id);
  
  // 2. Wait a second for trigger to complete
  await new Promise(r => setTimeout(r, 1000));
  
  // 3. Check if an employee record was created
  const { data: empData, error: empErr } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', authData.user.id);
    
  console.log("Employees found for this user:", empData?.length || 0);
  
  if (empData?.length === 0) {
    console.log("SUCCESS: The database did NOT auto-create an employee record!");
  } else {
    console.log("FAILED: The database STILL auto-created an employee record!");
  }
  
  // 4. Cleanup
  await supabase.auth.admin.deleteUser(authData.user.id);
  console.log("Cleaned up test user.");
}

run();
