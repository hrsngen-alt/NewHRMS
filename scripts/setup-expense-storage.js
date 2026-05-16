const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service role for bucket creation usually

async function setup() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.log("No service role key found. Skipping bucket creation script.");
    return;
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  console.log("Creating 'expense_receipts' bucket...");
  const { data, error } = await supabase.storage.createBucket('expense_receipts', {
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf']
  });

  if (error) console.log("Bucket might already exist or error:", error.message);
  else console.log("Bucket created successfully!");
}

setup();
