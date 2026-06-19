import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase = supabaseClient as any;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { logSecurityAudit } from "@/lib/audit";
import { cn } from "../lib/utils";
import { 
  ShieldAlert, ShieldCheck, Users, Workflow, CalendarClock, History, Plus, Edit2, 
  Trash2, Copy, Archive, ArrowRight, Settings, Check, Search, Filter, ShieldAlert as AlertTriangle,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { MODULES, ACTIONS, type Scope, type Action } from "@/lib/permissions";

export const Route = createFileRoute("/access-control")({
  component: () => (
    <AppShell>
      <AccessControlCenter />
    </AppShell>
  )
});

const EMPTY_ARRAY: any[] = [];
const MATRIX_ACTIONS: Action[] = ['view', 'create', 'edit', 'delete'];

function AccessControlCenter() {
  const qc = useQueryClient();
  const { role: legacyRole, isAdmin: legacyIsAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("roles");

  // Query custom roles
  const { data: roles = EMPTY_ARRAY, isLoading: loadingRoles } = useQuery({
    queryKey: ["custom-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custom_roles").select("*").order("name");
      if (error) throw error;
      return data || [];
    }
  });

  // Query employees
  const { data: employees = EMPTY_ARRAY, isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees-for-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name, email, department, designation").eq("status", "active").order("full_name");
      if (error) throw error;
      return data || [];
    }
  });

  // Query employee role mappings
  const { data: employeeRoles = EMPTY_ARRAY, isLoading: loadingEmployeeRoles } = useQuery({
    queryKey: ["employee-custom-roles-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_custom_roles").select("employee_id, role_id, custom_roles(name)");
      if (error) throw error;
      return data || [];
    }
  });

  // Query role permissions
  const { data: rolePermissions = EMPTY_ARRAY, isLoading: loadingPermissions } = useQuery({
    queryKey: ["role-permissions-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("*");
      if (error) throw error;
      return data || [];
    }
  });

  // Query overrides
  const { data: overrides = EMPTY_ARRAY, isLoading: loadingOverrides } = useQuery({
    queryKey: ["user-permission-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_permission_overrides").select("*");
      if (error) throw error;
      return data || [];
    }
  });

  // Query delegations
  const { data: delegations = EMPTY_ARRAY, isLoading: loadingDelegations } = useQuery({
    queryKey: ["temporary-delegations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("temporary_delegations").select("*, from:employees!from_employee_id(full_name), to:employees!to_employee_id(full_name), custom_roles(name)");
      if (error) throw error;
      return data || [];
    }
  });

  // Query workflows
  const { data: workflows = EMPTY_ARRAY, isLoading: loadingWorkflows } = useQuery({
    queryKey: ["approval-workflows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("approval_workflows").select("*").order("name");
      if (error) throw error;
      return data || [];
    }
  });

  // Query audit logs
  const [logSearch, setLogSearch] = useState("");
  const { data: auditLogs = EMPTY_ARRAY, isLoading: loadingLogs } = useQuery({
    queryKey: ["security-audit-logs", logSearch],
    queryFn: async () => {
      let q = supabase.from("security_audit_logs" as any).select("*").order("created_at", { ascending: false }).limit(100);
      if (logSearch) {
        q = q.or(`employee_name.ilike.%${logSearch}%,action.ilike.%${logSearch}%,module.ilike.%${logSearch}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    }
  });

  // Role form states
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: "", description: "", code: "" });
  const [editingRole, setEditingRole] = useState<any>(null);

  // Override dialog states
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [overrideEmployee, setOverrideEmployee] = useState<any>(null);

  // Workflow builder states
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [workflowForm, setWorkflowForm] = useState<{ name: string; workflow_type: string; steps: Array<{ step: number; role_id: string; name: string }> }>({
    name: "",
    workflow_type: "leave",
    steps: []
  });

  // Delegation states
  const [isDelegationDialogOpen, setIsDelegationDialogOpen] = useState(false);
  const [delegationForm, setDelegationForm] = useState({ from_employee_id: "", to_employee_id: "", role_id: "", start_date: "", end_date: "" });

  // Employees pagination for User Assignments tab
  const [employeesPage, setEmployeesPage] = useState(1);
  const EMPLOYEES_PER_PAGE = 5;
  const totalEmployeesPages = Math.ceil(employees.length / EMPLOYEES_PER_PAGE);
  const paginatedEmployees = useMemo(() => {
    const start = (employeesPage - 1) * EMPLOYEES_PER_PAGE;
    return employees.slice(start, start + EMPLOYEES_PER_PAGE);
  }, [employees, employeesPage]);

  const activeRole = roles.find((r: any) => r.id === selectedRoleId) || null;

  // Local state for role permissions and user overrides to avoid saving on every click
  const [localRolePermissions, setLocalRolePermissions] = useState<any[] | null>(null);
  const [localOverrides, setLocalOverrides] = useState<any[] | null>(null);
  const [isSavingRolePerms, setIsSavingRolePerms] = useState(false);
  const [isSavingOverrides, setIsSavingOverrides] = useState(false);

  // Track synced states to prevent infinite loop re-updates
  const [syncedRoleId, setSyncedRoleId] = useState<string | null>(null);
  const [syncedEmployeeId, setSyncedEmployeeId] = useState<string | null>(null);

  // Sync localRolePermissions when activeRole or rolePermissions query changes
  useEffect(() => {
    if (activeRole) {
      if (activeRole.id !== syncedRoleId || !localRolePermissions) {
        const activeRolePerms = rolePermissions
          .filter((p: any) => p.role_id === activeRole.id)
          .map((p: any) => ({
            role_id: p.role_id,
            module: p.module,
            action: p.action,
            scope: p.scope
          }));
        setLocalRolePermissions(activeRolePerms);
        setSyncedRoleId(activeRole.id);
      }
    } else {
      if (syncedRoleId !== null || localRolePermissions !== null) {
        setLocalRolePermissions(null);
        setSyncedRoleId(null);
      }
    }
  }, [activeRole?.id, rolePermissions, syncedRoleId, localRolePermissions]);

  // Sync localOverrides when overrideEmployee or overrides query changes
  useEffect(() => {
    if (overrideEmployee) {
      if (overrideEmployee.id !== syncedEmployeeId || !localOverrides) {
        const empOverrides = overrides
          .filter((o: any) => o.employee_id === overrideEmployee.id)
          .map((o: any) => ({
            employee_id: o.employee_id,
            module: o.module,
            action: o.action,
            allow: o.allow,
            scope: o.scope
          }));
        setLocalOverrides(empOverrides);
        setSyncedEmployeeId(overrideEmployee.id);
      }
    } else {
      if (syncedEmployeeId !== null || localOverrides !== null) {
        setLocalOverrides(null);
        setSyncedEmployeeId(null);
      }
    }
  }, [overrideEmployee?.id, overrides, syncedEmployeeId, localOverrides]);

  // Memoized check for unsaved role permissions changes
  const isRolePermissionsDirty = (() => {
    if (!activeRole || !localRolePermissions) return false;
    const dbPerms = rolePermissions.filter((p: any) => p.role_id === activeRole.id);
    if (dbPerms.length !== localRolePermissions.length) return true;
    
    const dbMap = new Map(dbPerms.map((p: any) => [`${p.module}-${p.action}`, p.scope]));
    for (const lp of localRolePermissions) {
      const dbScope = dbMap.get(`${lp.module}-${lp.action}`);
      if (!dbScope || dbScope !== lp.scope) {
        return true;
      }
    }
    return false;
  })();

  // Memoized check for unsaved overrides
  const isOverridesDirty = (() => {
    if (!overrideEmployee || !localOverrides) return false;
    const dbOverrides = overrides.filter((o: any) => o.employee_id === overrideEmployee.id);
    if (dbOverrides.length !== localOverrides.length) return true;

    const dbMap = new Map<string, any>(dbOverrides.map((o: any) => [`${o.module}-${o.action}`, { allow: o.allow, scope: o.scope }]));
    for (const lo of localOverrides) {
      const dbVal = dbMap.get(`${lo.module}-${lo.action}`);
      if (!dbVal || dbVal.allow !== lo.allow || dbVal.scope !== lo.scope) {
        return true;
      }
    }
    return false;
  })();

  // Close override modal safely helper
  const handleCloseOverrideDialog = () => {
    setIsOverrideDialogOpen(false);
    setOverrideEmployee(null);
    setLocalOverrides(null);
  };

  // Safeguard role access: strictly restricted to super/hr admin legacy roles or configured roles
  if (!legacyIsAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-card border rounded-2xl p-8 max-w-md mx-auto shadow-elegant">
        <ShieldAlert className="size-12 text-destructive animate-pulse" />
        <h2 className="text-2xl font-black tracking-tight text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground font-medium">This module is restricted to Administrators only.</p>
      </div>
    );
  }

  // Create or update role
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.name || !roleForm.code) return toast.error("Please fill in role name and code");

    try {
      const payload = {
        name: roleForm.name,
        code: roleForm.code.toLowerCase().replace(/\s+/g, "_"),
        description: roleForm.description
      };

      if (editingRole) {
        const { error } = await supabase.from("custom_roles").update(payload).eq("id", editingRole.id);
        if (error) throw error;
        toast.success("Role updated successfully!");
        logSecurityAudit({ action: `Updated Custom Role: ${payload.name}`, module: "Settings" });
      } else {
        const { error } = await supabase.from("custom_roles").insert(payload);
        if (error) throw error;
        toast.success("Role created successfully!");
        logSecurityAudit({ action: `Created Custom Role: ${payload.name}`, module: "Settings" });
      }

      setIsRoleDialogOpen(false);
      setRoleForm({ name: "", description: "", code: "" });
      setEditingRole(null);
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save role");
    }
  };

  // Delete Role
  const handleDeleteRole = async (id: string, name: string, isSystem: boolean) => {
    if (isSystem) return toast.error("System roles cannot be deleted!");
    if (!confirm(`Are you sure you want to delete the role '${name}'?`)) return;

    try {
      const { error } = await supabase.from("custom_roles").delete().eq("id", id);
      if (error) throw error;
      toast.success("Role deleted!");
      logSecurityAudit({ action: `Deleted Custom Role: ${name}`, module: "Settings" });
      if (selectedRoleId === id) setSelectedRoleId(null);
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Toggle permission in matrix
  // Toggle permission locally in matrix
  const handleLocalPermissionToggle = (module: string, action: Action, isChecked: boolean, currentScope: Scope = "company") => {
    if (!activeRole || !localRolePermissions) return;

    if (isChecked) {
      const exists = localRolePermissions.some(p => p.module === module && p.action === action);
      if (!exists) {
        setLocalRolePermissions([
          ...localRolePermissions,
          { role_id: activeRole.id, module, action, scope: currentScope }
        ]);
      }
    } else {
      setLocalRolePermissions(localRolePermissions.filter(p => !(p.module === module && p.action === action)));
    }
  };

  // Change data scope locally
  const handleLocalScopeChange = (module: string, action: Action, nextScope: Scope) => {
    if (!localRolePermissions) return;
    setLocalRolePermissions(
      localRolePermissions.map(p => {
        if (p.module === module && p.action === action) {
          return { ...p, scope: nextScope };
        }
        return p;
      })
    );
  };

  // Batch Save Role Permissions to database
  const handleSaveRolePermissions = async () => {
    const roleId = activeRole?.id;
    if (!roleId || !localRolePermissions) return;

    setIsSavingRolePerms(true);
    try {
      // 1. Delete existing role permissions
      const { error: deleteError } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId);

      if (deleteError) throw deleteError;

      // 2. Insert new permissions if any are checked
      if (localRolePermissions.length > 0) {
        const insertPayload = localRolePermissions.map(p => ({
          role_id: roleId,
          module: p.module,
          action: p.action,
          scope: p.scope
        }));
        
        const { error: insertError } = await supabase
          .from("role_permissions")
          .insert(insertPayload);
          
        if (insertError) throw insertError;
      }

      toast.success("Role permissions saved successfully!");
      logSecurityAudit({ action: `Updated permissions for role: ${activeRole.name}`, module: "Settings" });
      qc.invalidateQueries({ queryKey: ["role-permissions-matrix"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save permissions");
    } finally {
      setIsSavingRolePerms(false);
    }
  };

  // Discard local Role Permissions changes
  const handleDiscardRolePermissions = () => {
    if (!activeRole) return;
    const activeRolePerms = rolePermissions
      .filter((p: any) => p.role_id === activeRole.id)
      .map((p: any) => ({
        role_id: p.role_id,
        module: p.module,
        action: p.action,
        scope: p.scope
      }));
    setLocalRolePermissions(activeRolePerms);
    toast.info("Changes discarded.");
  };

  // Local helper to apply permission templates
  const handleApplyTemplate = (template: string) => {
    const roleId = activeRole?.id;
    if (!roleId) return;

    let newPerms: any[] = [];
    if (template === "full") {
      for (const m of MODULES) {
        for (const a of ACTIONS) {
          newPerms.push({ role_id: roleId, module: m, action: a, scope: "company" });
        }
      }
    } else if (template === "read") {
      for (const m of MODULES) {
        newPerms.push({ role_id: roleId, module: m, action: "view" as Action, scope: "company" });
      }
    } else if (template === "self") {
      const selfModules = ["Dashboard", "Attendance", "Leave", "Performance Management"];
      for (const m of selfModules) {
        newPerms.push({ role_id: roleId, module: m, action: "view" as Action, scope: "self" });
      }
    }
    setLocalRolePermissions(newPerms);
    toast.success(`Template applied locally. Click Save to apply changes.`);
  };

  // User Custom Role assignment
  const handleAssignUserRole = async (employeeId: string, roleId: string) => {
    try {
      // Delete existing custom roles for user
      await supabase.from("employee_custom_roles").delete().eq("employee_id", employeeId);

      if (roleId && roleId !== "none") {
        const { error } = await supabase.from("employee_custom_roles").insert({
          employee_id: employeeId,
          role_id: roleId
        });
        if (error) throw error;
      }

      toast.success("Employee role mapping updated!");
      qc.invalidateQueries({ queryKey: ["employee-custom-roles-mapping"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Toggle Override Permission locally
  const handleLocalOverrideToggle = (module: string, action: Action, isChecked: boolean, isAllow: boolean, currentScope: Scope = "company") => {
    if (!overrideEmployee || !localOverrides) return;

    if (isChecked) {
      const exists = localOverrides.some(o => o.module === module && o.action === action);
      if (exists) {
        setLocalOverrides(
          localOverrides.map(o => {
            if (o.module === module && o.action === action) {
              return { ...o, allow: isAllow, scope: currentScope };
            }
            return o;
          })
        );
      } else {
        setLocalOverrides([
          ...localOverrides,
          { employee_id: overrideEmployee.id, module, action, allow: isAllow, scope: currentScope }
        ]);
      }
    } else {
      setLocalOverrides(localOverrides.filter(o => !(o.module === module && o.action === action)));
    }
  };

  // Override Scope Change locally
  const handleLocalOverrideScopeChange = (module: string, action: Action, nextScope: Scope) => {
    if (!localOverrides) return;
    setLocalOverrides(
      localOverrides.map(o => {
        if (o.module === module && o.action === action) {
          return { ...o, scope: nextScope };
        }
        return o;
      })
    );
  };

  // Save user permission overrides to database
  const handleSaveOverrides = async () => {
    if (!overrideEmployee || !localOverrides) return;

    setIsSavingOverrides(true);
    try {
      // Delete existing overrides for this employee
      const { error: deleteError } = await supabase
        .from("user_permission_overrides")
        .delete()
        .eq("employee_id", overrideEmployee.id);

      if (deleteError) throw deleteError;

      // Insert new overrides
      if (localOverrides.length > 0) {
        const insertPayload = localOverrides.map(o => ({
          employee_id: overrideEmployee.id,
          module: o.module,
          action: o.action,
          allow: o.allow,
          scope: o.scope
        }));

        const { error: insertError } = await supabase
          .from("user_permission_overrides")
          .insert(insertPayload);

        if (insertError) throw insertError;
      }

      toast.success("User permission overrides saved successfully!");
      logSecurityAudit({ action: `Updated permission overrides for employee: ${overrideEmployee.full_name}`, module: "Settings" });
      setIsOverrideDialogOpen(false);
      setOverrideEmployee(null);
      setLocalOverrides(null);
      qc.invalidateQueries({ queryKey: ["user-permission-overrides"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save overrides");
    } finally {
      setIsSavingOverrides(false);
    }
  };

  // Clone Role
  const handleCloneRole = async (targetRole: any) => {
    const newName = prompt(`Enter name for the cloned role:`, `Copy of ${targetRole.name}`);
    if (!newName) return;

    try {
      const newCode = newName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      
      // 1. Create role
      const { data: newRole, error: roleErr } = await supabase
        .from("custom_roles")
        .insert({
          name: newName,
          code: newCode,
          description: `Cloned from ${targetRole.name}. ${targetRole.description || ""}`
        })
        .select().single();
      if (roleErr || !newRole) throw roleErr;

      // 2. Fetch source permissions
      const { data: sourcePerms } = await supabase
        .from("role_permissions")
        .select("module, action, scope")
        .eq("role_id", targetRole.id);

      // 3. Copy permissions
      if (sourcePerms && sourcePerms.length > 0) {
        const clonedPerms = sourcePerms.map((p: any) => ({
          role_id: newRole.id,
          module: p.module,
          action: p.action,
          scope: p.scope
        }));
        const { error: permErr } = await supabase.from("role_permissions").insert(clonedPerms);
        if (permErr) throw permErr;
      }

      toast.success("Role cloned successfully!");
      logSecurityAudit({ action: `Cloned Custom Role: ${targetRole.name} -> ${newName}`, module: "Settings" });
      setSelectedRoleId(newRole.id);
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
      qc.invalidateQueries({ queryKey: ["role-permissions-matrix"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Delegation save
  const handleSaveDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegationForm.from_employee_id || !delegationForm.to_employee_id || !delegationForm.role_id || !delegationForm.start_date || !delegationForm.end_date) {
      return toast.error("Please fill in all delegation fields");
    }

    try {
      const { error } = await supabase.from("temporary_delegations").insert(delegationForm);
      if (error) throw error;

      toast.success("Access delegation scheduled!");
      logSecurityAudit({ action: `Delegated Access: Employee ID ${delegationForm.from_employee_id} -> ${delegationForm.to_employee_id}`, module: "Settings" });
      setIsDelegationDialogOpen(false);
      setDelegationForm({ from_employee_id: "", to_employee_id: "", role_id: "", start_date: "", end_date: "" });
      qc.invalidateQueries({ queryKey: ["temporary-delegations"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Revoke delegation
  const handleRevokeDelegation = async (id: string) => {
    try {
      const { error } = await supabase
        .from("temporary_delegations")
        .update({ status: "revoked" })
        .eq("id", id);
      if (error) throw error;
      toast.success("Delegation revoked!");
      qc.invalidateQueries({ queryKey: ["temporary-delegations"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Add Workflow step
  const handleAddWorkflowStep = () => {
    setWorkflowForm(prev => ({
      ...prev,
      steps: [...prev.steps, { step: prev.steps.length + 1, role_id: roles[0]?.id || "", name: "Reviewer" }]
    }));
  };

  // Workflow save
  const handleSaveWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflowForm.name || workflowForm.steps.length === 0) {
      return toast.error("Please enter workflow name and configure at least 1 step");
    }

    try {
      const { error } = await supabase.from("approval_workflows").insert({
        name: workflowForm.name,
        workflow_type: workflowForm.workflow_type,
        steps: workflowForm.steps
      });
      if (error) throw error;

      toast.success("Approval workflow saved!");
      setIsWorkflowDialogOpen(false);
      setWorkflowForm({ name: "", workflow_type: "leave", steps: [] });
      qc.invalidateQueries({ queryKey: ["approval-workflows"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <ShieldCheck className="size-10 text-primary" /> Access Control Center
          </h1>
          <p className="text-sm font-medium text-muted-foreground/60 mt-1">Manage global enterprise roles, dynamic permission matrices, and workflow gates.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="outline" className="rounded-xl font-bold h-11"><Settings className="size-4 mr-2" /> Back to Settings</Button>
          </Link>
        </div>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={(val) => {
          if (activeTab === "roles" && isRolePermissionsDirty) {
            if (!confirm("You have unsaved changes in the permission matrix. Discard changes?")) {
              return;
            }
          }
          setActiveTab(val);
        }} 
        className="w-full"
      >
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl h-auto w-full flex flex-wrap justify-start gap-2 mb-8">
          <TabsTrigger value="roles" className="rounded-xl font-bold gap-2 py-2.5 flex-1 max-w-[240px] data-[state=active]:shadow-md">
            <ShieldCheck className="size-4" /> Role Matrix
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl font-bold gap-2 py-2.5 flex-1 max-w-[240px] data-[state=active]:shadow-md">
            <Users className="size-4" /> User Assignments
          </TabsTrigger>
          <TabsTrigger value="workflows" className="rounded-xl font-bold gap-2 py-2.5 flex-1 max-w-[240px] data-[state=active]:shadow-md">
            <Workflow className="size-4" /> Approval Workflows
          </TabsTrigger>
          <TabsTrigger value="delegations" className="rounded-xl font-bold gap-2 py-2.5 flex-1 max-w-[240px] data-[state=active]:shadow-md">
            <CalendarClock className="size-4" /> Temp Access
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl font-bold gap-2 py-2.5 flex-1 max-w-[240px] data-[state=active]:shadow-md">
            <History className="size-4" /> Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ROLES & PERMISSION MATRIX */}
        <TabsContent value="roles" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Custom Roles List */}
            <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden lg:col-span-1">
              <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black">Roles</CardTitle>
                </div>
                <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="icon" className="size-8 rounded-lg"><Plus className="size-4" /></Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl p-8 max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black">{editingRole ? "Edit Role" : "Create Custom Role"}</DialogTitle>
                      <DialogDescription>Define a new security context role for database and navigation guard gates.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveRole} className="space-y-5 mt-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Role Name</Label>
                        <Input placeholder="e.g. Finance Analyst" value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} required className="h-11 rounded-xl" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Unique Role Code</Label>
                        <Input placeholder="e.g. finance_analyst" value={roleForm.code} disabled={!!editingRole} onChange={e => setRoleForm({ ...roleForm, code: e.target.value })} required className="h-11 rounded-xl" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Description</Label>
                        <Textarea placeholder="Define duties or module visibility scopes..." value={roleForm.description} onChange={e => setRoleForm({ ...roleForm, description: e.target.value })} className="rounded-xl min-h-[80px]" />
                      </div>
                      <DialogFooter>
                        <Button type="submit" className="w-full h-11 rounded-xl font-bold">{editingRole ? "Save Changes" : "Create Role"}</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-3 space-y-1">
                {roles.map((r: any) => {
                  const isActive = selectedRoleId === r.id;
                  return (
                    <div 
                      key={r.id}
                      onClick={() => {
                        if (isRolePermissionsDirty) {
                          if (!confirm("You have unsaved changes for this role. Discard changes?")) {
                            return;
                          }
                        }
                        setSelectedRoleId(r.id);
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all border ${
                        isActive 
                          ? "bg-primary/10 border-primary text-primary font-bold shadow-sm" 
                          : "border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-sm tracking-tight truncate flex items-center gap-1.5">
                          {r.name}
                          {r.is_system && <span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-1.5 py-0.2 rounded-full uppercase">System</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate font-medium mt-0.5">{r.description || "No description"}</p>
                      </div>
                      <div className="flex gap-1 shrink-0 opacity-80 hover:opacity-100">
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleCloneRole(r); }} className="size-6 text-muted-foreground hover:text-primary"><Copy className="size-3" /></Button>
                        {!r.is_system && (
                          <>
                            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingRole(r); setRoleForm({ name: r.name, code: r.code, description: r.description || "" }); setIsRoleDialogOpen(true); }} className="size-6 text-muted-foreground hover:text-primary"><Edit2 className="size-3" /></Button>
                            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteRole(r.id, r.name, r.is_system); }} className="size-6 text-muted-foreground hover:text-rose-500"><Trash2 className="size-3" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Permission Matrix */}
            {activeRole ? (
              <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden lg:col-span-3">
                <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-black">Permission Matrix: {activeRole.name}</CardTitle>
                    <CardDescription className="text-xs font-medium">Assign access gates for view, create, edit, and delete permissions.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table className="w-full min-w-[800px]">
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-transparent">
                        <TableHead className="font-bold text-[10px] pl-6 py-4 text-slate-800 dark:text-slate-200">Module</TableHead>
                        {MATRIX_ACTIONS.map(action => (
                          <TableHead key={action} className="font-bold text-[10px] text-center capitalize text-slate-800 dark:text-slate-200">{action}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y">
                      {MODULES.map(module => (
                        <TableRow key={module} className="hover:bg-muted/10">
                          <TableCell className="font-bold pl-6 text-sm tracking-tight text-slate-900 dark:text-white">{module}</TableCell>
                          {MATRIX_ACTIONS.map(action => {
                            const perm = (localRolePermissions || []).find((p: any) => p.module === module && p.action === action);
                            const isChecked = !!perm;
                            const currentScope: Scope = perm?.scope || "company";

                            return (
                              <TableCell key={action} className="text-center p-3">
                                <div className="flex flex-col items-center gap-1.5 justify-center min-h-[40px]">
                                  <Checkbox 
                                    checked={isChecked} 
                                    onCheckedChange={(val) => handleLocalPermissionToggle(module, action, !!val, currentScope)}
                                    className="size-4 rounded-md"
                                  />
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="bg-muted/20 border-t p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isRolePermissionsDirty ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-900/50">
                        <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                        Unsaved changes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2.5 py-1 rounded-lg border border-green-200/50 dark:border-green-900/50">
                        <span className="size-2 rounded-full bg-green-500" />
                        All changes saved
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={handleDiscardRolePermissions} 
                      disabled={!isRolePermissionsDirty || isSavingRolePerms} 
                      className="rounded-xl h-10 px-5 font-bold"
                    >
                      Discard
                    </Button>
                    <Button 
                      onClick={handleSaveRolePermissions} 
                      disabled={!isRolePermissionsDirty || isSavingRolePerms} 
                      className="rounded-xl h-10 px-6 font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isSavingRolePerms ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ) : (
              <Card className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-none overflow-hidden lg:col-span-3 py-24 bg-slate-50/50 dark:bg-slate-900/20">
                <CardContent className="flex flex-col items-center justify-center text-center gap-4 p-8">
                  <div className="size-16 rounded-3xl bg-primary/5 flex items-center justify-center text-primary/40 border border-primary/10">
                    <ShieldCheck className="size-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Role Selected</h3>
                    <p className="text-sm text-muted-foreground/75 mt-1.5 max-w-sm">
                      Please select an existing role from the left sidebar, or create a new custom role to configure its permissions matrix.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: USER ROLE ASSIGNMENTS & OVERRIDES */}
        <TabsContent value="users" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden bg-card">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Assign Custom Roles</CardTitle>
              <CardDescription>Assign specific roles and configure individual permission overrides for employees.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop View Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="w-full min-w-[900px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-transparent">
                      <TableHead className="font-bold text-[10px] pl-6 py-4 text-slate-800 dark:text-slate-200">Employee</TableHead>
                      <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Department</TableHead>
                      <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Designation</TableHead>
                      <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Assigned Role</TableHead>
                      <TableHead className="font-bold text-[10px] pr-6 text-right text-slate-800 dark:text-slate-200">Action Override</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y">
                    {paginatedEmployees.map((emp: any) => {
                      const assignedRoleId = employeeRoles.find((r: any) => r.employee_id === emp.id)?.role_id || "none";
                      const userOverrides = overrides.filter((o: any) => o.employee_id === emp.id);

                      // Find corresponding default designation role
                      const defaultRoleCode = emp.designation ? emp.designation.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") : null;
                      const defaultRole = roles.find((r: any) => r.code === defaultRoleCode);

                      return (
                        <TableRow key={emp.id} className="hover:bg-muted/10">
                          <TableCell className="pl-6 py-4 font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                            {emp.full_name}
                            <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{emp.email}</p>
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-muted-foreground">{emp.department || "—"}</TableCell>
                          <TableCell className="text-sm font-medium text-muted-foreground">{emp.designation || "—"}</TableCell>
                          <TableCell>
                            <Select 
                              value={assignedRoleId} 
                              onValueChange={(val) => handleAssignUserRole(emp.id, val)}
                            >
                              <SelectTrigger className="h-9 w-56 rounded-xl bg-background border">
                                <SelectValue placeholder={defaultRole ? `Auto: ${defaultRole.name}` : "No Custom Role"} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  {defaultRole ? `No Custom Role (Auto: ${defaultRole.name})` : "No Custom Role"}
                                </SelectItem>
                                {roles.map((r: any) => (
                                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => { setOverrideEmployee(emp); setIsOverrideDialogOpen(true); }}
                              className="rounded-xl font-bold h-9 gap-1"
                            >
                              <Settings className="size-3.5" /> Overrides
                              {userOverrides.length > 0 && <span className="bg-primary text-white text-[8px] font-black size-4 rounded-full flex items-center justify-center">{userOverrides.length}</span>}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View Card Stack */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedEmployees.map((emp: any) => {
                  const assignedRoleId = employeeRoles.find((r: any) => r.employee_id === emp.id)?.role_id || "none";
                  const userOverrides = overrides.filter((o: any) => o.employee_id === emp.id);

                  // Find corresponding default designation role
                  const defaultRoleCode = emp.designation ? emp.designation.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") : null;
                  const defaultRole = roles.find((r: any) => r.code === defaultRoleCode);

                  return (
                    <div key={emp.id} className="p-4 space-y-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                      {/* Header: Name & Email */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="text-left">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{emp.full_name}</h4>
                          <span className="text-[10px] font-mono text-muted-foreground">{emp.email}</span>
                        </div>
                        {/* Department/Designation tags */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {emp.department && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider border border-indigo-100/50 dark:border-indigo-500/20">
                              {emp.department}
                            </span>
                          )}
                          {emp.designation && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold uppercase tracking-wide border border-slate-100 dark:border-slate-700">
                              {emp.designation}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dropdown & Actions */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-1">
                        <div className="flex-1 space-y-1 text-left">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 block">Assigned Role</label>
                          <Select 
                            value={assignedRoleId} 
                            onValueChange={(val) => handleAssignUserRole(emp.id, val)}
                          >
                            <SelectTrigger className="h-9 w-full rounded-xl bg-background border text-xs font-semibold">
                              <SelectValue placeholder={defaultRole ? `Auto: ${defaultRole.name}` : "No Custom Role"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                {defaultRole ? `No Custom Role (Auto: ${defaultRole.name})` : "No Custom Role"}
                              </SelectItem>
                              {roles.map((r: any) => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-end justify-start sm:justify-end">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => { setOverrideEmployee(emp); setIsOverrideDialogOpen(true); }}
                            className="rounded-xl font-bold h-9 gap-1 text-xs w-full sm:w-auto"
                          >
                            <Settings className="size-3.5" /> Overrides
                            {userOverrides.length > 0 && (
                              <span className="bg-primary text-white text-[8px] font-black size-4 rounded-full flex items-center justify-center">
                                {userOverrides.length}
                              </span>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalEmployeesPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t bg-muted/10 px-6 py-4">
                  <div className="text-xs text-muted-foreground font-medium">
                    Showing <span className="font-bold text-foreground">{(employeesPage - 1) * EMPLOYEES_PER_PAGE + 1}</span> to{" "}
                    <span className="font-bold text-foreground">
                      {Math.min(employeesPage * EMPLOYEES_PER_PAGE, employees.length)}
                    </span>{" "}
                    of <span className="font-bold text-foreground">{employees.length}</span> entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg"
                      onClick={() => setEmployeesPage(p => Math.max(1, p - 1))}
                      disabled={employeesPage === 1}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: totalEmployeesPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalEmployeesPages || Math.abs(p - employeesPage) <= 1)
                      .map((p, idx, arr) => {
                        const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                        return (
                          <div key={p} className="flex items-center gap-2">
                            {showEllipsis && (
                              <span className="text-xs text-muted-foreground px-1">...</span>
                            )}
                            <Button
                              variant={employeesPage === p ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "h-8 w-8 p-0 rounded-lg text-xs font-bold transition-all",
                                employeesPage === p ? "shadow-md text-white" : ""
                              )}
                              onClick={() => setEmployeesPage(p)}
                            >
                              {p}
                            </Button>
                          </div>
                        );
                      })}

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-lg"
                      onClick={() => setEmployeesPage(p => Math.min(totalEmployeesPages, p + 1))}
                      disabled={employeesPage === totalEmployeesPages}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* USER PERMISSION OVERRIDES DIALOG */}
          <Dialog 
            open={isOverrideDialogOpen} 
            onOpenChange={(open) => {
              if (!open) {
                handleCloseOverrideDialog();
              }
            }}
          >
            <DialogContent className="rounded-[32px] p-8 max-w-4xl max-h-[85vh] overflow-y-auto border-2 shadow-elegant">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">User Override Matrix: {overrideEmployee?.full_name}</DialogTitle>
                <DialogDescription>Define employee-specific overrides. Toggling permissions here will bypass role configurations.</DialogDescription>
              </DialogHeader>
              {/* Desktop View: Table */}
              <div className="hidden md:block py-6 overflow-x-auto">
                <Table className="w-full min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-transparent">
                      <TableHead className="font-bold text-[10px] pl-6 py-4 text-slate-800 dark:text-slate-200">Module</TableHead>
                      {MATRIX_ACTIONS.map(action => (
                        <TableHead key={action} className="font-bold text-[10px] text-center capitalize text-slate-800 dark:text-slate-200">{action}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y">
                    {MODULES.map(module => (
                      <TableRow key={module} className="hover:bg-muted/10">
                        <TableCell className="font-bold pl-6 text-sm tracking-tight text-slate-900 dark:text-white">{module}</TableCell>
                        {MATRIX_ACTIONS.map(action => {
                          const ov = (localOverrides || []).find((o: any) => o.module === module && o.action === action);
                          const isOverrideChecked = !!ov;
                          const overrideAllow = ov?.allow ?? true;
                          const currentScope: Scope = ov?.scope || "company";

                          return (
                            <TableCell key={action} className="text-center p-3">
                              <div className="flex flex-col items-center gap-1.5 justify-center min-h-[40px]">
                                <Checkbox 
                                  checked={isOverrideChecked}
                                  onCheckedChange={(val) => handleLocalOverrideToggle(module, action, !!val, overrideAllow, currentScope)}
                                  className="size-4 rounded-md border-2"
                                />
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View: Card Stack */}
              <div className="block md:hidden py-4 space-y-4">
                {MODULES.map(module => (
                  <div key={module} className="p-4 rounded-2xl border bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white text-left">{module}</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {MATRIX_ACTIONS.map(action => {
                        const ov = (localOverrides || []).find((o: any) => o.module === module && o.action === action);
                        const isOverrideChecked = !!ov;
                        const overrideAllow = ov?.allow ?? true;
                        const currentScope: Scope = ov?.scope || "company";

                        return (
                          <div key={action} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <Checkbox 
                              id={`override-${module}-${action}`}
                              checked={isOverrideChecked}
                              onCheckedChange={(val) => handleLocalOverrideToggle(module, action, !!val, overrideAllow, currentScope)}
                              className="size-4 rounded-md border-2"
                            />
                            <Label 
                              htmlFor={`override-${module}-${action}`} 
                              className="text-xs font-semibold capitalize cursor-pointer select-none text-slate-700 dark:text-slate-300"
                            >
                              {action}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter className="bg-muted/10 border-t p-6 mt-6 -mx-8 -mb-8 flex items-center justify-between sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  {isOverridesDirty ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-900/50">
                      <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                      Unsaved overrides
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2.5 py-1 rounded-lg border border-green-200/50 dark:border-green-900/50">
                      <span className="size-2 rounded-full bg-green-500" />
                      Overrides synced
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <DialogClose asChild>
                    <Button 
                      variant="outline" 
                      className="rounded-xl h-10 px-5 font-bold"
                    >
                      Close
                    </Button>
                  </DialogClose>
                  <Button 
                    onClick={handleSaveOverrides} 
                    disabled={!isOverridesDirty || isSavingOverrides} 
                    className="rounded-xl h-10 px-6 font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSavingOverrides ? "Saving..." : "Save Overrides"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TAB 3: APPROVAL WORKFLOWS */}
        <TabsContent value="workflows" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>Approval Workflows</CardTitle>
                <CardDescription>Setup multi-stage approval workflow gates for various payroll and HR transactions.</CardDescription>
              </div>
              <Dialog open={isWorkflowDialogOpen} onOpenChange={setIsWorkflowDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl font-bold h-10 gap-2"><Plus className="size-4" /> Add Workflow</Button>
                </DialogTrigger>
                <DialogContent className="rounded-[32px] p-8 max-w-xl border shadow-elegant">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black">Configure Approval Workflow</DialogTitle>
                    <DialogDescription>Add reviewer steps. Requests will pass through each reviewer sequentially.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveWorkflow} className="space-y-6 mt-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Workflow Name</Label>
                      <Input placeholder="e.g. Leave Approval Policy" value={workflowForm.name} onChange={e => setWorkflowForm({ ...workflowForm, name: e.target.value })} required className="h-11 rounded-xl border-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Type</Label>
                        <Select 
                          value={workflowForm.workflow_type}
                          onValueChange={(val) => setWorkflowForm({ ...workflowForm, workflow_type: val })}
                        >
                          <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="leave">Leave Approval</SelectItem>
                            <SelectItem value="attendance_regularization">Attendance Regularization</SelectItem>
                            <SelectItem value="expense">Expense Claims</SelectItem>
                            <SelectItem value="recruitment">Recruitment Approval</SelectItem>
                            <SelectItem value="salary_revision">Salary Revision Approval</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Scope</Label>
                        <Select defaultValue="all">
                          <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="All Departments" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <Label className="text-xs font-black uppercase text-slate-800">Approval Chain Steps</Label>
                        <Button type="button" size="sm" onClick={handleAddWorkflowStep} variant="outline" className="rounded-lg h-7 font-bold text-[10px] uppercase tracking-widest"><Plus className="size-3 mr-1" /> Add Step</Button>
                      </div>
                      
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        {workflowForm.steps.map((step, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-muted/30 border rounded-xl">
                            <span className="text-xs font-black bg-primary text-white size-6 rounded-full flex items-center justify-center shrink-0">{idx + 1}</span>
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <Input 
                                placeholder="Reviewer Level name" 
                                value={step.name} 
                                onChange={e => {
                                  const stepsCopy = [...workflowForm.steps];
                                  stepsCopy[idx].name = e.target.value;
                                  setWorkflowForm({ ...workflowForm, steps: stepsCopy });
                                }}
                                className="h-8 text-xs rounded-lg border-2" 
                              />
                              <Select 
                                value={step.role_id}
                                onValueChange={(val) => {
                                  const stepsCopy = [...workflowForm.steps];
                                  stepsCopy[idx].role_id = val;
                                  setWorkflowForm({ ...workflowForm, steps: stepsCopy });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs rounded-lg border-2"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {roles.map((r: any) => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              onClick={() => {
                                setWorkflowForm(prev => ({
                                  ...prev,
                                  steps: prev.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 }))
                                }));
                              }}
                              className="size-7 p-0 text-muted-foreground hover:text-rose-500 rounded-lg"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                        {workflowForm.steps.length === 0 && (
                          <div className="text-center py-6 text-xs text-muted-foreground font-bold uppercase tracking-wide italic bg-slate-50 dark:bg-slate-800/20 rounded-xl">No reviewer steps configured. Click Add Step.</div>
                        )}
                      </div>
                    </div>

                    <DialogFooter>
                      <Button type="submit" className="w-full h-11 rounded-xl font-bold">Save Approval Workflow</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="w-full min-w-[800px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-transparent">
                    <TableHead className="font-bold text-[10px] pl-6 py-4 text-slate-800 dark:text-slate-200">Workflow Name</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Transaction Type</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Approval Path Chain</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Status</TableHead>
                    <TableHead className="font-bold text-[10px] pr-6 text-right text-slate-800 dark:text-slate-200">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {workflows.map((w: any) => (
                    <TableRow key={w.id} className="hover:bg-muted/10">
                      <TableCell className="pl-6 py-4 font-bold text-sm tracking-tight text-foreground">{w.name}</TableCell>
                      <TableCell className="text-xs font-black uppercase tracking-wider text-primary">{w.workflow_type.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <div className="flex items-center flex-wrap gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                          {w.steps.map((s: any, idx: number) => {
                            const rName = roles.find((r: any) => r.id === s.role_id)?.name || "Role";
                            return (
                              <div key={idx} className="flex items-center gap-1">
                                <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border">{s.name} ({rName})</span>
                                {idx < w.steps.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full ${w.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{w.is_active ? "ACTIVE" : "INACTIVE"}</span>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={async () => {
                            if (!confirm("Are you sure you want to remove this workflow?")) return;
                            await supabase.from("approval_workflows").delete().eq("id", w.id);
                            qc.invalidateQueries({ queryKey: ["approval-workflows"] });
                            toast.success("Workflow deleted!");
                          }}
                          className="size-8 rounded-lg hover:bg-rose-100 hover:text-rose-500"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {workflows.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="py-20 text-center text-muted-foreground italic">No approval workflows configured yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: TEMPORARY ACCESS DELEGATION */}
        <TabsContent value="delegations" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>Temporary Access Delegations</CardTitle>
                <CardDescription>Delegate permissions from one user to another for a limited duration (e.g., while on leave).</CardDescription>
              </div>
              <Dialog open={isDelegationDialogOpen} onOpenChange={setIsDelegationDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl font-bold h-10 gap-2"><Plus className="size-4" /> Delegate Access</Button>
                </DialogTrigger>
                <DialogContent className="rounded-[32px] p-8 max-w-md border shadow-elegant">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black">Delegate Access Permissions</DialogTitle>
                    <DialogDescription>Authorize an employee to assume role privileges for a specified date range.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveDelegation} className="space-y-5 mt-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">From Employee (Giver)</Label>
                      <Select 
                        value={delegationForm.from_employee_id}
                        onValueChange={(val) => setDelegationForm({ ...delegationForm, from_employee_id: val })}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="Select Employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.map((e: any) => (
                            <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.designation})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">To Employee (Receiver)</Label>
                      <Select 
                        value={delegationForm.to_employee_id}
                        onValueChange={(val) => setDelegationForm({ ...delegationForm, to_employee_id: val })}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="Select Employee" /></SelectTrigger>
                        <SelectContent>
                          {employees.filter((e: any) => e.id !== delegationForm.from_employee_id).map((e: any) => (
                            <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.designation})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Role privileges to Delegate</Label>
                      <Select 
                        value={delegationForm.role_id}
                        onValueChange={(val) => setDelegationForm({ ...delegationForm, role_id: val })}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="Select Role to Copy" /></SelectTrigger>
                        <SelectContent>
                          {roles.map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Start Date</Label>
                        <Input type="date" value={delegationForm.start_date} onChange={e => setDelegationForm({ ...delegationForm, start_date: e.target.value })} required className="h-11 rounded-xl border-2" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">End Date</Label>
                        <Input type="date" value={delegationForm.end_date} onChange={e => setDelegationForm({ ...delegationForm, end_date: e.target.value })} required className="h-11 rounded-xl border-2" />
                      </div>
                    </div>
                    <DialogFooter className="pt-4">
                      <Button type="submit" className="w-full h-11 rounded-xl font-bold">Establish Delegation</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="w-full min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-transparent">
                    <TableHead className="font-bold text-[10px] pl-6 py-4 text-slate-800 dark:text-slate-200">Owner (From)</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Delegate (To)</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Delegated Role</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Date Window Range</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Status</TableHead>
                    <TableHead className="font-bold text-[10px] pr-6 text-right text-slate-800 dark:text-slate-200">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {delegations.map((d: any) => (
                    <TableRow key={d.id} className="hover:bg-muted/10">
                      <TableCell className="pl-6 py-4 font-bold text-sm tracking-tight text-foreground">{d.from?.full_name || "Owner"}</TableCell>
                      <TableCell className="font-bold text-sm text-foreground">{d.to?.full_name || "Delegate"}</TableCell>
                      <TableCell className="text-sm font-semibold text-primary">{d.custom_roles?.name || "Role"}</TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground">
                        {new Date(d.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} — {new Date(d.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full ${
                          d.status === "active" ? "bg-green-100 text-green-700" :
                          d.status === "revoked" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                        }`}>{d.status}</span>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        {d.status === "active" && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleRevokeDelegation(d.id)}
                            className="rounded-lg font-black h-8 text-[10px] uppercase tracking-widest text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {delegations.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-20 text-center text-muted-foreground italic">No temporary delegations established yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: SECURITY AUDIT LOGS */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>System & Access Audit Logs</CardTitle>
                <CardDescription>Trace details of user actions, login activities, and configuration modifications.</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Search user, action, or module..." 
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-background border shadow-none"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="w-full min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-transparent">
                    <TableHead className="font-bold text-[10px] pl-6 py-4 text-slate-800 dark:text-slate-200">Date/Time</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Employee User</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Action logged</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Module</TableHead>
                    <TableHead className="font-bold text-[10px] text-slate-800 dark:text-slate-200">Details</TableHead>
                    <TableHead className="font-bold text-[10px] pr-6 text-right text-slate-800 dark:text-slate-200">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y">
                  {auditLogs.map((log: any) => (
                    <TableRow key={log.id} className="hover:bg-muted/10">
                      <TableCell className="pl-6 py-4 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </TableCell>
                      <TableCell className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">{log.employee_name || "System"}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-800 dark:text-slate-200">{log.action}</TableCell>
                      <TableCell className="text-[10px] font-black uppercase tracking-wider text-primary">{log.module}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium max-w-xs truncate">{log.details || "—"}</TableCell>
                      <TableCell className="pr-6 text-right text-xs font-mono font-bold text-slate-500">{log.ip_address || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {auditLogs.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-20 text-center text-muted-foreground italic">No security audit logs found matching criteria.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
