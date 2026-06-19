import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const users = [
  "admin@pulsehr.com",
  "admin12@pulse.com",
  "hrsngen@gmail.com",
  "hr@sngenelab.com",
  "hardikparmar0306@gmail.com"
];

const password = "Admin@123";

async function run() {
  for (const email of users) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.log(`Failed for ${email}: ${error.message}`);
    } else {
      console.log(`SUCCESS for ${email}! Token: ${data.session?.access_token ? "Yes" : "No"}`);
    }
  }
}

run();
