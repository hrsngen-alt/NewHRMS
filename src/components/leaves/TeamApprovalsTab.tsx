import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X, Search, FileText, Calendar, Clock, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format, isWithinInterval, parseISO } from "date-fns";

export function TeamApprovalsTab({ role, myEmployeeId, myUserId, myName }: { role: string, myEmployeeId?: string, myUserId?: string, myName?: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [rejectionDialog, setRejectionDialog] = useState<{ open: boolean, leaveId: string | null }>({ open: false, leaveId: null });
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "history" | "calendar">("pending");
  const [calendarDate, setCalendarDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["team-leaves", role, myEmployeeId],
    queryFn: async () => {
      // Base query for ALL leaves (not just pending)
      let query = supabase.from("leaves" as any)
        .select("*, employees:employees!leaves_employee_id_fkey!inner(full_name, employee_code, reporting_manager, department)")
        .order("created_at", { ascending: false });

      if (role === "manager" && myName) {
        // Managers only see their direct reports
        query = query.eq("employees.reporting_manager", myName);
      } else if (role !== "admin") {
        return [];
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

  const filteredLeaves = useMemo(() => leaves.filter((l: any) => {
    if (!q) return true;
    const searchString = `${l.employees?.full_name} ${l.employees?.employee_code} ${l.leave_type} ${l.reason}`.toLowerCase();
    return searchString.includes(q.toLowerCase());
  }), [leaves, q]);

  const pendingLeaves = useMemo(() => filteredLeaves.filter((l: any) => l.status === "pending"), [filteredLeaves]);
  
  const leavesOnCalendarDate = useMemo(() => {
    if (!calendarDate) return [];
    const dateObj = parseISO(calendarDate);
    return leaves.filter((l: any) => {
      try {
        const start = parseISO(l.start_date);
        const end = parseISO(l.end_date);
        // Include if date falls in range (or equals start/end)
        return isWithinInterval(dateObj, { start, end }) || l.start_date === calendarDate || l.end_date === calendarDate;
      } catch (e) {
        return false;
      }
    });
  }, [leaves, calendarDate]);

  const decide = async (id: string, action: "approve" | "reject") => {
    let updatePayload: any = {};
    if (role === "admin") {
      updatePayload.hr_status = action === "approve" ? "approved" : "rejected";
      if (action === "approve") updatePayload.status = "approved";
      if (action === "reject") updatePayload.status = "rejected";
    } else {
      updatePayload.manager_status = action === "approve" ? "approved" : "rejected";
      if (action === "reject") updatePayload.status = "rejected";
      else updatePayload.status = "approved";
    }

    if (action === "reject" && rejectionReason) {
      updatePayload.rejection_reason = rejectionReason;
    }

    if (myUserId) {
      updatePayload.approved_by = myUserId;
    } else {
      updatePayload.approved_by = null; // Admin without linked employee
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
    <div className="space-y-6">
      
      {/* Inner Navigation */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl border shadow-sm">
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab("pending")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === "pending" ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
          >
            <Clock className="size-4" /> Pending Approvals
            {pendingLeaves.length > 0 && <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md text-[10px]">{pendingLeaves.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === "history" ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
          >
            <History className="size-4" /> Team Leave History
          </button>
          <button 
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === "calendar" ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
          >
            <Calendar className="size-4" /> Team Calendar
          </button>
        </div>
        
        {activeTab !== "calendar" && (
          <div className="relative w-full sm:w-64 shrink-0 px-2 sm:px-0">
            <Search className="absolute left-3 sm:left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee..." className="pl-9 h-9 w-full bg-slate-50 dark:bg-slate-800 border-none" />
          </div>
        )}
      </div>

      {activeTab === "pending" && (
        <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="pl-6 whitespace-nowrap">Employee</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="whitespace-nowrap">Dates</TableHead>
                  <TableHead className="whitespace-nowrap">Days</TableHead>
                  <TableHead className="whitespace-nowrap">Manager Status</TableHead>
                  <TableHead className="whitespace-nowrap">HR Status</TableHead>
                  <TableHead className="text-right pr-6 whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLeaves.map((l: any) => (
                  <TableRow key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <TableCell className="pl-6 font-bold whitespace-nowrap">
                      {l.employees?.full_name}
                      <div className="text-xs text-muted-foreground font-normal">{l.employees?.department}</div>
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{l.leave_type}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {l.start_date} <br/><span className="text-muted-foreground">to</span> {l.end_date}
                    </TableCell>
                    <TableCell className="font-bold whitespace-nowrap">{l.days}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize whitespace-nowrap ${l.manager_status === 'approved' ? 'bg-green-100 text-green-700' : l.manager_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {l.manager_status || 'pending'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize whitespace-nowrap ${l.hr_status === 'approved' ? 'bg-green-100 text-green-700' : l.hr_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {l.hr_status || 'pending'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => decide(l.id, "approve")}>
                          <Check className="size-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setRejectionDialog({ open: true, leaveId: l.id })}>
                          <X className="size-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {pendingLeaves.map((l: any) => (
              <div key={l.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{l.employees?.full_name}</h4>
                    <p className="text-xs text-muted-foreground">{l.employees?.department}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 capitalize">
                    {l.leave_type}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm pt-1">
                  <div>
                    <span className="text-xs text-muted-foreground block">Duration</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {l.start_date} <span className="text-muted-foreground text-xs">to</span> {l.end_date}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Total Days</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{l.days} {l.days === 1 ? 'day' : 'days'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3">
                  <Button size="sm" variant="outline" className="flex-1 border-green-200 text-green-700 hover:bg-green-50" onClick={() => decide(l.id, "approve")}>
                    <Check className="size-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-700 hover:bg-red-50" onClick={() => setRejectionDialog({ open: true, leaveId: l.id })}>
                    <X className="size-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {pendingLeaves.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="size-12 mx-auto mb-3 opacity-20" />
              No leave requests found pending your approval.
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="pl-6 whitespace-nowrap">Employee</TableHead>
                  <TableHead className="whitespace-nowrap">Leave Details</TableHead>
                  <TableHead className="whitespace-nowrap">Duration</TableHead>
                  <TableHead className="whitespace-nowrap">Applied By</TableHead>
                  <TableHead className="whitespace-nowrap">Status & Approver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeaves.map((l: any) => (
                  <TableRow key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <TableCell className="pl-6 font-bold whitespace-nowrap">
                      {l.employees?.full_name}
                      <div className="text-xs text-muted-foreground font-normal">{l.employees?.department}</div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="font-medium">{l.leave_type}</div>
                      <div className="text-xs text-muted-foreground truncate" title={l.reason}>{l.reason || "No reason"}</div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {l.start_date} to {l.end_date}
                      <div className="text-xs font-bold text-muted-foreground">{l.days} {l.days === 1 ? 'day' : 'days'}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm font-medium">{l.employees?.full_name}</div>
                      <div className="text-[10px] text-muted-foreground">Self-Applied</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize whitespace-nowrap ${l.status === 'approved' ? 'bg-green-100 text-green-700' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {l.status || 'pending'}
                      </span>
                      {(l.status === 'approved' || l.status === 'rejected') && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          by <span className="font-bold">{l.approved_by === myUserId ? myName : (l.approved_by?.length > 20 ? 'Manager/Admin' : (l.approved_by || 'Admin'))}</span>
                          <br />on {format(new Date(l.updated_at || l.created_at), 'dd MMM yyyy')}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLeaves.map((l: any) => (
              <div key={l.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{l.employees?.full_name}</h4>
                    <p className="text-xs text-muted-foreground">{l.employees?.department}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize whitespace-nowrap ${l.status === 'approved' ? 'bg-green-100 text-green-700' : l.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {l.status || 'pending'}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Leave Type:</span>
                    <span className="text-xs font-bold">{l.leave_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Duration:</span>
                    <span className="text-xs font-bold">{l.start_date} to {l.end_date} ({l.days}d)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Applied By:</span>
                    <span className="text-xs font-medium">{l.employees?.full_name}</span>
                  </div>
                  {(l.status === 'approved' || l.status === 'rejected') && (
                    <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                      <span className="text-[10px] text-muted-foreground">Processed By:</span>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        {l.approved_by === myUserId ? myName : (l.approved_by?.length > 20 ? 'Manager/Admin' : (l.approved_by || 'Admin'))} on {format(new Date(l.updated_at || l.created_at), 'dd MMM yyyy')}
                      </span>
                    </div>
                  )}
                </div>
                {l.reason && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold block mb-1">Reason:</span>
                    {l.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
          {filteredLeaves.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <History className="size-12 mx-auto mb-3 opacity-20" />
              No leave records found for your team.
            </div>
          )}
        </div>
      )}

      {activeTab === "calendar" && (
        <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="p-4 md:p-6 bg-indigo-50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-indigo-900 dark:text-indigo-100">Team Leave Calendar</h3>
              <p className="text-xs text-indigo-600 dark:text-indigo-300/70 mt-1">Select a date to see who is on leave.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">Select Date:</label>
              <Input 
                type="date" 
                value={calendarDate} 
                onChange={(e) => setCalendarDate(e.target.value)} 
                className="w-auto h-9 bg-white dark:bg-slate-900 shadow-sm"
              />
            </div>
          </div>
          
          <div className="p-4 md:p-6">
            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 border-b pb-2">
              {format(parseISO(calendarDate), "d MMMM yyyy")} — Team Leave
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leavesOnCalendarDate.length === 0 ? (
                <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
                  Everyone is working on this day! No leaves found.
                </div>
              ) : (
                leavesOnCalendarDate.map((l: any) => (
                  <div key={l.id} className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/50 shadow-sm flex items-start gap-4 transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
                    <div className="size-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-lg shrink-0">
                      {l.employees?.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h5 className="font-bold text-slate-900 dark:text-white truncate">{l.employees?.full_name}</h5>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{l.employees?.department}</p>
                      
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border">
                          {l.leave_type}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${l.status === 'approved' ? 'text-green-700 bg-green-100' : l.status === 'rejected' ? 'text-red-700 bg-red-100' : 'text-amber-700 bg-amber-100'}`}>
                          {l.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
