const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env manually
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]/g, '').replace(/['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY);

async function run() {
  // Query information_schema.columns
  const { data, error } = await supabase
    .from('payslips')
    .select('id')
    .limit(1);

  if (error) {
    console.error("Error querying table:", error);
    return;
  }

  // To check columns without table records, let's query a system view if we have access, or try to insert a dummy record with a missing column.
  // A clean way is to query column names via PostgREST / Rest API or try inserting a dummy object and read the error.
  console.log("Checking if we can select overtime_hours...");
  const { data: testData, error: testError } = await supabase
    .from('payslips')
    .select('id, overtime_hours, overtime_pay, incentives, loan_deductions')
    .limit(1);
    
  if (testError) {
    console.log("overtime columns DO NOT exist:", testError.message);
  } else {
    console.log("overtime columns DO exist!");
  }
}
run();
