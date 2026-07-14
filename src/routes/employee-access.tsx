import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase = supabaseClient as any;
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, Search, SearchX, AlertTriangle, History, XCircle, CheckCircle2, ChevronLeft, ChevronRight, Building2, Users, User } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/employee-access")({
  component: () => (
    <AppShell>
      <EmployeeAccessPage />
    </AppShell>
  )
});

function EmployeeAccessPage() {
  const { hasPermission } = usePermissions();
  const { employeeId } = useAuth();
  const qc = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, accessFilter]);

  const [disableModal, setDisableModal] = useState<{ open: boolean, empId: string, name: string }>({ open: false, empId: "", name: "" });
  const [enableModal, setEnableModal] = useState<{ open: boolean, empId: string, name: string }>({ open: false, empId: "", name: "" });
  const [historyModal, setHistoryModal] = useState<{ open: boolean, empId: string, name: string }>({ open: false, empId: "", name: "" });

  // Disabling state
  const [disableReason, setDisableReason] = useState("");
  const [disableNotes, setDisableNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employee-access-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select(`
        id, employee_code, full_name, email, department, designation, status, photo_url, login_enabled, reporting_manager
      `).order("full_name");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["employee-access-logs", historyModal.empId],
    enabled: historyModal.open,
    queryFn: async () => {
      const { data } = await supabase.from("employee_access_logs" as any)
        .select("*, performed_by(full_name)")
        .eq("employee_id", historyModal.empId)
        .order("created_at", { ascending: false });
      return data || [];
    }
  });

  const canManage = hasPermission("Employee Access Control", "manage") || hasPermission("Employee Access Control", "edit");

  // Derived Stats
  const total = employees.length;
  const activeAccess = employees.filter((e: any) => e.login_enabled !== false && e.status === "Active").length;
  const disabledAccess = employees.filter((e: any) => e.login_enabled === false).length;
  const resigned = employees.filter((e: any) => e.status === "Resigned").length;
  const terminated = employees.filter((e: any) => e.status === "Terminated").length;

  const filtered = employees.filter((e: any) => {
    const matchesSearch = e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : e.status === statusFilter;
    
    let matchesAccess = true;
    if (accessFilter === "enabled") matchesAccess = e.login_enabled !== false;
    if (accessFilter === "disabled") matchesAccess = e.login_enabled === false;
    
    return matchesSearch && matchesStatus && matchesAccess;
  });

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const currentRows = filtered.slice(indexOfFirst, indexOfLast);

  const handleDisable = async () => {
    if (!disableReason) return toast.error("Please select a reason");
    setSubmitting(true);
    try {
      // 1. Update Employee
      await supabase.from("employees").update({ login_enabled: false } as any).eq("id", disableModal.empId);
      // 2. Insert Log
      await supabase.from("employee_access_logs" as any).insert({
        employee_id: disableModal.empId,
        action: "Disabled",
        reason: disableReason,
        notes: disableNotes,
        performed_by: employeeId,
        ip_address: "web_client"
      });
      toast.success("Employee access has been revoked immediately.");
      setDisableModal({ open: false, empId: "", name: "" });
      qc.invalidateQueries({ queryKey: ["employee-access-list"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnable = async () => {
    setSubmitting(true);
    try {
      await supabase.from("employees").update({ login_enabled: true } as any).eq("id", enableModal.empId);
      await supabase.from("employee_access_logs" as any).insert({
        employee_id: enableModal.empId,
        action: "Enabled",
        reason: "Access Restored",
        performed_by: employeeId,
        ip_address: "web_client"
      });
      toast.success("Employee access has been restored.");
      setEnableModal({ open: false, empId: "", name: "" });
      qc.invalidateQueries({ queryKey: ["employee-access-list"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/settings" className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              <ChevronLeft className="size-3" /> Settings
            </Link>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <ShieldAlert className="size-8 text-primary" /> Employee Access Control
          </h1>
          <p className="text-muted-foreground font-medium mt-2">Manage employee HRMS access, enforce lockouts, and view security audit logs.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="rounded-2xl border-none bg-white/50 dark:bg-slate-900/50 shadow-sm backdrop-blur">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-muted-foreground mb-2"><Users className="size-4" /> <span className="text-xs font-bold uppercase tracking-widest">Total</span></div>
            <div className="text-2xl font-black">{total}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none bg-emerald-500/10 dark:bg-emerald-500/10 shadow-sm backdrop-blur">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2"><ShieldCheck className="size-4" /> <span className="text-xs font-bold uppercase tracking-widest">Active</span></div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{activeAccess}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none bg-destructive/10 dark:bg-destructive/10 shadow-sm backdrop-blur">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-destructive mb-2"><ShieldAlert className="size-4" /> <span className="text-xs font-bold uppercase tracking-widest">Disabled</span></div>
            <div className="text-2xl font-black text-destructive">{disabledAccess}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none bg-amber-500/10 dark:bg-amber-500/10 shadow-sm backdrop-blur">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2"><Building2 className="size-4" /> <span className="text-xs font-bold uppercase tracking-widest">Resigned</span></div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{resigned}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none bg-slate-500/10 dark:bg-slate-500/10 shadow-sm backdrop-blur">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-2"><XCircle className="size-4" /> <span className="text-xs font-bold uppercase tracking-widest">Terminated</span></div>
            <div className="text-2xl font-black text-slate-600 dark:text-slate-400">{terminated}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-[32px] border-2 shadow-xl overflow-hidden bg-white dark:bg-slate-900">
        <div className="p-6 border-b bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Search by Name, ID, or Email..." 
              className="pl-9 h-11 rounded-xl bg-white dark:bg-slate-950" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 rounded-xl w-[140px] bg-white dark:bg-slate-950"><SelectValue placeholder="Emp Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Resigned">Resigned</SelectItem>
                <SelectItem value="Terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={accessFilter} onValueChange={setAccessFilter}>
              <SelectTrigger className="h-11 rounded-xl w-[140px] bg-white dark:bg-slate-950"><SelectValue placeholder="Access" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Access</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableRow className="border-none">
                <TableHead className="font-black uppercase text-[10px] tracking-widest pl-6">Employee</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Department</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Status</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Login Access</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground animate-pulse font-medium">Loading security matrix...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                    <SearchX className="size-8 mx-auto mb-3 opacity-20" />
                    <p className="font-medium text-sm">No employees match this criteria.</p>
                  </TableCell>
                </TableRow>
              ) : currentRows.map((e: any) => (
                <TableRow key={e.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors border-slate-100 dark:border-slate-800">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-slate-100 overflow-hidden border">
                        {e.photo_url ? <img src={e.photo_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-muted-foreground">{e.full_name.charAt(0)}</div>}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground flex items-center gap-2">
                          {e.full_name} 
                        </div>
                        <div className="text-xs text-muted-foreground">{e.employee_code} • {e.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm text-foreground">{e.designation}</div>
                    <div className="text-xs text-muted-foreground">{e.department}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      e.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' :
                      e.status === 'Resigned' ? 'bg-amber-500/10 text-amber-600 border-amber-200' :
                      'bg-slate-500/10 text-slate-600 border-slate-200'
                    }>
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {e.login_enabled !== false ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1.5"><ShieldCheck className="size-3" /> Active Access</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5"><ShieldAlert className="size-3" /> Access Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to="/employee-360" search={{ id: e.id }}>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg border-primary/20 hover:bg-primary/5" title="View 360° Profile">
                          <User className="size-4 text-primary" />
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg" onClick={() => setHistoryModal({ open: true, empId: e.id, name: e.full_name })} title="Access History">
                        <History className="size-4 text-muted-foreground" />
                      </Button>
                      {canManage && (
                        e.login_enabled !== false ? (
                          <Button size="sm" variant="destructive" className="h-8 rounded-lg text-xs font-bold" onClick={() => setDisableModal({ open: true, empId: e.id, name: e.full_name })}>
                            Disable Access
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => setEnableModal({ open: true, empId: e.id, name: e.full_name })}>
                            Enable Access
                          </Button>
                        )
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-sm text-muted-foreground font-medium">
              Showing <span className="font-bold text-foreground">{indexOfFirst + 1}</span> to <span className="font-bold text-foreground">{Math.min(indexOfLast, filtered.length)}</span> of <span className="font-bold text-foreground">{filtered.length}</span> entries
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-xl h-9">
                <ChevronLeft className="size-4 mr-1" /> Previous
              </Button>
              <div className="text-sm font-bold px-4">
                Page {currentPage} of {totalPages}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-xl h-9">
                Next <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Disable Modal */}
      <Dialog open={disableModal.open} onOpenChange={(v) => !v && setDisableModal({ open: false, empId: "", name: "" })}>
        <DialogContent className="sm:max-w-[425px] rounded-[32px] p-0 overflow-hidden bg-white dark:bg-slate-900 border-2">
          <div className="bg-destructive/10 p-6 flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-destructive/20 text-destructive flex items-center justify-center shrink-0">
              <AlertTriangle className="size-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-destructive">Disable Employee Access</DialogTitle>
              <DialogDescription className="text-destructive/80 font-medium">For {disableModal.name}</DialogDescription>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="text-sm font-medium text-muted-foreground bg-destructive/5 p-4 rounded-xl border border-destructive/10">
              You are about to disable this employee's HRMS account. This will immediately revoke access to all modules, force logout all active sessions, and block future logins.
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Reason (Required)</Label>
              <Select value={disableReason} onValueChange={setDisableReason}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Resigned">Resigned</SelectItem>
                  <SelectItem value="Terminated">Terminated</SelectItem>
                  <SelectItem value="Suspension">Suspension</SelectItem>
                  <SelectItem value="Contract Ended">Contract Ended</SelectItem>
                  <SelectItem value="Long Leave">Long Leave</SelectItem>
                  <SelectItem value="Absconding">Absconding</SelectItem>
                  <SelectItem value="Security Reason">Security Reason</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Additional Notes (Optional)</Label>
              <Textarea 
                className="resize-none rounded-xl bg-slate-50 dark:bg-slate-950 min-h-[100px]" 
                placeholder="Add any internal context..." 
                value={disableNotes}
                onChange={e => setDisableNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDisableModal({ open: false, empId: "", name: "" })} className="rounded-xl font-bold h-11">Cancel</Button>
            <Button variant="destructive" onClick={handleDisable} disabled={submitting} className="rounded-xl font-bold h-11">
              Confirm Disable
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enable Modal */}
      <Dialog open={enableModal.open} onOpenChange={(v) => !v && setEnableModal({ open: false, empId: "", name: "" })}>
        <DialogContent className="sm:max-w-[425px] rounded-[32px] p-0 overflow-hidden bg-white dark:bg-slate-900 border-2">
          <div className="bg-emerald-500/10 p-6 flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-emerald-700 dark:text-emerald-500">Enable Employee Access</DialogTitle>
              <DialogDescription className="text-emerald-700/70 font-medium">For {enableModal.name}</DialogDescription>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="text-sm font-medium text-muted-foreground bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
              This will restore login capabilities for this employee. They will be able to access the HRMS portal based on their designated role permissions immediately.
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEnableModal({ open: false, empId: "", name: "" })} className="rounded-xl font-bold h-11">Cancel</Button>
            <Button className="rounded-xl font-bold h-11 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleEnable} disabled={submitting}>
              Confirm Enable
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyModal.open} onOpenChange={(v) => !v && setHistoryModal({ open: false, empId: "", name: "" })}>
        <DialogContent className="sm:max-w-[600px] rounded-[32px] p-0 overflow-hidden bg-slate-50 dark:bg-zinc-950 border-2 max-h-[80vh] flex flex-col">
          <div className="p-6 bg-white dark:bg-zinc-900 border-b flex-shrink-0">
            <DialogTitle className="text-xl font-black flex items-center gap-2"><History className="size-5 text-primary" /> Access History Log</DialogTitle>
            <DialogDescription>Audit trail for {historyModal.name}</DialogDescription>
          </div>
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            {logs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground italic text-sm">No access changes recorded yet.</div>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {logs.map((log: any, idx: number) => (
                  <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-zinc-950 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm ${log.action === 'Disabled' ? 'bg-destructive/20 text-destructive' : 'bg-emerald-500/20 text-emerald-600'}`}>
                      {log.action === 'Disabled' ? <ShieldAlert className="size-4" /> : <ShieldCheck className="size-4" />}
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border bg-white dark:bg-zinc-900 shadow-sm">
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className={`font-bold text-sm ${log.action === 'Disabled' ? 'text-destructive' : 'text-emerald-600'}`}>{log.action}</div>
                        <time className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{new Date(log.created_at).toLocaleString()}</time>
                      </div>
                      <div className="text-sm font-medium text-foreground mt-2">
                        {log.reason}
                      </div>
                      {log.notes && <div className="text-xs text-muted-foreground mt-2 italic bg-muted/50 p-2 rounded-lg">{log.notes}</div>}
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-3 pt-3 border-t">By {log.performed_by?.full_name || 'System'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
