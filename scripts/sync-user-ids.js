import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function syncUserIds() {
    console.log("Fetching auth users...");
    const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr) {
        console.error("Error listing auth users:", authErr.message);
        return;
    }

    for (const user of users) {
        console.log(`Checking linkage for ${user.email}...`);
        const { data: employee } = await supabase.from("employees").select("id, user_id").eq("email", user.email).maybeSingle();

        if (employee) {
            if (employee.user_id === user.id) {
                console.log(`${user.email} is already correctly linked.`);
            } else {
                console.log(`Linking ${user.email} to employee record...`);
                const { error: updErr } = await supabase.from("employees").update({ user_id: user.id }).eq("id", employee.id);
                if (updErr) console.error(`Error linking ${user.email}:`, updErr.message);
                else console.log(`Linked ${user.email} successfully.`);
            }
        } else {
            console.log(`No employee record found for ${user.email} (Auth ID: ${user.id})`);
        }
    }
}

syncUserIds();
