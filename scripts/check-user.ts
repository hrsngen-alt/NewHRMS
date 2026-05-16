import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjA5NjAsImV4cCI6MjA5Mzg5Njk2MH0.sENCk7EiY9fqHXZfRpZaAGLERWUMHbAUK37ObG8zXTE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUser() {
  const targetEmail = "hrsngen@gmail.com";
  console.log("--- Checking for:", targetEmail, "---");

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("*")
    .ilike("email", targetEmail)
    .maybeSingle();

  if (empErr) {
    console.error("Query Error:", empErr);
  } else if (emp) {
    console.log("Employee Record FOUND!");
    console.log("ID:", emp.id);
    console.log("Name:", emp.full_name);
    console.log("Current Linked user_id:", emp.user_id || "NULL (NOT LINKED)");
  } else {
    console.log("Employee Record NOT FOUND in employees table.");
    console.log("Recommendation: Please add an employee with email 'hrsngen@gmail.com' in the Employees page.");
  }

  console.log("--------------------------------");
}

checkUser();
