import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { Plus, Umbrella } from "lucide-react";

import { MyLeavesTab } from "@/components/leaves/MyLeavesTab";
import { TeamApprovalsTab } from "@/components/leaves/TeamApprovalsTab";
import { LeaveConfigTab } from "@/components/leaves/LeaveConfigTab";

export const Route = createFileRoute("/leaves")({ component: () => <AppShell><LeavesPage /></AppShell> });

function LeavesPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const [open, setOpen] = useState(false);
  const { myEmployee } = useMyEmployee();

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["all-employees"],
    enabled: role === "admin",
    queryFn: async () => (await supabase.from("employees").select("id, full_name").eq("status", "active").order("full_name")).data || [],
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["leave-types-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_types" as any).select("*").order("name");
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data || [];
    }
  });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const targetEmployeeId = role === "admin" ? String(fd.get("employee_id") || myEmployee?.id) : myEmployee?.id;
    if (!targetEmployeeId || targetEmployeeId === "undefined" || targetEmployeeId === "null") return toast.error("No employee profile linked/selected.");

    const start = String(fd.get("start_date"));
    const end = String(fd.get("end_date"));
    const days = Math.max(1, Math.round((+new Date(end) - +new Date(start)) / 86_400_000) + 1);
    
    // Determine manager logic
    let manager_id = null;
    if (targetEmployeeId === myEmployee?.id) {
      if (myEmployee?.reporting_manager) {
        // We'd ideally lookup the ID of the reporting manager here, but for simplicity we rely on the name
        // Wait, the DB expects UUID for manager_id. Since we only have name, we might leave it null and 
        // rely on `employees.reporting_manager` for TeamApprovals Tab logic (which we do!).
      }
    }

    const { error } = await supabase.from("leaves").insert({
      employee_id: targetEmployeeId, 
      leave_type: String(fd.get("leave_type")),
      start_date: start, 
      end_date: end, 
      days, 
      reason: String(fd.get("reason") || ""),
      status: "pending",
      manager_status: "pending",
      hr_status: "pending"
    } as any);

    if (error) {
      if (error.code === '42P01') return toast.error("Please run the Leave Module SQL script first!");
      return toast.error(error.message);
    }
    
    toast.success("Leave requested successfully");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["my-leaves"] });
    qc.invalidateQueries({ queryKey: ["team-leaves"] });
  };

  return (
    <div className="space-y-0 animate-in fade-in duration-500 pb-20">

      {/* ── Hero Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 border border-indigo-100 dark:border-transparent shadow-sm dark:shadow-none mb-6 md:mb-8">
        {/* Decorative glow blobs - only visible in dark mode */}
        <div className="absolute -top-16 -left-16 size-56 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none dark:opacity-100 opacity-0" />
        <div className="absolute -bottom-10 right-0 size-72 rounded-full bg-violet-600/10 blur-3xl pointer-events-none dark:opacity-100 opacity-0" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-6 md:px-10 md:py-8">
          <div className="flex items-start gap-4">
            <div className="size-11 rounded-xl bg-indigo-100 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Umbrella className="size-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                Leave Management
              </h1>
              <p className="text-sm font-medium text-slate-500 dark:text-indigo-300/70 mt-1">
                Manage balances, approvals, and configurations.
              </p>
            </div>
          </div>

          {myEmployee && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="shrink-0 h-10 md:h-11 rounded-xl gap-2 font-bold px-5 md:px-6 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 border border-indigo-500/50 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <Plus className="size-4" /> Request Leave
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-2xl">
                <DialogHeader><DialogTitle className="text-xl font-black">Request Time Off</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="space-y-5 mt-4">
                  {role === "admin" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Apply On Behalf Of</Label>
                      <Select name="employee_id" defaultValue={myEmployee.id}>
                        <SelectTrigger className="bg-muted/30"><SelectValue placeholder="Select Employee" /></SelectTrigger>
                        <SelectContent>
                          {allEmployees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Leave Type</Label>
                    <Select name="leave_type" required>
                      <SelectTrigger className="bg-muted/30"><SelectValue placeholder="Select type..." /></SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map((lt: any) => (
                          <SelectItem key={lt.id} value={lt.code}>{lt.name} ({lt.code})</SelectItem>
                        ))}
                        {leaveTypes.length === 0 && (
                          <SelectItem value="CL">Casual Leave (Default)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Date</Label>
                      <Input id="start_date" name="start_date" type="date" required className="bg-muted/30" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">End Date</Label>
                      <Input id="end_date" name="end_date" type="date" required className="bg-muted/30" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason for Leave</Label>
                    <Textarea id="reason" name="reason" required placeholder="Briefly describe the reason for your time-off request..." className="bg-muted/30 min-h-[100px]" />
                  </div>

                  <DialogFooter className="pt-4 border-t">
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Submit Request</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="my-leaves" className="w-full space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl h-auto w-full md:w-auto flex flex-wrap md:inline-flex justify-start gap-1">
          <TabsTrigger
            value="my-leaves"
            className="rounded-lg h-9 px-4 md:px-6 text-sm font-bold text-slate-600 dark:text-slate-400 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm flex-1 md:flex-none transition-all"
          >
            My Leaves
          </TabsTrigger>
          {(isManager || isAdmin) && (
            <TabsTrigger
              value="team-approvals"
              className="rounded-lg h-9 px-4 md:px-6 text-sm font-bold text-slate-600 dark:text-slate-400 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm flex-1 md:flex-none transition-all"
            >
              Team Approvals
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger
              value="admin-config"
              className="rounded-lg h-9 px-4 md:px-6 text-sm font-bold text-slate-600 dark:text-slate-400 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm flex-1 md:flex-none transition-all"
            >
              Leave Config
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="my-leaves" className="m-0 focus-visible:outline-none">
          <MyLeavesTab employeeId={myEmployee?.id} />
        </TabsContent>

        {(isManager || isAdmin) && (
          <TabsContent value="team-approvals" className="m-0 focus-visible:outline-none">
            <TeamApprovalsTab role={role!} myEmployeeId={myEmployee?.id} myName={myEmployee?.full_name} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="admin-config" className="m-0 focus-visible:outline-none">
            <LeaveConfigTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
