import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function linkProfiles() {
    const profiles = [
        { email: 'admin@pulsehr.com', full_name: 'HR Admin' },
        { email: 'john.doe@pulsehr.com', full_name: 'John Doe' }
    ];

    for (const prof of profiles) {
        console.log(`Checking employee record for ${prof.email}...`);
        const { data: employee } = await supabase.from("employees").select("id").eq("email", prof.email).maybeSingle();

        if (employee) {
            console.log(`Employee record exists for ${prof.email}.`);
        } else {
            console.log(`Creating employee record for ${prof.email}...`);
            const { error: insErr } = await supabase.from("employees").insert({
                email: prof.email,
                full_name: prof.full_name,
                employee_code: 'EMP_' + Math.random().toString(36).substring(7).toUpperCase(),
                status: 'active'
            });
            if (insErr) console.error(`Error creating employee for ${prof.email}:`, insErr.message);
            else console.log(`Created employee record for ${prof.email}`);
        }
    }
}

linkProfiles();
