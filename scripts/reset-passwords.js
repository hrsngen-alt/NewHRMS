import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function resetPasswords() {
    const usersToReset = [
        { email: 'admin@pulsehr.com', password: 'Admin@123' },
        { email: 'john.doe@pulsehr.com', password: 'Admin@123' }
    ];

    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
        console.error("Error listing users:", listError.message);
        return;
    }

    for (const target of usersToReset) {
        const user = users.find(u => u.email === target.email);
        if (user) {
            console.log(`Updating password for ${target.email}...`);
            const { error } = await supabase.auth.admin.updateUserById(user.id, { password: target.password });
            if (error) console.error(`Error updating ${target.email}:`, error.message);
            else console.log(`${target.email} password updated to ${target.password}`);
        } else {
            console.log(`${target.email} not found. Creating...`);
             const { error } = await supabase.auth.admin.createUser({
                email: target.email,
                password: target.password,
                email_confirm: true
            });
            if (error) console.error(`Error creating ${target.email}:`, error.message);
            else console.log(`${target.email} created with password ${target.password}`);
        }
    }
}

resetPasswords();
