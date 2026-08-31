import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("--- Birthday Functionality Test ---");
  
  // 1. Get an active employee to test with
  const { data: employees } = await supabase.from('employees').select('id, full_name').eq('status', 'active').limit(1);
  if (!employees || employees.length === 0) {
    console.error("No active employees found to test with.");
    return;
  }
  const emp = employees[0];
  console.log(`Testing with employee: ${emp.full_name} (${emp.id})`);

  // 2. Set their DOB to August 31st (Today in IST)
  // We use any year, since the function only checks MONTH and DAY.
  const testDate = '1995-08-31'; 
  console.log(`Setting DOB to: ${testDate}`);
  await supabase.from('employees').update({ date_of_birth: testDate }).eq('id', emp.id);

  // 3. Call the get_todays_birthdays function
  const { data: bdaysToday } = await supabase.rpc('get_todays_birthdays');
  const foundToday = bdaysToday?.find(b => b.id === emp.id);
  console.log(`Is the employee in today's birthdays? -> ${foundToday ? 'YES (PASS)' : 'NO (FAIL)'}`);

  // 4. Set their DOB to Tomorrow (September 1st) to test boundary
  const tomorrowDate = '1995-09-01';
  console.log(`\nSetting DOB to: ${tomorrowDate} (Tomorrow)`);
  await supabase.from('employees').update({ date_of_birth: tomorrowDate }).eq('id', emp.id);

  // 5. Call the get_todays_birthdays function again
  const { data: bdaysTomorrow } = await supabase.rpc('get_todays_birthdays');
  const foundTomorrow = bdaysTomorrow?.find(b => b.id === emp.id);
  console.log(`Is the employee in today's birthdays when their birthday is tomorrow? -> ${foundTomorrow ? 'YES (FAIL)' : 'NO (PASS)'}`);

  // 6. Cleanup
  console.log("\nCleaning up test data...");
  await supabase.from('employees').update({ date_of_birth: null }).eq('id', emp.id);
  console.log("Test Complete!");
}

main().catch(console.error);
