import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createUser() {
    const email = 'user@example.com';
    const password = 'Password123';

    console.log(`Checking if user ${email} exists...`);
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
        console.error("Error listing users:", listError.message);
        return;
    }

    const existingUser = users.find(u => u.email === email);

    if (existingUser) {
        console.log("User already exists. Updating password...");
        const { data, error } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password: password }
        );
        if (error) console.error("Error updating password:", error.message);
        else console.log("Password updated successfully!");
    } else {
        console.log("Creating new user...");
        const { data, error } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { full_name: 'Test User' }
        });
        if (error) console.error("Error creating user:", error.message);
        else console.log("User created successfully!");
    }
}

createUser();
