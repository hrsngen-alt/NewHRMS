import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://youbawkwslbaydxbjame.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdWJhd2t3c2xiYXlkeGJqYW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyMDk2MCwiZXhwIjoyMDkzODk2OTYwfQ.hKHs0-CDiiIiEDTP_TcM3dQwjOZoBB30n3P81OxDPfI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function seed() {
  console.log("Seeding custom roles...");
  const roles = [
    { name: 'Super Admin', code: 'super_admin', description: 'Full system access to all modules, settings, and workflows.', is_system: true },
    { name: 'HR Admin', code: 'hr_admin', description: 'Full HR access including directory, leave management, payroll, and settings.', is_system: true },
    { name: 'HR Executive', code: 'hr_executive', description: 'Manage employees directory, attendance, leaves, and recruitment.', is_system: true },
    { name: 'Recruiter', code: 'recruiter', description: 'Access recruitment module to publish job posts and screen candidates.', is_system: true },
    { name: 'Payroll Manager', code: 'payroll_manager', description: 'Access and execute monthly payroll runs and generate salary structures.', is_system: true },
    { name: 'Department Manager', code: 'department_manager', description: 'Manage leaves, attendance, and performance for employees within their department.', is_system: true },
    { name: 'Team Lead', code: 'team_lead', description: 'Track attendance, leaves, and project performance for direct team members.', is_system: true },
    { name: 'Employee', code: 'employee', description: 'View dashboard, check in/out, submit leave requests, view profile, and download salary slips.', is_system: true },
    { name: 'Manager', code: 'manager', description: 'General manager role with team review, leave approvals, and report views.', is_system: true },
    { name: 'Software Engineer', code: 'software_engineer', description: 'Technical team member, standard employee privileges.', is_system: true },
    { name: 'QA Engineer', code: 'qa_engineer', description: 'Quality assurance team member, standard employee privileges.', is_system: true },
    { name: 'Designer', code: 'designer', description: 'Creative team member, standard employee privileges.', is_system: true }
  ];

  for (const r of roles) {
    const { data, error } = await supabase.from('custom_roles').upsert(r, { onConflict: 'code' }).select();
    if (error) {
      console.error(`Failed to upsert role ${r.code}:`, error);
    } else {
      console.log(`Upserted role ${r.code}:`, data[0].id);
    }
  }

  // Fetch all seeded roles to associate permissions
  const { data: dbRoles } = await supabase.from('custom_roles').select('id, code');
  const roleMap = {};
  dbRoles.forEach(r => {
    roleMap[r.code] = r.id;
  });

  console.log("Seeding role permissions...");
  
  // Super Admin and HR Admin get all permissions
  const modules = ['Dashboard', 'Employee Directory', 'Attendance', 'Leave', 'Payroll', 'Recruitment', 'Reports', 'Holidays', 'Announcements', 'Assets', 'Performance Management', 'Settings'];
  const actions = ['view', 'create', 'edit', 'delete'];
  
  const superAdminId = roleMap['super_admin'];
  const hrAdminId = roleMap['hr_admin'];
  
  const adminPerms = [];
  modules.forEach(m => {
    actions.forEach(a => {
      if (superAdminId) adminPerms.push({ role_id: superAdminId, module: m, action: a, scope: 'company' });
      if (hrAdminId) adminPerms.push({ role_id: hrAdminId, module: m, action: a, scope: 'company' });
    });
  });

  // Employee/Software Engineer/QA Engineer/Designer default permissions
  const empRoles = ['employee', 'software_engineer', 'qa_engineer', 'designer'];
  const empPerms = [];
  empRoles.forEach(roleCode => {
    const rId = roleMap[roleCode];
    if (rId) {
      empPerms.push(
        { role_id: rId, module: 'Dashboard', action: 'view', scope: 'self' },
        { role_id: rId, module: 'Attendance', action: 'view', scope: 'self' },
        { role_id: rId, module: 'Attendance', action: 'create', scope: 'self' },
        { role_id: rId, module: 'Leave', action: 'view', scope: 'self' },
        { role_id: rId, module: 'Leave', action: 'create', scope: 'self' },
        { role_id: rId, module: 'Performance Management', action: 'view', scope: 'self' },
        { role_id: rId, module: 'Holidays', action: 'view', scope: 'company' },
        { role_id: rId, module: 'Announcements', action: 'view', scope: 'company' },
        { role_id: rId, module: 'Employee Directory', action: 'view', scope: 'company' }
      );
    }
  });

  // Manager default permissions (similar to employee + team review/approvals)
  const managerId = roleMap['manager'];
  const managerPerms = [];
  if (managerId) {
    managerPerms.push(
      { role_id: managerId, module: 'Dashboard', action: 'view', scope: 'self' },
      { role_id: managerId, module: 'Attendance', action: 'view', scope: 'team' },
      { role_id: managerId, module: 'Attendance', action: 'create', scope: 'self' },
      { role_id: managerId, module: 'Leave', action: 'view', scope: 'team' },
      { role_id: managerId, module: 'Leave', action: 'create', scope: 'self' },
      { role_id: managerId, module: 'Performance Management', action: 'view', scope: 'team' },
      { role_id: managerId, module: 'Holidays', action: 'view', scope: 'company' },
      { role_id: managerId, module: 'Announcements', action: 'view', scope: 'company' },
      { role_id: managerId, module: 'Employee Directory', action: 'view', scope: 'company' },
      { role_id: managerId, module: 'Reports', action: 'view', scope: 'team' }
    );
  }

  const allPerms = [...adminPerms, ...empPerms, ...managerPerms];
  
  // Insert in batches
  for (const p of allPerms) {
    await supabase.from('role_permissions').upsert(p, { onConflict: 'role_id,module,action' });
  }

  console.log("All roles and permissions successfully seeded!");
}

seed();
