import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Fetching corrupted auto checkouts...");
  const { data: records, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("check_out_type", "Forget Check Out");

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${records.length} records to fix.`);

  for (const rec of records) {
    const checkInDate = new Date(rec.check_in);
    
    // We want 11:59 PM in IST for the same local day.
    // Let's create an IST formatter
    const localDateStr = checkInDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    
    // Parse it back to UTC time corresponding to 11:59 PM IST
    const checkoutTimeIST = new Date(`${localDateStr}T23:59:00+05:30`);
    
    // Calculate new hours worked
    const diffHours = (checkoutTimeIST.getTime() - checkInDate.getTime()) / 3600000;
    const hoursWorked = Math.max(0, parseFloat(diffHours.toFixed(2)));

    console.log(`Updating ${rec.id} to check_out: ${checkoutTimeIST.toISOString()} (${hoursWorked} hours)`);

    await supabase.from("attendance").update({
      check_out: checkoutTimeIST.toISOString(),
      hours_worked: hoursWorked
    }).eq("id", rec.id);
  }
  console.log("Done.");
}
main().catch(console.error);
