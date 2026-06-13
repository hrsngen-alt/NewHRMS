import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Umbrella, Stethoscope, Palmtree, Home } from "lucide-react";

export function MyLeavesTab({ employeeId }: { employeeId?: string }) {
  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["my-leaves", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leaves" as any)
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data || [];
    },
    enabled: !!employeeId
  });

  const { data: balances = [] } = useQuery({
    queryKey: ["my-leave-balances", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_balances" as any)
        .select("*, leave_types!inner(name, is_paid)")
        .eq("employee_id", employeeId)
        .eq("year", new Date().getFullYear());
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data || [];
    },
    enabled: !!employeeId
  });

  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'sl': return <Stethoscope className="size-5 text-rose-500" />;
      case 'pl': return <Palmtree className="size-5 text-emerald-500" />;
      case 'wfh': return <Home className="size-5 text-indigo-500" />;
      default: return <Umbrella className="size-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Balances */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {balances.length > 0 ? balances.map((b: any) => (
          <Card key={b.id} className="rounded-2xl border-2 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  {getIcon(b.leave_type_code)}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{b.leave_type_code}</p>
                  <p className="font-black text-2xl">{b.balance}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{b.leave_types?.name}</p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full" 
                  style={{ width: `${b.total_allocated > 0 ? (b.used / b.total_allocated) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{b.used} used of {b.total_allocated}</p>
            </CardContent>
          </Card>
        )) : (
          <div className="col-span-full p-6 text-center text-muted-foreground border-2 border-dashed rounded-2xl">
            No leave balances allocated for {new Date().getFullYear()}.
          </div>
        )}
      </div>

      {/* History */}
      <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 border-b">
          <h3 className="font-bold">Leave History</h3>
        </div>
        {/* Desktop View - Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6 whitespace-nowrap">Type</TableHead>
                <TableHead className="whitespace-nowrap">Dates</TableHead>
                <TableHead className="whitespace-nowrap">Days</TableHead>
                <TableHead className="min-w-[150px] whitespace-nowrap">Reason</TableHead>
                <TableHead className="whitespace-nowrap">Manager Status</TableHead>
                <TableHead className="whitespace-nowrap">HR Status</TableHead>
                <TableHead className="pr-6 whitespace-nowrap">Overall Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="pl-6 font-bold whitespace-nowrap">{l.leave_type}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {l.start_date} to {l.end_date}
                  </TableCell>
                  <TableCell className="font-bold whitespace-nowrap">{l.days}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground whitespace-nowrap">{l.reason}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold capitalize whitespace-nowrap ${l.manager_status === 'approved' ? 'bg-green-100 text-green-700' : l.manager_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                      {l.manager_status || 'pending'}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold capitalize whitespace-nowrap ${l.hr_status === 'approved' ? 'bg-green-100 text-green-700' : l.hr_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                      {l.hr_status || 'pending'}
                    </span>
                  </TableCell>
                  <TableCell className="pr-6 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize whitespace-nowrap ${l.status === 'approved' ? 'bg-green-500 text-white' : l.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                      {l.status || 'pending'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View - Stacked Cards List */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {leaves.map((l: any) => (
            <div key={l.id} className="p-4 space-y-3">
              {/* Header: Leave Type & Status */}
              <div className="flex justify-between items-start">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 capitalize">
                  {l.leave_type}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${l.status === 'approved' ? 'bg-green-500 text-white' : l.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                  {l.status || 'pending'}
                </span>
              </div>

              {/* Date & Days */}
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

              {/* Reason */}
              {l.reason && (
                <div className="text-sm pt-1">
                  <span className="text-xs text-muted-foreground block">Reason</span>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5 text-xs line-clamp-2">{l.reason}</p>
                </div>
              )}

              {/* Status Indicators */}
              <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                <div>
                  <span className="text-xs text-muted-foreground block">Manager Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize mt-0.5 ${l.manager_status === 'approved' ? 'bg-green-100 text-green-700' : l.manager_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                    {l.manager_status || 'pending'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">HR Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize mt-0.5 ${l.hr_status === 'approved' ? 'bg-green-100 text-green-700' : l.hr_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                    {l.hr_status || 'pending'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {leaves.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="size-12 mx-auto mb-3 opacity-20" />
            You haven't requested any leaves yet.
          </div>
        )}
      </div>
    </div>
  );
}
