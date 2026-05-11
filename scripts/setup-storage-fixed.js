import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function setupStorage() {
    console.log("Checking 'expense_receipts' bucket...");
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
        console.error("Error listing buckets:", listError.message);
        return;
    }

    const bucketName = 'expense_receipts';
    const exists = buckets.find(b => b.name === bucketName);

    if (!exists) {
        console.log(`Creating '${bucketName}' bucket...`);
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 5242880, // 5MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf']
        });
        if (createError) console.error("Error creating bucket:", createError.message);
        else console.log("Bucket created successfully!");
    } else {
        console.log(`Bucket '${bucketName}' already exists.`);
    }

    // Storage policies usually need to be set via SQL, but some can be done via API if the RPC exists.
    // Since we don't have an RPC for SQL, we'll suggest SQL to the user.
    console.log("Storage setup script finished.");
}

setupStorage();
