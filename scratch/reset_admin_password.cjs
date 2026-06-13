const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Updating password for admin@pulsehr.com...");
  const { data, error } = await supabase.auth.admin.updateUserById(
    'bb675e8b-0df1-486a-9505-7588933882b1',
    { password: 'Password123!' }
  );
  if (error) {
    console.error("Error updating password:", error.message);
  } else {
    console.log("Password updated successfully!");
  }
}

run();
