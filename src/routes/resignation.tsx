import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Calendar, ClipboardList, CheckCircle2, XCircle, Clock, Search, Filter, Pencil, Eye, User, Mail, Phone, Building2, Fingerprint, FileIcon, ShieldCheck } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { TerminationPanel } from "./-termination-panel";
import { usePermissions } from "@/hooks/usePermissions";
export const Route = createFileRoute("/resignation")({
  component: () => (
    <AppShell>
      <ResignationPage />
    </AppShell>
  )
});

function ResignationPage() {
  const { user, role, employeeId } = useAuth();
  const { hasPermission } = usePermissions();
  const qc = useQueryClient();
  const isAdmin = role === "admin";
  const isTerminationAdmin = role === "admin" || hasPermission("Termination", "manage") || hasPermission("Termination", "view");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [finalDate, setFinalDate] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<any>(null);

  // Fetch Resignations
  const { data: resignations = [], isLoading } = useQuery({
    queryKey: ["resignations"],
    queryFn: async () => {
      let query = (supabase.from("resignations" as any) as any).select("*, employees(*)");
      
      if (!isAdmin && employeeId) {
        query = query.eq("employee_id", employeeId);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const handleApply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!employeeId) return;
    setBusy(true);

    const fd = new FormData(e.currentTarget);
    const reason = fd.get("reason") as string;

    try {
      const { error } = await (supabase.from("resignations" as any) as any).insert({
        employee_id: employeeId,
        last_working_day: new Date().toISOString().split('T')[0], // Dummy initially, will be updated by admin
        reason: reason,
        status: "pending"
      });

      if (error) throw error;

      // Notify Admins
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (admins && admins.length > 0) {
        const { data: empData } = await supabase.from("employees").select("full_name").eq("id", employeeId).single();
        const notifications = admins.map(admin => ({
          user_id: admin.user_id,
          title: "New Resignation Request",
          message: `${empData?.full_name || 'An employee'} has applied for resignation.`,
          is_read: false,
          type: 'warning',
          link: '/resignation'
        }));
        await (supabase.from("notifications" as any) as any).insert(notifications);
      }

      toast.success("Resignation application submitted successfully.");
      qc.invalidateQueries({ queryKey: ["resignations"] });
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit resignation.");
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (status: "approved" | "rejected") => {
    if (!selectedRequest) return;
    setBusy(true);
    try {
      const updates: any = { 
        status, 
        approved_by: user?.id 
      };

      if (status === "approved") {
        if (!finalDate) {
          toast.error("Please set the Final Last Working Day.");
          setBusy(false);
          return;
        }
        updates.last_working_day = finalDate;
      }

      const { error } = await (supabase.from("resignations" as any) as any).update(updates).eq("id", selectedRequest.id);
      
      if (error) throw error;

      // Automatically update employee status to 'Resigned'
      if (status === "approved") {
        await supabase.from("employees").update({ status: "Resigned" }).eq("id", selectedRequest.employee_id);
      }

      toast.success(`Resignation ${status} successfully.`);
      setSelectedRequest(null);
      setFinalDate("");
      qc.invalidateQueries({ queryKey: ["resignations"] });
    } catch (err: any) {
      toast.error(err.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async (r: any) => {
    if (!window.confirm("Are you sure you want to withdraw your resignation request?")) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc('withdraw_resignation', { resignation_id: r.id });
      if (error) throw error;

      toast.success("Resignation request withdrawn.");
      qc.invalidateQueries({ queryKey: ["resignations"] });
    } catch (err: any) {
      toast.error(err.message || "Withdrawal failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateDate = async () => {
    if (!selectedRequest || !finalDate) return;
    setBusy(true);
    try {
      const { error } = await (supabase.from("resignations" as any) as any).update({ 
        last_working_day: finalDate 
      }).eq("id", selectedRequest.id);
      
      if (error) throw error;
      toast.success("Exit date updated successfully.");
      setSelectedRequest(null);
      setFinalDate("");
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ["resignations"] });
    } catch (err: any) {
      toast.error(err.message || "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const filtered = resignations.filter((r: any) => {
    const matchesSearch = r.employees?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                         r.employees?.employee_code?.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || r.employees?.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const departments = Array.from(new Set(resignations.map((r: any) => r.employees?.department).filter(Boolean))).sort();

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">Offboarding</h1>
          <p className="text-sm font-medium text-muted-foreground/60 mt-1">Manage employee resignations and company-initiated terminations.</p>
        </div>
      </div>

      <Tabs defaultValue="resignation" className="space-y-8">
        <TabsList className="bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl">
          <TabsTrigger value="resignation" className="rounded-lg font-bold">Resignations</TabsTrigger>
          {isTerminationAdmin && (
            <TabsTrigger value="termination" className="rounded-lg font-bold">Employee Termination</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="resignation" className="space-y-10">
          <div className="grid lg:grid-cols-12 gap-10">
        {!isAdmin && (
          <div className="lg:col-span-4 space-y-6">
            <Card className="rounded-[32px] border-2 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <LogOut className="size-5 text-primary" /> Apply for Resignation
                </CardTitle>
                <CardDescription>Submit your formal resignation request here.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleApply} className="space-y-6">
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Application Date</Label>
                    <p className="font-bold text-slate-900 dark:text-white">{new Date().toLocaleDateString('en-GB')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Reason for Leaving</Label>
                    <Textarea id="reason" name="reason" placeholder="Please explain your reason for resignation..." required className="min-h-[150px] rounded-xl resize-none" />
                  </div>
                  <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20">
                    {busy ? "Submitting..." : "Submit Resignation"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 dark:bg-amber-500/5 dark:border-amber-500/10">
               <p className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-2 uppercase tracking-widest mb-2">
                  <Clock className="size-4" /> Notice Period Policy
               </p>
               <p className="text-sm text-amber-800/80 dark:text-amber-400/60 leading-relaxed">
                  Standard notice period is 30 days. Your final settlement will be processed within 15 days of your last working day.
               </p>
            </div>
          </div>
        )}

        <div className={cn("space-y-6", isAdmin ? "lg:col-span-12" : "lg:col-span-8")}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <h2 className="text-xl font-black tracking-tight">{isAdmin ? "Pending Applications" : "Application History"}</h2>
             {isAdmin && (
               <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                 <div className="relative w-full sm:w-64">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                   <Input 
                     placeholder="Search applicants..." 
                     value={search}
                     onChange={e => setSearch(e.target.value)}
                     className="pl-9 rounded-xl h-10 border-slate-200 w-full"
                   />
                 </div>
                 <select 
                   value={deptFilter} 
                   onChange={e => setDeptFilter(e.target.value)}
                   className="h-10 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-primary w-full sm:w-auto"
                 >
                   <option value="all">All Departments</option>
                   {departments.map((d: any) => (
                     <option key={d} value={d}>{d}</option>
                   ))}
                 </select>
               </div>
             )}
          </div>

          <div className="rounded-[32px] border-2 bg-white dark:bg-slate-900 shadow-xl shadow-slate-100 dark:shadow-none overflow-hidden">
            {/* Desktop View - Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                  <TableRow className="border-none">
                    {isAdmin && <TableHead className="font-black uppercase text-[10px] tracking-widest pl-6">Employee</TableHead>}
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Applied Date</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Last Day</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Reason</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={isAdmin ? 6 : 4} className="h-40 text-center animate-pulse font-black text-primary">Loading records...</TableCell></TableRow>
                  ) : (filtered as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={isAdmin ? 6 : 4} className="h-40 text-center text-muted-foreground italic">No resignation records found.</TableCell></TableRow>
                  ) : (filtered as any[]).map((r) => (
                    <TableRow key={r.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      {isAdmin && (
                        <TableCell className="pl-6">
                          <div 
                            className="flex flex-col cursor-pointer hover:text-primary group/name"
                            onClick={() => setViewingEmployee(r.employees)}
                          >
                             <span className="font-bold text-slate-900 dark:text-white group-hover/name:underline">{r.employees?.full_name}</span>
                             <span className="text-[10px] font-mono text-muted-foreground">{r.employees?.employee_code}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{new Date(r.resignation_date).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell className="font-bold text-slate-700 dark:text-slate-300">
                        {r.status === 'approved' ? new Date(r.last_working_day).toLocaleDateString('en-GB') : (
                          <span className="text-[10px] font-black uppercase text-muted-foreground/40 italic">TBD</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                         <p className="text-xs text-muted-foreground truncate" title={r.reason}>{r.reason}</p>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge className={cn(
                           "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                           r.status === 'pending' && "bg-amber-50 text-amber-600 border-amber-100",
                           r.status === 'approved' && "bg-green-50 text-green-600 border-green-100",
                           r.status === 'rejected' && "bg-red-50 text-red-600 border-red-100",
                           r.status === 'withdrawn' && "bg-slate-100 text-slate-600 border-slate-200",
                         )}>
                           {r.status}
                         </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {isAdmin ? (
                          r.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-2">
                               <Button 
                                 size="icon" 
                                 variant="ghost" 
                                 onClick={() => { setSelectedRequest(r); setFinalDate(r.last_working_day); }} 
                                 className="text-green-600 hover:bg-green-50 rounded-lg"
                               >
                                 <CheckCircle2 className="size-5" />
                               </Button>
                               <Button 
                                 size="icon" 
                                 variant="ghost" 
                                 onClick={() => { setSelectedRequest(r); handleAction("rejected"); }} 
                                 className="text-red-600 hover:bg-red-50 rounded-lg"
                               >
                                 <XCircle className="size-5" />
                               </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                               <Button 
                                 size="sm" 
                                 variant="ghost" 
                                 onClick={() => { setSelectedRequest(r); setFinalDate(r.last_working_day); setIsEditing(true); }} 
                                 className="text-primary hover:bg-primary/5 font-bold text-xs rounded-lg"
                               >
                                 <Pencil className="size-4 mr-1" /> Edit Date
                               </Button>
                            </div>
                          )
                        ) : (
                          (r.status === 'pending' || r.status === 'approved') && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleWithdraw(r)} 
                              disabled={busy}
                              className="text-red-600 hover:bg-red-50 font-bold text-xs gap-2 rounded-xl"
                            >
                              Withdraw
                            </Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View - Stacked Cards List */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <div className="p-10 text-center animate-pulse font-black text-primary">Loading records...</div>
              ) : (filtered as any[]).length === 0 ? (
                <div className="p-10 text-center text-muted-foreground italic">No resignation records found.</div>
              ) : (filtered as any[]).map((r) => (
                <div key={r.id} className="p-4 space-y-3">
                  {/* Header: Employee / ID and Status Badge */}
                  <div className="flex justify-between items-start">
                    {isAdmin ? (
                      <div 
                        className="flex flex-col cursor-pointer hover:text-primary group/name"
                        onClick={() => setViewingEmployee(r.employees)}
                      >
                         <span className="font-bold text-slate-900 dark:text-white group-hover/name:underline">{r.employees?.full_name}</span>
                         <span className="text-[10px] font-mono text-muted-foreground">{r.employees?.employee_code}</span>
                      </div>
                    ) : (
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">Resignation Application</span>
                        <p className="text-[10px] font-mono text-muted-foreground">ID: {r.id.slice(0, 8)}...</p>
                      </div>
                    )}
                    <Badge className={cn(
                      "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                      r.status === 'pending' && "bg-amber-50 text-amber-600 border-amber-100",
                      r.status === 'approved' && "bg-green-50 text-green-600 border-green-100",
                      r.status === 'rejected' && "bg-red-50 text-red-600 border-red-100",
                      r.status === 'withdrawn' && "bg-slate-100 text-slate-600 border-slate-200",
                    )}>
                      {r.status}
                    </Badge>
                  </div>

                  {/* Date details */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Applied Date</span>
                      <span className="font-medium text-foreground">{new Date(r.resignation_date).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Last Day</span>
                      <span className="font-bold text-foreground">
                        {r.status === 'approved' ? new Date(r.last_working_day).toLocaleDateString('en-GB') : "TBD"}
                      </span>
                    </div>
                  </div>

                  {/* Reason */}
                  {r.reason && (
                    <div className="text-xs pt-1">
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Reason</span>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{r.reason}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                    {isAdmin ? (
                      r.status === 'pending' ? (
                        <div className="flex items-center gap-2 w-full">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => { setSelectedRequest(r); setFinalDate(r.last_working_day); }} 
                            className="flex-1 border-green-200 text-green-700 hover:bg-green-50 rounded-xl h-9 text-xs"
                          >
                            <CheckCircle2 className="size-4 mr-1 text-green-600" /> Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => { setSelectedRequest(r); handleAction("rejected"); }} 
                            className="flex-1 border-red-200 text-red-700 hover:bg-red-50 rounded-xl h-9 text-xs"
                          >
                            <XCircle className="size-4 mr-1 text-red-600" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => { setSelectedRequest(r); setFinalDate(r.last_working_day); setIsEditing(true); }} 
                          className="w-full text-primary hover:bg-primary/5 font-bold text-xs rounded-xl h-9"
                        >
                          <Pencil className="size-4 mr-1" /> Edit exit date
                        </Button>
                      )
                    ) : (
                      (r.status === 'pending' || r.status === 'approved') && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleWithdraw(r)} 
                          disabled={busy}
                          className="w-full text-red-600 hover:bg-red-50 border-red-200 font-bold text-xs gap-2 rounded-xl h-9"
                        >
                          Withdraw Request
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Approval Dialog */}
      <Dialog open={!!selectedRequest && !busy} onOpenChange={(val) => !val && setSelectedRequest(null)}>
        <DialogContent className="rounded-[32px] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              {isEditing ? "Update Exit Date" : "Review Resignation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-1">
               <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Applicant</p>
               <p className="font-bold text-lg">{selectedRequest?.employees?.full_name}</p>
               <p className="text-[10px] font-mono text-muted-foreground">{selectedRequest?.employees?.department}</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-primary">Final Last Working Day</Label>
              <Input 
                type="date" 
                value={finalDate} 
                onChange={e => setFinalDate(e.target.value)}
                className="h-12 rounded-xl border-2 focus:border-primary"
              />
              <p className="text-[10px] text-muted-foreground italic">Admin: Setting the official exit date for this employee.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setSelectedRequest(null); setIsEditing(false); }} className="rounded-xl">Cancel</Button>
            <Button 
              onClick={() => isEditing ? handleUpdateDate() : handleAction("approved")} 
              disabled={busy} 
              className="rounded-xl px-8 font-bold"
            >
              {isEditing ? "Update Date" : "Approve & Set Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Profile Quick View */}
      <Dialog open={!!viewingEmployee} onOpenChange={(val) => !val && setViewingEmployee(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[32px] border-none shadow-2xl">
          {viewingEmployee && (
            <div className="flex flex-col h-[85vh]">
              {/* Header */}
              <div className="relative h-48 shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-primary to-purple-700" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                <div className="relative h-full flex items-end p-8 gap-6">
                  <div className="size-32 rounded-[40px] bg-white p-1 shadow-2xl overflow-hidden shrink-0 translate-y-6 border-4 border-white/20">
                    {viewingEmployee.photo_url ? (
                      <img src={viewingEmployee.photo_url} className="size-full object-cover rounded-[32px]" />
                    ) : (
                      <div className="size-full bg-slate-100 flex items-center justify-center text-4xl font-black text-primary">
                        {viewingEmployee.full_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="mb-4">
                    <h2 className="text-3xl font-black text-white tracking-tight">{viewingEmployee.full_name}</h2>
                    <p className="text-white/70 font-mono text-sm">{viewingEmployee.employee_code}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 pt-12">
                <div className="grid md:grid-cols-2 gap-10">
                   <div className="space-y-8">
                      <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                           <User className="size-4" /> Personal & Contact
                        </h3>
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl">
                           <DetailItem label="Email" value={viewingEmployee.email} />
                           <DetailItem label="Phone" value={viewingEmployee.phone} />
                           <DetailItem label="PAN" value={viewingEmployee.pan_number} />
                           <DetailItem label="Aadhaar" value={viewingEmployee.aadhaar_number} />
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                           <ShieldCheck className="size-4" /> Employment Details
                        </h3>
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl">
                           <DetailItem label="Joining Date" value={viewingEmployee.joining_date} />
                           <DetailItem label="Department" value={viewingEmployee.department} />
                           <DetailItem label="Designation" value={viewingEmployee.designation} />
                           <DetailItem label="Status" value={viewingEmployee.status} badge />
                        </div>
                      </section>
                   </div>

                   <div className="space-y-8">
                      <section className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                           <Fingerprint className="size-4" /> Banking & Payroll
                        </h3>
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl">
                           <DetailItem label="Bank Name" value={viewingEmployee.bank_name} />
                           <DetailItem label="IFSC Code" value={viewingEmployee.bank_ifsc} />
                           <DetailItem label="Basic Pay" value={viewingEmployee.basic_salary ? `₹${Number(viewingEmployee.basic_salary).toLocaleString()}` : null} />
                        </div>
                      </section>

                      <div className="p-6 rounded-[32px] bg-indigo-50 border border-indigo-100 dark:bg-indigo-500/5 dark:border-indigo-500/10 flex items-center gap-4">
                         <div className="size-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                            <Clock className="size-6 text-indigo-600" />
                         </div>
                         <div>
                            <p className="text-sm font-black text-indigo-900 dark:text-indigo-300">Resignation Status</p>
                            <p className="text-[10px] text-indigo-600/60 uppercase font-black tracking-widest">Active Review</p>
                         </div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-900/80 border-t flex justify-end">
                <Button onClick={() => setViewingEmployee(null)} className="rounded-xl px-8 font-black">Close Profile</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>
        
        {isTerminationAdmin && (
          <TabsContent value="termination" className="space-y-10 mt-0">
            <TerminationPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function DetailItem({ label, value, badge }: { label: string; value: any; badge?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 overflow-hidden">
      <span className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest">{label}</span>
      {badge ? (
        <Badge className={cn(
          "w-fit px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border-none",
          value?.toString().toLowerCase() === 'active' ? "bg-green-100 text-green-700" : 
          value?.toString().toLowerCase() === 'resigned' ? "bg-red-100 text-red-700" : 
          "bg-slate-100 text-slate-700"
        )}>
          {value}
        </Badge>
      ) : (
        <span className="text-xs font-bold text-slate-900 dark:text-white truncate" title={value}>{value}</span>
      )}
    </div>
  );
}
