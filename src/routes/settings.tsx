import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Calculator, MapPin, Save, ShieldCheck, QrCode, Plus, Trash2, AlertTriangle, Clock, Timer, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/settings")({ 
  component: () => (
    <AppShell>
      <SettingsPage />
    </AppShell>
  ) 
});

function SettingsPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [busy, setBusy] = useState(false);

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings" as any).select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: locations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ["company-locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_locations" as any).select("*").order("name");
      if (error) return [];
      return data;
    },
  });

  const { data: policies = [], isLoading: loadingPolicies } = useQuery({
    queryKey: ["attendance-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_policies" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const [formData, setFormData] = useState<any>({});
  const [newLoc, setNewLoc] = useState({ name: "", address: "", lat: "", lng: "" });
  
  const [newPolicy, setNewPolicy] = useState({
    name: "",
    auto_checkout_enabled: false,
    auto_checkout_after_minutes: 120,
    qr_attendance_enabled: true
  });

  const handleAddPolicy = async () => {
    if (!newPolicy.name) return toast.error("Please provide a policy name.");
    try {
      const { error } = await supabase.from("attendance_policies" as any).insert({
        name: newPolicy.name,
        auto_checkout_enabled: newPolicy.auto_checkout_enabled,
        auto_checkout_after_minutes: newPolicy.auto_checkout_enabled ? Number(newPolicy.auto_checkout_after_minutes) : 0,
        qr_attendance_enabled: newPolicy.qr_attendance_enabled
      });
      if (error) throw error;
      toast.success("Attendance policy added!");
      setNewPolicy({ name: "", auto_checkout_enabled: false, auto_checkout_after_minutes: 120, qr_attendance_enabled: true });
      qc.invalidateQueries({ queryKey: ["attendance-policies"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to add policy");
    }
  };

  const handleDeletePolicy = async (id: string) => {
    if (!confirm("Are you sure you want to delete this policy? Employees using this policy will fallback to default rules.")) return;
    try {
      const { error } = await supabase.from("attendance_policies" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Policy removed");
      qc.invalidateQueries({ queryKey: ["attendance-policies"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete policy");
    }
  };

  const handleUpdatePolicy = async (id: string, updates: any) => {
    try {
      const { error } = await supabase
        .from("attendance_policies" as any)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
      toast.success("Policy configuration updated!");
      qc.invalidateQueries({ queryKey: ["attendance-policies"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update policy");
    }
  };

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSaveSettings = async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("company_settings" as any)
        .upsert({ ...formData, updated_at: new Date().toISOString() });
      
      if (error) throw error;
      toast.success("General settings updated!");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setBusy(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLoc.name || !newLoc.lat || !newLoc.lng) return toast.error("Please fill required location fields.");
    try {
      const { error } = await supabase.from("company_locations" as any).insert({
        name: newLoc.name,
        address: newLoc.address,
        lat: Number(newLoc.lat),
        lng: Number(newLoc.lng)
      });
      if (error) throw error;
      toast.success("New location added!");
      setNewLoc({ name: "", address: "", lat: "", lng: "" });
      qc.invalidateQueries({ queryKey: ["company-locations"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      const { error } = await supabase.from("company_locations" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Location removed");
      qc.invalidateQueries({ queryKey: ["company-locations"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const { data: allEmployees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees-list-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, user_id, full_name, email, department, designation")
        .not("user_id", "is", null);
      if (error) throw error;
      return data || [];
    }
  });

  const { data: userRoles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ["user-roles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      return data || [];
    }
  });

  const handleRoleChange = async (userId: string, newRole: string) => {
    setBusy(true);
    try {
      // 1. Delete existing roles for this user to avoid multiple role assignments
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (delErr) throw delErr;
      
      // 2. Insert the new role
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole as any });
      if (insErr) throw insErr;
      
      toast.success("User role updated successfully!");
      qc.invalidateQueries({ queryKey: ["user-roles-list"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setBusy(false);
    }
  };

  if (loadingSettings) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading settings...</div>;
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-card border rounded-2xl p-8 max-w-md mx-auto shadow-elegant">
        <AlertTriangle className="size-12 text-destructive animate-pulse" />
        <h2 className="text-2xl font-black tracking-tight text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground font-medium">This page is restricted to Admin users. If you believe this is an error, please contact support.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-foreground">Settings</h1>
          <p className="text-muted-foreground font-medium mt-1">Manage global rules and multi-office infrastructure.</p>
        </div>
        <Button onClick={handleSaveSettings} disabled={busy} className="gap-2 px-8 h-12 rounded-xl shadow-lg shadow-primary/20">
          <Save className="size-4" /> {busy ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl h-auto w-full flex flex-wrap justify-start gap-2 mb-8">
          <TabsTrigger value="general" className="rounded-xl font-bold gap-2 py-2.5 w-[calc(50%-4px)] md:w-auto md:flex-1 data-[state=active]:shadow-md">
            <Building2 className="size-4" /> General
          </TabsTrigger>
          <TabsTrigger value="payroll" className="rounded-xl font-bold gap-2 py-2.5 w-[calc(50%-4px)] md:w-auto md:flex-1 data-[state=active]:shadow-md">
            <Calculator className="size-4" /> Payroll Rules
          </TabsTrigger>
          <TabsTrigger value="location" className="rounded-xl font-bold gap-2 py-2.5 w-[calc(50%-4px)] md:w-auto md:flex-1 data-[state=active]:shadow-md">
            <MapPin className="size-4" /> Office Locations
          </TabsTrigger>
          <TabsTrigger value="policies" className="rounded-xl font-bold gap-2 py-2.5 w-[calc(50%-4px)] md:w-auto md:flex-1 data-[state=active]:shadow-md">
            <Clock className="size-4" /> Attendance Policies
          </TabsTrigger>
          <TabsTrigger value="roles" className="rounded-xl font-bold gap-2 py-2.5 w-[calc(50%-4px)] md:w-auto md:flex-1 data-[state=active]:shadow-md">
            <ShieldCheck className="size-4" /> Access Controls
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Company Identity</CardTitle>
              <CardDescription>Basic information about your organization.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Company Name</Label>
                  <Input name="company_name" value={formData.company_name || ""} onChange={handleChange} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Company Logo URL</Label>
                  <Input name="company_logo_url" value={formData.company_logo_url || ""} onChange={handleChange} className="h-12 rounded-xl" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Statutory Contribution Rates</CardTitle>
              <CardDescription>Configure PF, ESI, and PT thresholds.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid gap-8 md:grid-cols-2">
                <section className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><ShieldCheck className="size-4" /> Provident Fund (PF)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground">Employer Share (%)</Label>
                      <Input type="number" step="0.01" name="pf_rate_employer" value={formData.pf_rate_employer || 0} onChange={handleChange} className="h-11 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground">Employee Share (%)</Label>
                      <Input type="number" step="0.01" name="pf_rate_employee" value={formData.pf_rate_employee || 0} onChange={handleChange} className="h-11 rounded-lg" />
                    </div>
                  </div>
                </section>
                <section className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><ShieldCheck className="size-4" /> ESI Calculation</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground">Employer Share (%)</Label>
                      <Input type="number" step="0.01" name="esi_rate_employer" value={formData.esi_rate_employer || 0} onChange={handleChange} className="h-11 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground">Employee Share (%)</Label>
                      <Input type="number" step="0.01" name="esi_rate_employee" value={formData.esi_rate_employee || 0} onChange={handleChange} className="h-11 rounded-lg" />
                    </div>
                  </div>
                </section>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Office Branches</CardTitle>
                <CardDescription>Add and manage multiple office locations for geofencing.</CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={() => window.open('/kiosk', '_blank')}
                className="rounded-xl gap-2 h-10"
              >
                <QrCode className="size-4" /> Open Kiosk
              </Button>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {/* Add New Location */}
              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Add New Branch</h4>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="md:col-span-1">
                    <Label className="text-[10px] font-bold">Branch Name</Label>
                    <Input placeholder="e.g. Surat Branch" value={newLoc.name} onChange={(e) => setNewLoc({...newLoc, name: e.target.value})} className="h-10 rounded-lg mt-1" />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-[10px] font-bold">Address</Label>
                    <Input placeholder="e.g. Ring Rd, Surat" value={newLoc.address} onChange={(e) => setNewLoc({...newLoc, address: e.target.value})} className="h-10 rounded-lg mt-1" />
                  </div>
                  <div className="md:col-span-1">
                    <Label className="text-[10px] font-bold">Latitude / Longitude</Label>
                    <div className="flex gap-2 mt-1">
                      <Input placeholder="Lat" type="number" value={newLoc.lat} onChange={(e) => setNewLoc({...newLoc, lat: e.target.value})} className="h-10 rounded-lg" />
                      <Input placeholder="Lng" type="number" value={newLoc.lng} onChange={(e) => setNewLoc({...newLoc, lng: e.target.value})} className="h-10 rounded-lg" />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddLocation} className="w-full h-10 rounded-xl gap-2 font-bold">
                      <Plus className="size-4" /> Add Branch
                    </Button>
                  </div>
                </div>
              </div>

              {/* Locations List */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Existing Locations</h4>
                <div className="grid gap-4">
                  {locations.map((loc: any) => (
                    <div key={loc.id} className="flex items-center justify-between p-4 rounded-xl border bg-muted/20 group hover:border-primary/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="size-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary border">
                          <MapPin className="size-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm tracking-tight">{loc.name}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">{loc.address || "No address provided"}</p>
                          <p className="text-[8px] font-mono text-primary/50 mt-0.5">{loc.lat}, {loc.lng}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteLocation(loc.id)} className="text-muted-foreground hover:text-rose-500 rounded-lg">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {locations.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed rounded-2xl text-muted-foreground italic">No branches configured.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/10 bg-primary/5 shadow-card overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                  <ShieldCheck className="size-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-lg font-black">Enterprise Access Control Center</CardTitle>
                  <CardDescription className="text-sm font-medium">
                    Configure dynamic permission matrices, custom roles, temporary access delegations, approval workflows, and view complete security audit logs.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 flex justify-end">
              <Link to="/access-control">
                <Button className="h-11 px-6 rounded-xl font-bold bg-primary hover:bg-primary-glow shadow-md shadow-primary/20 transition-all flex items-center gap-2">
                  <ShieldCheck className="size-4" /> Launch Access Control Center
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-2 border-primary/10 bg-primary/5 shadow-card overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive shrink-0 border border-destructive/20">
                  <ShieldAlert className="size-6 text-destructive" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-lg font-black">Employee Access Control</CardTitle>
                  <CardDescription className="text-sm font-medium">
                    Instantly enable or disable an employee's access to the HRMS without deleting any employee data.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6 flex justify-end">
              <Link to="/employee-access">
                <Button variant="destructive" className="h-11 px-6 rounded-xl font-bold shadow-md shadow-destructive/20 transition-all flex items-center gap-2">
                  <ShieldAlert className="size-4" /> Manage Employee Access
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>User Access Controls</CardTitle>
              <CardDescription>Assign roles and manage database access permissions for registered employees.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              {(loadingEmployees || loadingRoles) ? (
                <div className="py-10 text-center text-muted-foreground animate-pulse font-medium">
                  Loading employees and access records...
                </div>
              ) : (
                <>
                  {/* Desktop View - Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-primary/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          <th className="pb-4 text-left font-bold pl-4">Employee</th>
                          <th className="pb-4 text-left font-bold">Email</th>
                          <th className="pb-4 text-left font-bold">Department</th>
                          <th className="pb-4 text-left font-bold">Designation</th>
                          <th className="pb-4 text-right font-bold pr-4">Access Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary/5">
                        {allEmployees.map((emp: any) => {
                          const matchingRole = userRoles.find((r: any) => r.user_id === emp.user_id)?.role || "employee";
                          return (
                            <tr key={emp.id} className="group hover:bg-muted/10 transition-colors">
                              <td className="py-4 pl-4">
                                <div className="flex items-center gap-3">
                                  <div className="size-10 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center font-bold text-primary text-sm shadow-sm group-hover:scale-105 transition-transform">
                                    {emp.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm tracking-tight text-foreground">{emp.full_name}</p>
                                    <p className="text-[10px] text-muted-foreground font-medium">ID: {emp.id.slice(0, 8)}...</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 text-sm font-medium text-muted-foreground">{emp.email}</td>
                              <td className="py-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/5 text-primary border border-primary/10">
                                  {emp.department || "N/A"}
                                </span>
                              </td>
                              <td className="py-4 text-sm font-medium text-muted-foreground">{emp.designation || "N/A"}</td>
                              <td className="py-4 text-right pr-4">
                                <div className="inline-block w-40 text-left">
                                  <Select
                                    value={matchingRole}
                                    disabled={busy}
                                    onValueChange={(val) => handleRoleChange(emp.user_id, val)}
                                  >
                                    <SelectTrigger className="h-10 rounded-xl border border-muted-foreground/20 bg-background/50 backdrop-blur-sm focus:ring-primary shadow-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border shadow-elegant">
                                      <SelectItem value="employee" className="rounded-lg font-medium">Employee</SelectItem>
                                      <SelectItem value="manager" className="rounded-lg font-medium">Manager</SelectItem>
                                      <SelectItem value="admin" className="rounded-lg font-medium">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View - Access Control Card List */}
                  <div className="md:hidden divide-y divide-primary/5">
                    {allEmployees.map((emp: any) => {
                      const matchingRole = userRoles.find((r: any) => r.user_id === emp.user_id)?.role || "employee";
                      return (
                        <div key={emp.id} className="py-4 space-y-3">
                          {/* Header: Avatar, Name & ID */}
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center font-bold text-primary text-sm shadow-sm">
                              {emp.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-foreground">{emp.full_name}</h4>
                              <p className="text-[10px] text-muted-foreground font-medium">ID: {emp.id.slice(0, 8)}...</p>
                            </div>
                          </div>

                          {/* Email, Department & Designation */}
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                            <div className="col-span-2">
                              <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Email</span>
                              <span className="font-medium text-foreground">{emp.email}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Department</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/5 text-primary border border-primary/10 mt-0.5">
                                {emp.department || "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Designation</span>
                              <span className="font-medium text-foreground block mt-0.5">{emp.designation || "N/A"}</span>
                            </div>
                          </div>

                          {/* Access Role Selection */}
                          <div className="pt-2">
                            <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider mb-1">Access Role</span>
                            <Select
                              value={matchingRole}
                              disabled={busy}
                              onValueChange={(val) => handleRoleChange(emp.user_id, val)}
                            >
                              <SelectTrigger className="h-10 w-full rounded-xl border border-muted-foreground/20 bg-background/50 backdrop-blur-sm focus:ring-primary shadow-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border shadow-elegant">
                                <SelectItem value="employee" className="rounded-lg font-medium">Employee</SelectItem>
                                <SelectItem value="manager" className="rounded-lg font-medium">Manager</SelectItem>
                                <SelectItem value="admin" className="rounded-lg font-medium">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {allEmployees.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground italic">
                      No registered employees with active accounts found.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle>Configure Attendance Policies</CardTitle>
              <CardDescription>Define check-in constraints and automatic check-out rules for different teams.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {/* Add New Policy Form */}
              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Create New Attendance Policy</h4>
                <div className="grid gap-6 md:grid-cols-4 items-end">
                  <div>
                    <Label className="text-[10px] font-bold">Policy Name</Label>
                    <Input 
                      placeholder="e.g. Sales Team" 
                      value={newPolicy.name} 
                      onChange={(e) => setNewPolicy({...newPolicy, name: e.target.value})} 
                      className="h-10 rounded-lg mt-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800" 
                    />
                  </div>
                  <div className="flex items-center gap-3 h-10">
                    <Switch
                      id="auto-checkout"
                      checked={newPolicy.auto_checkout_enabled}
                      onCheckedChange={(checked) => setNewPolicy({...newPolicy, auto_checkout_enabled: checked})}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="auto-checkout" className="text-xs font-bold cursor-pointer text-slate-800 dark:text-slate-200">Auto Check-Out</Label>
                      <p className="text-[10px] text-muted-foreground font-medium">Auto-close session after time limit</p>
                    </div>
                  </div>
                  {newPolicy.auto_checkout_enabled && (
                    <div>
                      <Label className="text-[10px] font-bold">Duration (Minutes)</Label>
                      <Input 
                        type="number" 
                        min="1" 
                        value={newPolicy.auto_checkout_after_minutes} 
                        onChange={(e) => setNewPolicy({...newPolicy, auto_checkout_after_minutes: Number(e.target.value)})} 
                        className="h-10 rounded-lg mt-1 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800" 
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3 h-10">
                    <Switch
                      id="qr-attendance"
                      checked={newPolicy.qr_attendance_enabled}
                      onCheckedChange={(checked) => setNewPolicy({...newPolicy, qr_attendance_enabled: checked})}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="qr-attendance" className="text-xs font-bold cursor-pointer text-slate-800 dark:text-slate-200">QR Scan Enabled</Label>
                      <p className="text-[10px] text-muted-foreground font-medium">Allow punching via kiosk QR</p>
                    </div>
                  </div>
                  <div className={newPolicy.auto_checkout_enabled ? "md:col-span-1" : "md:col-span-2"}>
                    <Button onClick={handleAddPolicy} className="w-full h-10 rounded-xl gap-2 font-bold shadow-sm">
                      <Plus className="size-4" /> Add Policy
                    </Button>
                  </div>
                </div>
              </div>

              {/* Policies List */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Active Policies</h4>
                <div className="grid gap-4">
                  {loadingPolicies ? (
                    <div className="text-center py-10 animate-pulse text-muted-foreground font-bold">Loading policies...</div>
                  ) : (
                    policies.map((policy: any) => (
                      <div key={policy.id} className="p-5 rounded-xl border bg-muted/20 hover:border-primary/30 transition-all space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-primary border border-slate-200 dark:border-slate-700">
                              <Clock className="size-5" />
                            </div>
                            <div>
                              <p className="font-black text-sm tracking-tight text-slate-900 dark:text-white">{policy.name} Policy</p>
                              <p className="text-[9px] text-muted-foreground font-semibold">ID: {policy.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                          {/* Prevent deleting default Inhouse and Marketing policies */}
                          {policy.name !== 'Inhouse' && policy.name !== 'Marketing' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeletePolicy(policy.id)} 
                              className="text-muted-foreground hover:text-rose-500 rounded-lg"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-6 md:grid-cols-3 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <Switch
                              id={`auto-co-${policy.id}`}
                              checked={policy.auto_checkout_enabled}
                              onCheckedChange={(checked) => handleUpdatePolicy(policy.id, { auto_checkout_enabled: checked })}
                            />
                            <div className="grid gap-1 leading-none">
                              <Label htmlFor={`auto-co-${policy.id}`} className="text-xs font-bold cursor-pointer text-slate-800 dark:text-slate-200">Auto Check-Out</Label>
                              <p className="text-[9px] text-muted-foreground font-medium">Auto close shift</p>
                            </div>
                          </div>

                          {policy.auto_checkout_enabled && (
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] font-bold shrink-0">Duration (Mins)</Label>
                              <Input 
                                type="number" 
                                min="1" 
                                defaultValue={policy.auto_checkout_after_minutes} 
                                onBlur={(e) => {
                                  const val = Number(e.target.value);
                                  if (val !== policy.auto_checkout_after_minutes) {
                                    handleUpdatePolicy(policy.id, { auto_checkout_after_minutes: val });
                                  }
                                }}
                                className="h-8 w-24 rounded-md bg-white dark:bg-slate-950 text-xs font-medium border border-slate-200 dark:border-slate-800" 
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <Switch
                              id={`qr-scan-${policy.id}`}
                              checked={policy.qr_attendance_enabled}
                              onCheckedChange={(checked) => handleUpdatePolicy(policy.id, { qr_attendance_enabled: checked })}
                            />
                            <div className="grid gap-1 leading-none">
                              <Label htmlFor={`qr-scan-${policy.id}`} className="text-xs font-bold cursor-pointer text-slate-800 dark:text-slate-200">QR Scan Punch</Label>
                              <p className="text-[9px] text-muted-foreground font-medium">Punch via kiosk QR</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {policies.length === 0 && !loadingPolicies && (
                    <div className="text-center py-10 border-2 border-dashed rounded-2xl text-muted-foreground italic">No attendance policies configured.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
