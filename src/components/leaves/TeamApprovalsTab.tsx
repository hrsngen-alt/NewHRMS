import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X, Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function TeamApprovalsTab({ role, myEmployeeId, myName }: { role: string, myEmployeeId?: string, myName?: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [rejectionDialog, setRejectionDialog] = useState<{ open: boolean, leaveId: string | null }>({ open: false, leaveId: null });
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["team-leaves", role, myEmployeeId],
    queryFn: async () => {
      // Base query
      let query = supabase.from("leaves" as any)
        .select("*, employees:employees!leaves_employee_id_fkey!inner(full_name, employee_code, reporting_manager, department)")
        .order("created_at", { ascending: false });

      if (role === "manager" && myName) {
        // Managers only see their direct reports
        query = query.eq("employees.reporting_manager", myName);
      } else if (role !== "admin") {
        return []; // Should not happen as this tab is for manager/admin
      }

      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data || [];
    },
    enabled: role === "admin" || !!myName
  });

  const filteredLeaves = leaves.filter((l: any) => {
    if (!q) return true;
    const searchString = `${l.employees?.full_name} ${l.employees?.employee_code} ${l.leave_type} ${l.reason}`.toLowerCase();
    return searchString.includes(q.toLowerCase());
  });

  const decide = async (id: string, action: "approve" | "reject") => {
    let updatePayload: any = {};
    if (role === "admin") {
      updatePayload.hr_status = action === "approve" ? "approved" : "rejected";
      if (action === "approve") updatePayload.status = "approved";
      if (action === "reject") updatePayload.status = "rejected";
    } else {
      updatePayload.manager_status = action === "approve" ? "approved" : "rejected";
      // If manager rejects, overall status becomes rejected. If approves, it might wait for HR, 
      // but for simplicity, let's say manager approval = full approval unless we strictly enforce HR.
      // Let's implement full approval for now.
      if (action === "reject") updatePayload.status = "rejected";
      else updatePayload.status = "approved"; // or "pending_hr"
    }

    if (action === "reject" && rejectionReason) {
      updatePayload.rejection_reason = rejectionReason;
    }

    const { error } = await supabase.from("leaves" as any).update(updatePayload).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Leave ${action}d successfully`);
    setRejectionDialog({ open: false, leaveId: null });
    setRejectionReason("");
    qc.invalidateQueries({ queryKey: ["team-leaves"] });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading requests...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee name or reason..." className="pl-9 h-9" />
        </div>
      </div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
            <TableRow>
              <TableHead className="pl-6">Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Manager Status</TableHead>
              <TableHead>HR Status</TableHead>
              <TableHead className="text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeaves.map((l: any) => (
              <TableRow key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                <TableCell className="pl-6 font-bold">
                  {l.employees?.full_name}
                  <div className="text-xs text-muted-foreground font-normal">{l.employees?.department}</div>
                </TableCell>
                <TableCell className="font-medium">{l.leave_type}</TableCell>
                <TableCell className="text-sm">
                  {l.start_date} <br/><span className="text-muted-foreground">to</span> {l.end_date}
                </TableCell>
                <TableCell className="font-bold">{l.days}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${l.manager_status === 'approved' ? 'bg-green-100 text-green-700' : l.manager_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {l.manager_status || 'pending'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${l.hr_status === 'approved' ? 'bg-green-100 text-green-700' : l.hr_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {l.hr_status || 'pending'}
                  </span>
                </TableCell>
                <TableCell className="text-right pr-6">
                  {(l.status === "pending" || l.status === "approved" || role === "admin") && (
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => decide(l.id, "approve")}>
                        <Check className="size-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setRejectionDialog({ open: true, leaveId: l.id })}>
                        <X className="size-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredLeaves.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <FileText className="size-12 mx-auto mb-3 opacity-20" />
                  No leave requests found pending your approval.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={rejectionDialog.open} onOpenChange={(open) => !open && setRejectionDialog({ open: false, leaveId: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Leave Request</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Reason for Rejection (Mandatory)</label>
              <Textarea 
                value={rejectionReason} 
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason to the employee..." 
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectionDialog({ open: false, leaveId: null })}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectionReason.trim()} onClick={() => decide(rejectionDialog.leaveId!, "reject")}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
