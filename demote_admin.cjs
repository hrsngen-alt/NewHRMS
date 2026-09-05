const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '/Users/hardik/Downloads/NewHRMS/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  console.log("Demoting admin@pulsehr.com...");
  
  // 1. Get the user's UUID from the profiles or employees table since we can't query auth.users directly
  const { data: profile } = await supabase.from('profiles').select('id').eq('full_name', 'admin@pulsehr.com').maybeSingle();
  let userId = profile?.id;
  
  if (!userId) {
     const { data: emp } = await supabase.from('employees').select('user_id').eq('email', 'admin@pulsehr.com').maybeSingle();
     userId = emp?.user_id;
  }
  
  if (!userId) {
      console.log("Could not find user ID for admin@pulsehr.com. Trying to just delete by email... wait, user_roles doesn't have email.");
      // If we don't have the user ID, we'll just have to do it through a direct query if possible, but anon key restricts it.
  }
  
  if (userId) {
      console.log("Found User ID:", userId);
      // Wait, anon key might not have RLS permission to delete from user_roles or update profiles for OTHER users.
      // We will just inform the user if this fails.
      const { error: err1 } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
      const { error: err2 } = await supabase.from('profiles').update({ role: 'employee' }).eq('id', userId);
      console.log("Delete admin role error:", err1);
      console.log("Update profile role error:", err2);
      console.log("Done.");
  }
}
run();
