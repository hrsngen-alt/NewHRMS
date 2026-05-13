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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { Plus, Check, X, CalendarDays, Search } from "lucide-react";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/leaves")({ component: () => <AppShell><LeavesPage /></AppShell> });

function LeavesPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState("all");
  const [q, setQ] = useState("");
  const { myEmployee } = useMyEmployee();

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["all-employees"],
    enabled: role === "admin",
    queryFn: async () => (await supabase.from("employees").select("id, full_name").eq("status", "active").order("full_name")).data || [],
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves", role, myEmployee?.id],
    queryFn: async () => {
      let q = supabase.from("leaves").select("*, employees(full_name, employee_code, department)").order("created_at", { ascending: false });
      if (role !== "admin" && myEmployee) q = (q as any).eq("employee_id", myEmployee.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const departments = useMemo(() => {
    const set = new Set(leaves.map(l => (l as any).employees?.department).filter(Boolean));
    return Array.from(set).sort();
  }, [leaves]);

  const filteredLeaves = leaves.filter((l: any) => {
    const matchesDept = deptFilter === "all" || l.employees?.department === deptFilter;
    const matchesQ = !q || [l.employees?.full_name, l.reason, l.leave_type].some(v => v?.toLowerCase().includes(q.toLowerCase()));
    return matchesDept && matchesQ;
  });

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const targetEmployeeId = role === "admin" ? String(fd.get("employee_id")) : myEmployee?.id;
    if (!targetEmployeeId || targetEmployeeId === "undefined" || targetEmployeeId === "null") return toast.error("No employee profile linked/selected.");

    const start = String(fd.get("start_date"));
    const end = String(fd.get("end_date"));
    const days = Math.max(1, Math.round((+new Date(end) - +new Date(start)) / 86_400_000) + 1);
    const { error } = await supabase.from("leaves").insert({
      employee_id: targetEmployeeId, leave_type: String(fd.get("leave_type")),
      start_date: start, end_date: end, days, reason: String(fd.get("reason") || ""),
    });
    if (error) return toast.error(error.message);
    toast.success("Leave requested");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["leaves"] });
  };

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("leaves").update({ status, approved_by: user!.id }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Leave ${status}`);
    qc.invalidateQueries({ queryKey: ["leaves"] });
  };

  const statusColor: Record<string, string> = {
    pending: "bg-warning/10 text-warning",
    approved: "bg-success/10 text-success",
    rejected: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and manage time-off requests.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm bg-primary hover:bg-primary-glow transition-all">
              <Plus className="size-4" /> Request Leave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="text-xl">Request Time Off</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-5 mt-4">
              {role === "admin" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Employee</Label>
                  <Select name="employee_id" required>
                    <SelectTrigger className="bg-muted/30"><SelectValue placeholder="Select Employee" /></SelectTrigger>
                    <SelectContent>
                      {allEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Leave Type</Label>
                <Select name="leave_type" defaultValue="casual">
                  <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="paid">Earned / Paid Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start_date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Date</Label>
                  <Input id="start_date" name="start_date" type="date" required className="bg-muted/30" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end_date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">End Date</Label>
                  <Input id="end_date" name="end_date" type="date" required className="bg-muted/30" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reason" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason for Leave</Label>
                <Textarea id="reason" name="reason" placeholder="Briefly describe the reason for your time-off request..." className="bg-muted/30 min-h-[100px]" />
              </div>
              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="px-8">Submit Request</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/20 px-6 py-2 border-b flex flex-wrap items-center gap-4">
          <h3 className="font-semibold shrink-0">Leave Requests</h3>
          {isAdmin && (
            <div className="flex flex-1 items-center gap-3 min-w-[300px]">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or reason..." className="pl-9 h-9 bg-background" />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-48 h-9 bg-background">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                {role === "admin" && <TableHead className="font-bold text-foreground pl-6">Employee</TableHead>}
                <TableHead className={cn("font-bold text-foreground", role !== "admin" && "pl-6")}>Type</TableHead>
                <TableHead className="font-bold text-foreground">Duration</TableHead>
                <TableHead className="font-bold text-foreground">Days</TableHead>
                <TableHead className="font-bold text-foreground">Reason</TableHead>
                <TableHead className="font-bold text-foreground">Status</TableHead>
                {role === "admin" && <TableHead className="text-right pr-6">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaves.map((l: any) => (
                <TableRow key={l.id} className="hover:bg-muted/5 transition-colors">
                  {role === "admin" && <TableCell className="font-semibold pl-6">{l.employees?.full_name}</TableCell>}
                  <TableCell className={cn("capitalize font-medium", role !== "admin" && "pl-6")}>{l.leave_type} Leave</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{l.start_date}</span>
                      <span className="text-xs text-muted-foreground">to {l.end_date}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-foreground">{l.days}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{l.reason}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize",
                      statusColor[l.status]
                    )}>
                      {l.status}
                    </span>
                  </TableCell>
                  {role === "admin" && (
                    <TableCell className="text-right pr-6">
                      {l.status === "pending" && (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => decide(l.id, "approved")} className="hover:bg-green-50">
                            <Check className="size-4 text-success" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => decide(l.id, "rejected")} className="hover:bg-red-50">
                            <X className="size-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filteredLeaves.length === 0 && (
                <TableRow>
                  <TableCell colSpan={role === "admin" ? 8 : 6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarDays className="size-10 text-muted-foreground/30" />
                      <p className="text-muted-foreground font-medium">No leave requests found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
