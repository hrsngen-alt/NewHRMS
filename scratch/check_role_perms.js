import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
  console.log("=== Role Permissions ===");
  const { data: rolePerms, error: rpErr } = await supabase
    .from('role_permissions')
    .select('*, custom_roles(name, code)');
    
  if (rpErr) {
    console.error("Error:", rpErr);
    return;
  }

  const grouped = {};
  rolePerms.forEach(rp => {
    const roleName = rp.custom_roles?.name || rp.role_id;
    if (!grouped[roleName]) grouped[roleName] = [];
    grouped[roleName].push(`${rp.module}:${rp.action} (${rp.scope})`);
  });

  for (const [role, perms] of Object.entries(grouped)) {
    console.log(`\nRole: ${role}`);
    perms.forEach(p => console.log(`  - ${p}`));
  }
}

run();
