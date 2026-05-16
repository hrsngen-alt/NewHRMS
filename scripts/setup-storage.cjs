import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function setupStorage() {
  console.log("Checking buckets...");
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) return console.error(error);
  
  if (!buckets.find(b => b.name === "employee_documents")) {
    console.log("Creating bucket 'employee_documents'...");
    const { error: createErr } = await supabase.storage.createBucket("employee_documents", { public: true });
    if (createErr) return console.error("Create error:", createErr);
    console.log("Bucket created.");
  } else {
    console.log("Bucket 'employee_documents' already exists.");
  }
}

setupStorage();
