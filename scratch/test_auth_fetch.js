import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  // log in as admin user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@pulsehrms.com', // fallback admin email if it exists
    password: 'admin' // or whatever password
  });
  
  if (authError) {
    console.log("Auth error, try user:", authError.message);
    // Let's create an anonymous user? No, just sign in as someone we can find
  }
}
run();
