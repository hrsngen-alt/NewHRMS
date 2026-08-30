import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Check, X, Clock, ShieldCheck } from 'lucide-react';

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

  const pendingRequests = requests.filter((r: any) => r.status === 'Pending');
  const pastRequests = requests.filter((r: any) => r.status !== 'Pending');

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <ShieldCheck className="size-8 text-indigo-500" />
            Attendance Approvals
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Review and manage manual check-in/check-out requests.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="size-5 text-amber-500" /> Pending Requests
            <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs">{pendingRequests.length}</span>
          </h2>
          <div className="rounded-2xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
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
        </div>

        <div className="pt-8">
          <h2 className="text-xl font-bold mb-4">Past Requests</h2>
          <div className="rounded-2xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
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
        </div>
      </div>
    </div>
  );
}
