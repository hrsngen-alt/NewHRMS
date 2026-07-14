export type Scope = 'self' | 'team' | 'department' | 'branch' | 'company' | 'custom';
export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'import' | 'manage';

export const MODULES = [
  'Dashboard',
  'Employee Directory',
  'Attendance',
  'Leave',
  'Payroll',
  'Recruitment',
  'Reports',
  'Holidays',
  'Announcements',
  'Assets',
  'Performance Management',
  'Settings',
  'Bug Management',
  'Employee Access Control'
] as const;

export const ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'export',
  'import',
  'manage'
] as const;

const SCOPE_HIERARCHY: Record<Scope, number> = {
  self: 1,
  team: 2,
  department: 3,
  branch: 4,
  company: 5,
  custom: 6
};

/**
 * Compares two scopes and returns the broader one.
 * If either is 'company', it is the broadest.
 */
export function getBroaderScope(scope1: Scope, scope2: Scope): Scope {
  const rank1 = SCOPE_HIERARCHY[scope1] || 0;
  const rank2 = SCOPE_HIERARCHY[scope2] || 0;
  return rank1 >= rank2 ? scope1 : scope2;
}

export interface Permission {
  module: string;
  action: Action;
  scope: Scope;
  custom_scope_details?: any;
}
