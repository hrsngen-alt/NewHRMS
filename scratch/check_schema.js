import dotenv from 'dotenv';
dotenv.config();
fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/?apikey=${process.env.VITE_SUPABASE_PUBLISHABLE_KEY}`)
  .then(res => res.json())
  .then(data => {
    const props = data.definitions.attendance.properties;
    console.log("attendance columns:", Object.keys(props));
  }).catch(console.error);
