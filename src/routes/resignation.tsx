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
import { LogOut, Calendar, ClipboardList, CheckCircle2, XCircle, Clock, Search, Filter } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/resignation")({
  component: () => (
    <AppShell>
      <ResignationPage />
    </AppShell>
  )
});

function ResignationPage() {
  const { user, role, employeeId } = useAuth();
  const qc = useQueryClient();
  const isAdmin = role === "admin";
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [finalDate, setFinalDate] = useState("");

  // Fetch Resignations
  const { data: resignations = [], isLoading } = useQuery({
    queryKey: ["resignations"],
    queryFn: async () => {
      let query = (supabase.from("resignations" as any) as any).select("*, employees(full_name, employee_code, department)");
      
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

  const handleWithdraw = async (id: string) => {
    if (!window.confirm("Are you sure you want to withdraw your resignation request?")) return;
    setBusy(true);
    try {
      const { error } = await (supabase.from("resignations" as any) as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Resignation request withdrawn.");
      qc.invalidateQueries({ queryKey: ["resignations"] });
    } catch (err: any) {
      toast.error(err.message || "Withdrawal failed.");
    } finally {
      setBusy(false);
    }
  };

  const filtered = resignations.filter((r: any) => 
    r.employees?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.employees?.employee_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">Resignation Management</h1>
          <p className="text-sm font-medium text-muted-foreground/60 mt-1">Manage employee offboarding and formal departure requests.</p>
        </div>
      </div>

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
          <div className="flex items-center justify-between gap-4">
             <h2 className="text-xl font-black tracking-tight">{isAdmin ? "Pending Applications" : "Application History"}</h2>
             {isAdmin && (
               <div className="relative w-72">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                 <Input 
                   placeholder="Search applicants..." 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="pl-9 rounded-xl h-10 border-slate-200"
                 />
               </div>
             )}
          </div>

          <div className="rounded-[32px] border-2 bg-white dark:bg-slate-900 shadow-xl shadow-slate-100 dark:shadow-none overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableRow className="border-none">
                  {isAdmin && <TableHead className="font-black uppercase text-[10px] tracking-widest">Employee</TableHead>}
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Applied Date</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Last Day</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest">Reason</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Actions</TableHead>
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
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-900 dark:text-white">{r.employees?.full_name}</span>
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
                       )}>
                         {r.status}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
                          <span className="text-[10px] font-black uppercase text-muted-foreground/40 italic">Handled</span>
                        )
                      ) : (
                        r.status === 'pending' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleWithdraw(r.id)} 
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
        </div>
      </div>

      {/* Approval Dialog */}
      <Dialog open={!!selectedRequest && !busy} onOpenChange={(val) => !val && setSelectedRequest(null)}>
        <DialogContent className="rounded-[32px] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">Review Resignation</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-1">
               <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Applicant</p>
               <p className="font-bold text-lg">{selectedRequest?.employees?.full_name}</p>
               <p className="text-xs text-muted-foreground">Applied on: {new Date(selectedRequest?.resignation_date).toLocaleDateString('en-GB')}</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-primary">Final Last Working Day</Label>
              <Input 
                type="date" 
                value={finalDate} 
                onChange={e => setFinalDate(e.target.value)}
                className="h-12 rounded-xl border-2 focus:border-primary"
              />
              <p className="text-[10px] text-muted-foreground italic">Admin: You can override the employee's proposed date here.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setSelectedRequest(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={() => handleAction("approved")} disabled={busy} className="rounded-xl px-8 font-bold">Approve & Set Date</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
