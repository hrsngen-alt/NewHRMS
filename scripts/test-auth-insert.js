import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
// ANON KEY from .env
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjA5NjAsImV4cCI6MjA5Mzg5Njk2MH0.sENCk7EiY9fqHXZfRpZaAGLERWUMHbAUK37ObG8zXTE";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testAuthInsert() {
  console.log("Logging in as admin@pulsehr.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@pulsehr.com',
    password: 'Admin@123',
  });

  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }
  console.log("Logged in!");

  const obj = {
    full_name: "Auth Test Employee",
    email: "authtest@example.com",
    basic_salary: 0,
    hra: 0,
    conveyance: 0,
    medical: 0,
    special_allowance: 0
  };
  
  console.log("Trying to insert:", obj);
  const { data, error } = await supabase.from("employees").insert(obj).select();
  
  if (error) {
    console.error("Insert failed:", error);
  } else {
    console.log("Insert succeeded:", data);
  }
}

testAuthInsert();
