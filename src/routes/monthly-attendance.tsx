import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { toast } from "sonner";
import { 
  Clock, Play, Square, Search, Users, Calendar, Activity, 
  CheckCircle2, MapPin, ExternalLink, TrendingUp, ShieldCheck, 
  Plane, Sparkles, Timer, Coffee, CheckCircle, XCircle, AlertCircle, X
} from "lucide-react";
import { cn } from "../lib/utils";

const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export const Route = createFileRoute("/monthly-attendance")({ component: () => <AppShell><AttendancePage /></AppShell> });

function AttendancePage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [q, setQ] = useState("");
  const { myEmployee, isLoading: empLoading } = useMyEmployee();
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [viewingEmpId, setViewingEmpId] = useState<string>("");
  const [selMonth, setSelMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selYear, setSelYear] = useState<string>(String(new Date().getFullYear()));

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["employees", "list"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name, employee_code, department").eq("status", "active");
      if (error) return [];
      return data;
    }
  });

  const departments = useMemo(() => Array.from(new Set(allEmployees.map((e: any) => e.department).filter(Boolean))), [allEmployees]);

  const targetEmployeeId = isAdmin ? (selectedEmpId || myEmployee?.id) : myEmployee?.id;
  const targetEmployee = isAdmin ? (allEmployees.find((e: any) => e.id === targetEmployeeId) || myEmployee) : myEmployee;

  const isMarketing = targetEmployee?.department?.toLowerCase() === "marketing";

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", role, myEmployee?.id],
    queryFn: async () => {
      let query = supabase
        .from("attendance" as any)
        .select("*, employees(full_name, employee_code, department)")
        .order("check_in", { ascending: false });
      
      if (!isAdmin && myEmployee) query = query.eq("employee_id", myEmployee.id).limit(200);
      else query = query.limit(500);
      
      const { data, error } = await query;
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!user && (isAdmin || !!myEmployee),
  });

  useEffect(() => {
    const channel = supabase
      .channel('attendance_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        qc.invalidateQueries({ queryKey: ["attendance"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const todayStr = new Date().toLocaleDateString('en-CA');

  const monthlyMetrics = useMemo(() => {
    if (!targetEmployeeId) return null;
    const currentMonth = Number(selMonth === "all" ? new Date().getMonth() + 1 : selMonth);
    const currentYear = Number(selYear === "all" ? new Date().getFullYear() : selYear);

    const monthRecords = records.filter((r: any) => {
      const d = new Date(r.date);
      return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear && r.employee_id === targetEmployeeId;
    });

    const totalProdHours = monthRecords.reduce((acc: number, r: any) => acc + (Number(r.hours_worked) || 0), 0);
    const workingDays = new Set(monthRecords.map((r: any) => r.date)).size;
    
    const punctuality = monthRecords.length > 0 
      ? (monthRecords.filter((r: any) => {
          const checkIn = new Date(r.check_in);
          return checkIn.getHours() < 9 || (checkIn.getHours() === 9 && checkIn.getMinutes() <= 45);
        }).length / monthRecords.length) * 100
      : 100;

    const dailyGroups = monthRecords.reduce((acc: any, r: any) => {
      if (!acc[r.date]) acc[r.date] = [];
      acc[r.date].push(r);
      return acc;
    }, {});

    const dailyStats = Object.entries(dailyGroups).map(([date, sessions]: [string, any]) => {
      const sorted = [...sessions].sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
      const firstIn = new Date(sorted[0].check_in);
      const lastOut = sorted[sorted.length - 1].check_out ? new Date(sorted[sorted.length - 1].check_out) : new Date();
      const availability = (lastOut.getTime() - firstIn.getTime()) / 3600000;
      const production = sessions.reduce((s: number, r: any) => s + (Number(r.hours_worked) || 0), 0);
      return { availability, production };
    });

    const totalAvailHours = dailyStats.reduce((acc, s) => acc + s.availability, 0);
    const totalBreakHours = Math.max(0, totalAvailHours - totalProdHours);
    const breakPercentage = totalAvailHours > 0 ? (totalBreakHours / totalAvailHours) * 100 : 0;

    return { totalProdHours, workingDays, punctuality, totalBreakHours, breakPercentage, totalAvailHours, dailyGroups };
  }, [records, targetEmployeeId, selMonth, selYear]);

  const filteredRecords = records.filter((r: any) => {
    const d = new Date(r.date);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const mMatch = selMonth === "all" || String(m) === selMonth;
    const yMatch = selYear === "all" || String(y) === selYear;
    if (!mMatch || !yMatch) return false;

    if (!q) return r.employee_id === myEmployee?.id;
    const search = q.toLowerCase();
    const matchesSearch = (
      r.employees?.full_name?.toLowerCase().includes(search) ||
      r.employees?.employee_code?.toLowerCase().includes(search) ||
      r.date.includes(search)
    );
    return isAdmin ? matchesSearch : (r.employee_id === myEmployee?.id && matchesSearch);
  });

  const availableYears = Array.from(new Set(records.map((r: any) => new Date(r.date).getFullYear()))).sort((a: any, b: any) => b - a);



  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 p-4 md:p-8">
      {/* Header Section */}
      <div className="space-y-6">
        <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          {isAdmin ? "Team Monthly Attendance" : "My Monthly Attendance"}
        </h1>

        <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900/50 p-6 rounded-3xl border-2 border-slate-50 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            {isAdmin && (
              <div className="relative min-w-[280px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input 
                  placeholder="Search employee name/code..." 
                  className="pl-12 h-12 w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            )}

            {isAdmin && (
              <div className="relative min-w-[240px]">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                  <SelectTrigger className="pl-12 h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold">
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmployees.filter((e: any) => 
                      !q || e.full_name.toLowerCase().includes(q.toLowerCase()) || e.employee_code.toLowerCase().includes(q.toLowerCase())
                    ).map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isAdmin && (
              <div className="relative min-w-[180px]">
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d: any) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

           <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-2 h-12">
             <Calendar className="size-4 text-muted-foreground ml-2" />
             <Select value={selMonth} onValueChange={setSelMonth}>
               <SelectTrigger className="w-[120px] border-none bg-transparent font-bold shadow-none">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {months.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
               </SelectContent>
             </Select>
             <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
             <Select value={selYear} onValueChange={setSelYear}>
               <SelectTrigger className="w-[100px] border-none bg-transparent font-bold shadow-none">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {(availableYears as number[]).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
               </SelectContent>
             </Select>
           </div>

           <Button 
            variant="ghost" 
            onClick={() => { setSelectedEmpId(""); setSelectedDept("all"); setSelMonth(String(new Date().getMonth() + 1)); setQ(""); }}
            className="h-12 px-6 rounded-xl font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
           >
             Clear Filters
           </Button>

            <div className="flex flex-wrap items-center gap-4 ml-auto text-[10px] font-black uppercase tracking-widest text-muted-foreground">
               <span className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-green-500" /> Working Day</span>
               <span className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-amber-500" /> Holiday</span>
               <span className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-slate-400" /> Weekend</span>
               <span className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-rose-500" /> Leave</span>
            </div>
         </div>
      </div>

      {/* Selected Employee Profile Card */}
      {targetEmployee && (
        <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-[32px] p-8 text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
             <Users className="size-32" />
           </div>
           <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200/80">Employee Information</p>
                 <div className="flex items-center gap-4">
                    <div className="size-16 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20">
                       <span className="text-2xl font-black">{targetEmployee.full_name?.charAt(0)}</span>
                    </div>
                    <div>
                       <h2 className="text-3xl font-black tracking-tight">{targetEmployee.full_name}</h2>
                       <div className="flex items-center gap-3 mt-1">
                          <span className="px-3 py-0.5 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest border border-white/10">{targetEmployee.employee_code}</span>
                          <span className="px-3 py-0.5 rounded-full bg-indigo-500/40 text-[10px] font-black uppercase tracking-widest border border-white/10">{targetEmployee.department}</span>
                       </div>
                    </div>
                 </div>
              </div>
              <div className="flex gap-4">
                 <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200/80">Reporting Period</p>
                    <p className="text-xl font-black">{months[Number(selMonth)-1]} {selYear}</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PremiumStatCard 
          label="PROD. HRS FOR CURRENT MONTH"
          value={`${monthlyMetrics?.totalProdHours.toFixed(0) || 0} hrs`}
          subtext={`${monthlyMetrics?.workingDays || 0} working days`}
          icon={TrendingUp}
          color="indigo"
          progress={(monthlyMetrics?.totalProdHours || 0) / 160 * 100}
        />
        <PremiumStatCard 
          label="BEGINNING YOUR DAY FOR MONTH"
          value={`${monthlyMetrics?.punctuality.toFixed(0) || 100}%`}
          subtext={`${monthlyMetrics?.workingDays || 0}/${monthlyMetrics?.workingDays || 0} On time`}
          icon={CheckCircle2}
          color="green"
          progress={monthlyMetrics?.punctuality || 100}
        />
        <PremiumStatCard 
          label="BREAK HOURS FOR CURRENT MONTH"
          value={`${monthlyMetrics?.breakPercentage.toFixed(1) || 0}%`}
          subtext={`(${monthlyMetrics?.totalBreakHours.toFixed(1) || 0}h Total)`}
          icon={Coffee}
          color="amber"
          progress={monthlyMetrics?.breakPercentage || 0}
        />
      </div>



      {/* Summary Table */}
      <div className="rounded-3xl border-2 border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
        <div className="bg-slate-50/50 dark:bg-slate-800/50 px-8 py-4 border-b dark:border-slate-800">
           <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">SUMMARY OF {months[Number(selMonth)-1].toUpperCase()} {selYear}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 divide-x divide-y dark:divide-slate-800">
           <SummaryItem label="Employee Working Days / Total Working Days" value={`${monthlyMetrics?.workingDays || 0}/${monthlyMetrics?.workingDays || 0}`} />
           <SummaryItem label="Leave Days" value="0" />
           <SummaryItem label="Leave to be Considered" value="0" />
           <SummaryItem label="Actual Hours / Expected Hours" value={`${monthlyMetrics?.totalProdHours.toFixed(1) || 0} / ${((monthlyMetrics?.workingDays || 0) * 9).toFixed(1)}`} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 divide-x divide-y dark:divide-slate-800 border-t dark:border-slate-800">
           <SummaryItem label="Total Holidays" value="0" />
           <SummaryItem label="Total Timesheet Hours" value={`${monthlyMetrics?.totalProdHours.toFixed(1) || 0}h`} color="text-indigo-600 dark:text-indigo-400" />
           <SummaryItem label="Project Timesheet Hours" value={`${monthlyMetrics?.totalProdHours.toFixed(1) || 0}h`} color="text-blue-600 dark:text-blue-400" />
           <SummaryItem label="Free Timesheet Hours" value="0h 0m" color="text-rose-600 dark:text-rose-400" />
        </div>
      </div>

      {/* Time Log Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
             <Timer className="size-6 text-indigo-500" /> 
             TIME LOG {targetEmployee && <span className="text-muted-foreground/40 font-normal">: {targetEmployee.full_name.toUpperCase()}</span>}
           </h2>
        </div>

        <div className="rounded-3xl border-2 border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableRow className="hover:bg-transparent border-b-2">
                <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-widest">In-Out Time</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Breaks</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Availability</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Production</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Shift Status</TableHead>
                <TableHead className="pr-8 text-[10px] font-black uppercase tracking-widest text-right">Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyMetrics && (Object.entries(monthlyMetrics.dailyGroups) as [string, any][]).sort(([a], [b]) => b.localeCompare(a)).map(([date, sessions]) => {
                const sorted = [...sessions].sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
                const firstIn = new Date(sorted[0].check_in);
                const lastOut = sorted[sorted.length - 1].check_out ? new Date(sorted[sorted.length - 1].check_out) : null;
                
                const availHours = lastOut ? (lastOut.getTime() - firstIn.getTime()) / 3600000 : 0;
                const prodHours = sessions.reduce((s: number, r: any) => s + (Number(r.hours_worked) || 0), 0);
                const breakHours = Math.max(0, availHours - prodHours);
                
                const isShiftComplete = prodHours >= 8;

                return (
                  <TableRow key={date} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all border-b dark:border-slate-800 last:border-0 group">
                    <TableCell className="pl-8 py-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          {firstIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {lastOut ? lastOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "ACTIVE"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex items-center justify-center gap-2">
                          <Coffee className="size-3 text-amber-500" />
                          <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{formatDuration(breakHours)}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex flex-col gap-0.5">
                         <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{formatDuration(availHours)}</span>
                         <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">TOTAL LOG</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="flex flex-col gap-0.5">
                         <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{formatDuration(prodHours)}</span>
                         <span className={cn("text-[9px] font-black uppercase tracking-tighter", prodHours >= 8 ? "text-green-500" : "text-rose-500")}>
                           {prodHours >= 8 ? "Goal Reached" : `${(8 - prodHours).toFixed(1)}H REMAINING`}
                         </span>
                       </div>
                    </TableCell>
                    <TableCell className="text-center">
                       <div className="inline-flex items-center justify-center px-4 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                          {isShiftComplete ? "YES" : "NO"}
                       </div>
                    </TableCell>
                    <TableCell className="pr-8 text-right">
                        <div className="flex justify-end gap-2">
                          {sorted.map((s, idx) => (
                            <div key={idx} className="flex gap-2 p-1">
                              {s.check_in_lat && (
                                <a href={`https://www.google.com/maps?q=${s.check_in_lat},${s.check_in_lng}`} target="_blank" rel="noreferrer" 
                                   className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-500 hover:text-white flex items-center justify-center transition-all text-indigo-500 border border-slate-100 dark:border-slate-700 shadow-sm"
                                   title={`Check-in Location #${idx+1}`}>
                                  <MapPin className="size-4" />
                                </a>
                              )}
                              {s.check_out_lat && (
                                <a href={`https://www.google.com/maps?q=${s.check_out_lat},${s.check_out_lng}`} target="_blank" rel="noreferrer" 
                                   className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all text-rose-500 border border-slate-100 dark:border-slate-700 shadow-sm"
                                   title={`Check-out Location #${idx+1}`}>
                                  <MapPin className="size-4" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!monthlyMetrics || Object.keys(monthlyMetrics.dailyGroups).length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="size-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300">
                        <AlertCircle className="size-8" />
                      </div>
                      <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No records for this period</p>
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

function PremiumStatCard({ label, value, subtext, icon: Icon, color, progress }: any) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-500 to-blue-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/5 shadow-indigo-100 dark:shadow-none",
    green: "from-green-500 to-teal-600 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/5 shadow-green-100 dark:shadow-none",
    amber: "from-amber-500 to-orange-600 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/5 shadow-amber-100 dark:shadow-none",
  };

  return (
    <div className={cn("rounded-[32px] p-8 bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 shadow-xl dark:shadow-none transition-all hover:shadow-2xl dark:hover:bg-slate-800/50 hover:-translate-y-1 group relative overflow-hidden", colors[color].split(' ').slice(4).join(' '))}>
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-all group-hover:scale-110">
        <Icon className="size-20" />
      </div>
      <div className="relative z-10 space-y-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">{label}</p>
        <div>
          <h3 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white group-hover:text-primary transition-colors">{value}</h3>
          <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
            {subtext}
          </p>
        </div>
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all duration-1000 bg-gradient-to-r", colors[color].split(' ').slice(0, 2).join(' '))}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-6 flex flex-col gap-1">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className={cn("text-lg font-black tracking-tight", color || "text-slate-900 dark:text-white")}>{value}</p>
    </div>
  );
}

function formatDuration(hours: number) {
  const h = Math.floor(hours);
  const m = Math.floor((hours % 1) * 60);
  return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
}
