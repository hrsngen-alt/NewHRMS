import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, full_name')
    .ilike('full_name', '%Krupa%')
    .single();

  if (empError) {
    console.error("Employee fetch error:", empError);
    return;
  }
  
  console.log("Found Employee:", employee);

  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false })
    .limit(3);
    
  if (attError) {
    console.error("Attendance fetch error:", attError);
    return;
  }
  
  console.log("Recent Attendance Records:");
  attendance.forEach(r => {
    console.log(`Date: ${r.date}, In: ${r.check_in}, Lat: ${r.check_in_lat}, Lng: ${r.check_in_lng}, Address: ${r.check_in_address}`);
  });
}
run();
