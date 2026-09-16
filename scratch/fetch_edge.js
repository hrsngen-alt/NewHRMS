import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/attendance-cached?role=admin`;
  console.log("Fetching:", url);
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${process.env.VITE_SUPABASE_PUBLISHABLE_KEY}` }
    });
    const json = await res.json();
    console.log("Keys of first item:", Object.keys(json.data?.[0] || {}));
    console.log("Item:", json.data?.[0]);
  } catch (e) {
    console.error(e);
  }
}
run();
