const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjA5NjAsImV4cCI6MjA5Mzg5Njk2MH0.sENCk7EiY9fqHXZfRpZaAGLERWUMHbAUK37ObG8zXTE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  console.log("--- EMPLOYEES ---");
  const { data: emp, error: e1 } = await supabase.from('employees').select('id, full_name, email, user_id');
  console.log(emp);
  
  console.log("\n--- PROFILES ---");
  const { data: prof, error: e2 } = await supabase.from('profiles').select('id, full_name');
  console.log(prof);

  console.log("\n--- BUCKETS ---");
  const { data: buckets, error: e3 } = await supabase.storage.listBuckets();
  console.log(buckets?.map(b => b.name));
}

check();
