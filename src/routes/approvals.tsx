import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Check, X, Clock, ShieldCheck, Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const Route = createFileRoute('/approvals')({
  component: () => (
    <AppShell>
      <ApprovalsPage />
    </AppShell>
  ),
});

function ApprovalsPage() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [month, setMonth] = useState("all");
  const [date, setDate] = useState("");

  const isManagerOrAdmin = role === 'admin' || role === 'manager' || role === 'hr';

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['manual-attendance-approvals'],
    enabled: isManagerOrAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('manual_attendance_requests')
        .select(`
          *,
          employees (id, full_name, department, reporting_manager)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await (supabase as any).rpc('approve_manual_attendance', {
        request_id: requestId,
        approver_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Request approved and attendance updated.');
      qc.invalidateQueries({ queryKey: ['manual-attendance-approvals'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to approve request.');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await (supabase as any)
        .from('manual_attendance_requests')
        .update({ status: 'Rejected', updated_at: new Date().toISOString(), approved_by: user?.id })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Request rejected.');
      qc.invalidateQueries({ queryKey: ['manual-attendance-approvals'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reject request.');
    }
  });

  if (!isManagerOrAdmin) {
    return <div className="p-8 text-center text-red-500 font-bold">Access Denied. Only Managers and Admins can view this page.</div>;
  }

  const departments = Array.from(new Set(requests.map((r: any) => r.employees?.department).filter(Boolean)));

  const filteredRequests = requests.filter((req: any) => {
    if (search && !req.employees?.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (department !== 'all' && req.employees?.department !== department) return false;
    if (month !== 'all') {
      const reqMonth = new Date(req.request_date).getMonth().toString();
      if (reqMonth !== month) return false;
    }
    if (date && !req.request_date.startsWith(date)) return false;
    return true;
  });

  const pendingRequests = filteredRequests.filter((r: any) => r.status === 'Pending');
  const pastRequests = filteredRequests.filter((r: any) => r.status !== 'Pending');

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-6 border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <ShieldCheck className="size-8 text-indigo-500" />
            Attendance Approvals
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Review and manage manual check-in/check-out requests.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search employee..." 
            className="pl-9 bg-white dark:bg-slate-900 shadow-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="bg-white dark:bg-slate-900 shadow-sm">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d: any) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="bg-white dark:bg-slate-900 shadow-sm">
            <SelectValue placeholder="All Months" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            <SelectItem value="0">January</SelectItem>
            <SelectItem value="1">February</SelectItem>
            <SelectItem value="2">March</SelectItem>
            <SelectItem value="3">April</SelectItem>
            <SelectItem value="4">May</SelectItem>
            <SelectItem value="5">June</SelectItem>
            <SelectItem value="6">July</SelectItem>
            <SelectItem value="7">August</SelectItem>
            <SelectItem value="8">September</SelectItem>
            <SelectItem value="9">October</SelectItem>
            <SelectItem value="10">November</SelectItem>
            <SelectItem value="11">December</SelectItem>
          </SelectContent>
        </Select>
        <Input 
          type="date" 
          className="bg-white dark:bg-slate-900 shadow-sm"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="size-5 text-amber-500" /> Pending Requests
            <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs">{pendingRequests.length}</span>
          </h2>
          <div className="rounded-2xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Requested In</TableHead>
                    <TableHead>Requested Out</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : pendingRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No pending requests.</TableCell></TableRow>
                  ) : (
                    pendingRequests.map((req: any) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="font-bold">{req.employees?.full_name}</div>
                          <div className="text-xs text-muted-foreground">{req.employees?.department}</div>
                          {req.employees?.reporting_manager && (
                            <div className="text-[10px] text-indigo-500 font-semibold uppercase mt-1">Manager: {req.employees?.reporting_manager}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{format(new Date(req.request_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>{req.check_in_time ? format(new Date(req.check_in_time), 'hh:mm a') : '-'}</TableCell>
                        <TableCell>{req.check_out_time ? format(new Date(req.check_out_time), 'hh:mm a') : '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={req.reason}>{req.reason}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="h-8 gap-1"
                              onClick={() => rejectMutation.mutate(req.id)}
                              disabled={rejectMutation.isPending || approveMutation.isPending}
                            >
                              <X className="size-3.5" /> Reject
                            </Button>
                            <Button 
                              size="sm" 
                              className="h-8 gap-1 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => approveMutation.mutate(req.id)}
                              disabled={rejectMutation.isPending || approveMutation.isPending}
                            >
                              <Check className="size-3.5" /> Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Mobile View */}
            <div className="block md:hidden divide-y divide-border">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No pending requests.</div>
              ) : (
                pendingRequests.map((req: any) => (
                  <div key={req.id} className="p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-sm">{req.employees?.full_name}</div>
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase">{req.employees?.department}</div>
                      </div>
                      <div className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wider">Pending</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Date:</span> {format(new Date(req.request_date), 'dd MMM yyyy')}</div>
                      <div><span className="text-muted-foreground">In:</span> {req.check_in_time ? format(new Date(req.check_in_time), 'hh:mm a') : '-'}</div>
                      <div><span className="text-muted-foreground">Out:</span> {req.check_out_time ? format(new Date(req.check_out_time), 'hh:mm a') : '-'}</div>
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border">
                      <span className="font-semibold text-foreground">Reason:</span> {req.reason}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="flex-1 text-red-600 gap-1 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => rejectMutation.mutate(req.id)} disabled={rejectMutation.isPending || approveMutation.isPending}>
                        <X className="size-3.5" /> Reject
                      </Button>
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1" onClick={() => approveMutation.mutate(req.id)} disabled={rejectMutation.isPending || approveMutation.isPending}>
                        <Check className="size-3.5" /> Approve
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="pt-8">
          <h2 className="text-xl font-bold mb-4">Past Requests</h2>
          <div className="rounded-2xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Requested In/Out</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No past requests.</TableCell></TableRow>
                  ) : (
                    pastRequests.map((req: any) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="font-bold">{req.employees?.full_name}</div>
                          <div className="text-xs text-muted-foreground">{req.employees?.department}</div>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{format(new Date(req.request_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            {req.check_in_time ? format(new Date(req.check_in_time), 'hh:mm a') : '-'}
                            {' to '}
                            {req.check_out_time ? format(new Date(req.check_out_time), 'hh:mm a') : '-'}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={req.reason}>{req.reason}</TableCell>
                        <TableCell>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            req.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {req.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Mobile View */}
            <div className="block md:hidden divide-y divide-border">
              {pastRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No past requests.</div>
              ) : (
                pastRequests.map((req: any) => (
                  <div key={req.id} className="p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-sm">{req.employees?.full_name}</div>
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase">{req.employees?.department}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        req.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Date:</span> {format(new Date(req.request_date), 'dd MMM yyyy')}</div>
                      <div><span className="text-muted-foreground">In:</span> {req.check_in_time ? format(new Date(req.check_in_time), 'hh:mm a') : '-'}</div>
                      <div><span className="text-muted-foreground">Out:</span> {req.check_out_time ? format(new Date(req.check_out_time), 'hh:mm a') : '-'}</div>
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border">
                      <span className="font-semibold text-foreground">Reason:</span> {req.reason}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
