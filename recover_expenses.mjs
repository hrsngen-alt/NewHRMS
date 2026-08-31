import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const employees = [
    { id: '8b77baf8-b53a-4d99-9c45-44d4cdd7f60d', name: 'Bhavesh D Bhandheri' },
    { id: 'f6b49f59-bb24-4ddb-a29f-cf683f312f08', name: 'Parth Bhatia' }
  ];

  console.log("Inserting recovered entries...");
  const claimsToInsert = [
    {
      employee_id: employees[0].id,
      title: "Client Visit Travel",
      amount: 450,
      category: "travel",
      notes: "Recovered demo entry",
      status: "pending"
    },
    {
      employee_id: employees[1].id,
      title: "Team Lunch",
      amount: 800,
      category: "meals",
      notes: "Recovered demo entry",
      status: "pending"
    }
  ];

  const { data, error } = await supabase
    .from("expense_claims")
    .insert(claimsToInsert)
    .select();

  if (error) {
    console.error("Error inserting:", error);
  } else {
    console.log("Successfully recovered 2 entries:", data);
  }
}

main().catch(console.error);
