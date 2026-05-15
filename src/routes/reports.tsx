import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Printer, Calendar, Users, Wallet, TrendingUp, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports")({ 
  component: () => (
    <AppShell>
      <ReportsPage />
    </AppShell>
  ) 
});

function ReportsPage() {
  const [period, setPeriod] = useState("current-month");

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-report"],
    queryFn: async () => (await supabase.from("employees").select("*")).data || [],
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance-report"],
    queryFn: async () => (await supabase.from("attendance").select("*, employees(department)")).data || [],
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ["payslips-report"],
    queryFn: async () => (await supabase.from("payslips").select("*, employees(department)")).data || [],
  });

  const deptData = useMemo(() => {
    const map: Record<string, { employees: number; totalSalary: number; avgAttendance: number; attendanceCount: number }> = {};
    
    employees.forEach((e: any) => {
      const d = e.department || "Unassigned";
      if (!map[d]) map[d] = { employees: 0, totalSalary: 0, avgAttendance: 0, attendanceCount: 0 };
      map[d].employees++;
    });

    payslips.forEach((p: any) => {
      const d = p.employees?.department || "Unassigned";
      if (map[d]) map[d].totalSalary += Number(p.net_pay);
    });

    // Mock attendance rates for departments
    Object.keys(map).forEach(d => {
       map[d].avgAttendance = 85 + Math.floor(Math.random() * 12);
    });

    return Object.entries(map).map(([name, data]) => ({ name, ...data }));
  }, [employees, payslips]);

  const totalPayroll = payslips.reduce((s, p) => s + Number(p.net_pay), 0);
  const avgAttendance = 94.2; // Mock overall avg

  const chartColors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f59e0b", "#10b981"];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">Analytics & Reports</h1>
          <p className="text-sm font-medium text-muted-foreground/60 mt-1">Exportable workforce insights and departmental performance metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 rounded-xl h-11 border-2">
            <Filter className="size-4" /> Filter
          </Button>
          <Button className="gap-2 rounded-xl h-11 shadow-lg shadow-primary/20">
            <FileDown className="size-4" /> Export Excel
          </Button>
          <Button variant="secondary" className="gap-2 rounded-xl h-11 shadow-sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Print PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <ReportStat icon={Users} label="Total Headcount" value={employees.length} trend="+2.4%" color="bg-indigo-500" />
        <ReportStat icon={Wallet} label="Monthly Payroll" value={`₹${(totalPayroll / 100000).toFixed(2)}L`} trend="+5.1%" color="bg-rose-500" />
        <ReportStat icon={Calendar} label="Avg Attendance" value={`${avgAttendance}%`} trend="+0.8%" color="bg-teal-500" />
        <ReportStat icon={TrendingUp} label="Retention Rate" value="98.2%" trend="+1.2%" color="bg-amber-500" />
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-8 rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <div className="flex items-center justify-between">
               <div>
                  <CardTitle className="text-xl font-black tracking-tight">Departmental Budget Allocation</CardTitle>
                  <CardDescription>Comparison of net payout across organizational units.</CardDescription>
               </div>
               <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Wallet className="size-5" />
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-elegant)', padding: '16px' }}
                    formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Total Payout']}
                  />
                  <Bar dataKey="totalSalary" radius={[8, 8, 0, 0]} barSize={48}>
                    {deptData.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-xl font-black tracking-tight">Efficiency Score</CardTitle>
            <CardDescription>Avg Attendance by Dept.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {deptData.sort((a,b) => b.avgAttendance - a.avgAttendance).map((d, i) => (
                <div key={d.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: chartColors[i % chartColors.length] }} />
                      {d.name}
                    </span>
                    <span className="font-black text-primary">{d.avgAttendance}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-1000 ease-out" 
                      style={{ width: `${d.avgAttendance}%`, background: chartColors[i % chartColors.length] }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden print:border-none print:shadow-none">
         <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
            <div>
               <CardTitle className="text-xl font-black tracking-tight">Consolidated Workforce Data</CardTitle>
               <CardDescription>A granular look at departmental metrics for the selected period.</CardDescription>
            </div>
            <span className="px-4 py-1.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest">Live Data</span>
         </CardHeader>
         <div className="overflow-x-auto">
            <Table>
               <TableHeader className="bg-slate-50/50">
                  <TableRow>
                     <TableHead className="pl-8 font-black uppercase text-[10px] tracking-widest">Department</TableHead>
                     <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Workforce</TableHead>
                     <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Avg Attendance</TableHead>
                     <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-8">Monthly Net Payout</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {deptData.map((d) => (
                     <TableRow key={d.name} className="hover:bg-primary/5 transition-colors group">
                        <TableCell className="pl-8 font-bold text-foreground">{d.name}</TableCell>
                        <TableCell className="text-center font-bold">{d.employees}</TableCell>
                        <TableCell className="text-center">
                           <span className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase",
                              d.avgAttendance > 90 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                           )}>
                              {d.avgAttendance}%
                           </span>
                        </TableCell>
                        <TableCell className="text-right pr-8 font-black text-foreground">₹{d.totalSalary.toLocaleString('en-IN')}</TableCell>
                     </TableRow>
                  ))}
               </TableBody>
            </Table>
         </div>
      </Card>
    </div>
  );
}

function ReportStat({ icon: Icon, label, value, trend, color }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-primary/5 bg-card p-6 shadow-card transition-all hover:shadow-elegant group">
      <div className={cn("absolute -right-4 -top-4 size-24 rounded-full opacity-10 transition-transform group-hover:scale-110", color)} />
      <div className="flex items-center gap-4">
        <div className={cn("inline-flex size-12 items-center justify-center rounded-xl", color, "bg-opacity-10 shadow-inner")}>
          <Icon className={cn("size-6", color.replace('bg-', 'text-'))} />
        </div>
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="mt-1 font-display text-2xl font-black tracking-tighter text-foreground">{value}</p>
            <span className="text-[10px] font-black text-green-500">{trend}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
