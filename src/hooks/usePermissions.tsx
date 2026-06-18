import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { getBroaderScope, type Scope, type Action, type Permission, MODULES } from "@/lib/permissions";

export interface CompiledPermission {
  module: string;
  action: Action;
  scope: Scope;
  allowed: boolean;
}

export function usePermissions() {
  const { employeeId, role, isAdmin } = useAuth();
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

  const { data: compiledPermissions = {}, isLoading } = useQuery({
    queryKey: ["user-permissions", employeeId, role],
    enabled: !!employeeId,
    queryFn: async () => {
      const permissionsMap: Record<string, Record<string, { allowed: boolean; scope: Scope }>> = {};

      // Initialize with false for all modules and actions
      MODULES.forEach(m => {
        permissionsMap[m] = {};
      });

      // BACKWARD COMPATIBILITY & LEGACY SUPER ADMIN/HR ADMIN BYPASS
      // If employee has legacy "admin" role or email is an admin email, grant full permissions
      if (isAdmin) {
        MODULES.forEach(m => {
          permissionsMap[m] = {
            manage: { allowed: true, scope: "company" },
            view: { allowed: true, scope: "company" },
            create: { allowed: true, scope: "company" },
            edit: { allowed: true, scope: "company" },
            delete: { allowed: true, scope: "company" },
            approve: { allowed: true, scope: "company" },
            export: { allowed: true, scope: "company" },
            import: { allowed: true, scope: "company" }
          };
        });
        return permissionsMap;
      }

      try {
        // 1. Fetch assigned custom roles
        const { data: assignedRoles } = await (supabase as any)
          .from("employee_custom_roles")
          .select("role_id, custom_roles(code)")
          .eq("employee_id", employeeId);

        // 2. Fetch active temporary delegations to this employee
        const { data: activeDelegations } = await (supabase as any)
          .from("temporary_delegations")
          .select("role_id")
          .eq("to_employee_id", employeeId)
          .eq("status", "active")
          .lte("start_date", todayStr)
          .gte("end_date", todayStr);

        let finalRoleIds = [];
        let hasAdminRole = false;

        const assignedRoleIds = (assignedRoles ?? []).map((r: any) => r.role_id);
        const delegatedRoleIds = (activeDelegations ?? []).map((d: any) => d.role_id);

        if (assignedRoleIds.length > 0) {
          finalRoleIds = [...assignedRoleIds, ...delegatedRoleIds];
          hasAdminRole = (assignedRoles ?? []).some((r: any) => r.custom_roles?.code === "super_admin" || r.custom_roles?.code === "hr_admin");
        } else {
          // If no custom role is explicitly assigned, resolve designation to a default system/custom role
          const { data: employee } = await (supabase as any)
            .from("employees")
            .select("designation")
            .eq("id", employeeId)
            .maybeSingle();

          if (employee?.designation) {
            const designationCode = employee.designation.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
            
            // Look up corresponding custom role ID & code
            const { data: defaultRole } = await (supabase as any)
              .from("custom_roles")
              .select("id, code")
              .eq("code", designationCode)
              .maybeSingle();

            if (defaultRole) {
              finalRoleIds = [defaultRole.id, ...delegatedRoleIds];
              hasAdminRole = defaultRole.code === "super_admin" || defaultRole.code === "hr_admin";
            } else {
              finalRoleIds = [...delegatedRoleIds];
            }
          } else {
            finalRoleIds = [...delegatedRoleIds];
          }
        }

        const allRoleIds = Array.from(new Set(finalRoleIds));

        // Check if any role is a super_admin or hr_admin
        if (hasAdminRole) {
          MODULES.forEach(m => {
            permissionsMap[m] = {
              manage: { allowed: true, scope: "company" },
              view: { allowed: true, scope: "company" },
              create: { allowed: true, scope: "company" },
              edit: { allowed: true, scope: "company" },
              delete: { allowed: true, scope: "company" },
              approve: { allowed: true, scope: "company" },
              export: { allowed: true, scope: "company" },
              import: { allowed: true, scope: "company" }
            };
          });
          return permissionsMap;
        }

        // 3. Fetch permissions for these roles
        if (allRoleIds.length > 0) {
          const { data: rolePerms } = await (supabase as any)
            .from("role_permissions")
            .select("module, action, scope")
            .in("role_id", allRoleIds);

          (rolePerms ?? []).forEach((rp: any) => {
            const m = rp.module;
            const a = rp.action;
            const s = rp.scope as Scope;

            if (permissionsMap[m]) {
              const current = permissionsMap[m][a];
              if (!current) {
                permissionsMap[m][a] = { allowed: true, scope: s };
              } else {
                permissionsMap[m][a] = {
                  allowed: true,
                  scope: getBroaderScope(current.scope, s)
                };
              }
            }
          });
        }

        // 4. Fetch and apply user permission overrides
        const { data: overrides } = await (supabase as any)
          .from("user_permission_overrides")
          .select("module, action, allow, scope")
          .eq("employee_id", employeeId);

        (overrides ?? []).forEach((o: any) => {
          const m = o.module;
          const a = o.action;
          const allow = o.allow;
          const s = o.scope as Scope;

          if (permissionsMap[m]) {
            permissionsMap[m][a] = { allowed: allow, scope: s };
          }
        });
      } catch (err) {
        console.error("[usePermissions] Failed to load permissions:", err);
      }

      // Default fallback: if no custom roles are set, default to standard "employee" or "manager" permissions
      const hasAnyPermissionSet = Object.values(permissionsMap).some(actions => Object.keys(actions).length > 0);
      if (!hasAnyPermissionSet) {
        const isManager = role === "manager";
        
        permissionsMap["Dashboard"] = { view: { allowed: true, scope: "self" } };
        permissionsMap["Attendance"] = { 
          view: { allowed: true, scope: isManager ? "team" : "self" },
          create: { allowed: true, scope: "self" },
          approve: { allowed: isManager, scope: "team" }
        };
        permissionsMap["Leave"] = { 
          view: { allowed: true, scope: isManager ? "team" : "self" },
          create: { allowed: true, scope: "self" },
          approve: { allowed: isManager, scope: "team" }
        };
        permissionsMap["Performance Management"] = { 
          view: { allowed: true, scope: isManager ? "team" : "self" } 
        };
        permissionsMap["Holidays"] = { view: { allowed: true, scope: "company" } };
        permissionsMap["Announcements"] = { view: { allowed: true, scope: "company" } };
        permissionsMap["Employee Directory"] = { view: { allowed: true, scope: "company" } };
        permissionsMap["Reports"] = { view: { allowed: isManager, scope: "team" } };
      }

      return permissionsMap;
    }
  });

  /**
   * Evaluates if the user has permission to perform an action on a module.
   */
  const hasPermission = (module: string, action: string): boolean => {
    // If the legacy role is admin, let them do everything
    if (isAdmin) return true;

    const modulePerms = compiledPermissions[module];
    if (!modulePerms) return false;

    // Check if they have direct access to this action or 'manage' action
    const directAction = modulePerms[action];
    const manageAction = modulePerms["manage"];

    if (manageAction?.allowed) return true;
    return directAction?.allowed ?? false;
  };

  /**
   * Returns the data scope for a given module and action.
   */
  const getScope = (module: string, action: string): Scope => {
    if (isAdmin) return "company";

    const modulePerms = compiledPermissions[module];
    if (!modulePerms) return "self";

    const directAction = modulePerms[action];
    const manageAction = modulePerms["manage"];

    if (manageAction?.allowed) {
      return manageAction.scope;
    }
    return directAction?.scope ?? "self";
  };

  return {
    permissions: compiledPermissions,
    isLoading,
    hasPermission,
    getScope
  };
}
