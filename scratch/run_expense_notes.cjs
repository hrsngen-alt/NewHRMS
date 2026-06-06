require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Checking expense_claims columns...');

  // Try selecting notes and admin_notes to see if they exist
  const { data, error } = await supabase
    .from('expense_claims')
    .select('id, notes, admin_notes')
    .limit(1);

  if (error && error.message.includes('column')) {
    console.log('❌ Columns missing:', error.message);
    console.log('\n👉 Please run this SQL in Supabase Dashboard → SQL Editor:\n');
    console.log('ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS notes TEXT;');
    console.log('ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS admin_notes TEXT;');
  } else if (error) {
    console.log('⚠️ Other error:', error.message);
  } else {
    console.log('✅ Both columns (notes, admin_notes) already exist in expense_claims!');
    console.log('Row count returned:', data.length);
    if (data.length > 0) console.log('Sample:', JSON.stringify(data[0]));
  }
}

run().catch(console.error);
