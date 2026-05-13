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
import { Clock, Play, Square, Search, Users, Calendar, Activity, CheckCircle2, MapPin, ExternalLink, TrendingUp, ShieldCheck, Plane } from "lucide-react";
import { cn } from "../lib/utils";
import { X } from "lucide-react";

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const Route = createFileRoute("/attendance")({ component: () => <AppShell><AttendancePage /></AppShell> });

function AttendancePage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [q, setQ] = useState("");
  const { myEmployee, isLoading: empLoading } = useMyEmployee();
  const [viewMode, setViewMode] = useState<"date" | "employee" | "summary">("date");
  const [selMonth, setSelMonth] = useState<string>("all");
  const [selYear, setSelYear] = useState<string>("all");

  const isMarketing = myEmployee?.department?.toLowerCase() === "marketing";

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", role, myEmployee?.id],
    queryFn: async () => {
      let q = supabase
        .from("attendance" as any)
        .select("*, employees(full_name, employee_code, department)")
        .order("check_in", { ascending: false });
      
      if (!isAdmin && myEmployee) q = q.eq("employee_id", myEmployee.id).limit(100);
      else q = q.limit(300);
      
      const { data, error } = await q;
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!user && (isAdmin || !!myEmployee),
  });

  useEffect(() => {
    // Subscribe to real-time changes
    const channel = supabase
      .channel('attendance_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'attendance' 
      }, () => {
        console.log("[Attendance] Real-time update detected, refreshing...");
        qc.invalidateQueries({ queryKey: ["attendance"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const today = new Date().toLocaleDateString('en-CA');
  
  const myTodayRecords = useMemo(() => 
    records.filter((r: any) => r.date === today && r.employee_id === myEmployee?.id),
    [records, today, myEmployee?.id]
  );
  
  const latestRecord = myTodayRecords.length > 0 ? myTodayRecords[0] : null;
  const isCheckedIn = !!(latestRecord && !latestRecord.check_out);

  const adminStats = useMemo(() => {
    if (!isAdmin) return null;
    const todayRecords = records.filter((r: any) => r.date === today);
    const active = new Set(todayRecords.filter((r: any) => !r.check_out).map((r: any) => r.employee_id)).size;
    const completed = new Set(todayRecords.filter((r: any) => r.check_out).map((r: any) => r.employee_id)).size;
    return { active, completed };
  }, [records, today, isAdmin]);

  const [elapsed, setElapsed] = useState<string>("00:00:00");

  useEffect(() => {
    let interval: any;
    if (isCheckedIn && latestRecord?.check_in) {
      const updateElapsed = () => {
        const start = new Date(latestRecord.check_in!).getTime();
        const diff = Date.now() - start;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      };
      updateElapsed();
      interval = setInterval(updateElapsed, 1000);
    } else {
      setElapsed("00:00:00");
    }
    return () => clearInterval(interval);
  }, [isCheckedIn, latestRecord?.check_in]);

  const totalToday = useMemo(() => {
    return myTodayRecords.reduce((acc: number, r: any) => {
      if (r.hours_worked) return acc + Number(r.hours_worked);
      if (r.check_in && !r.check_out) {
        const checkInTime = new Date(r.check_in).getTime();
        if (!isNaN(checkInTime)) {
          return acc + (Date.now() - checkInTime) / 3600000;
        }
      }
      return acc;
    }, 0);
  }, [myTodayRecords]);

  const weeklyTotal = useMemo(() => {
    if (!myEmployee) return 0;
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    
    return records
      .filter((r: any) => r.employee_id === myEmployee.id && new Date(r.date) >= startOfWeek)
      .reduce((acc: number, r: any) => acc + (Number(r.hours_worked) || 0), 0);
  }, [records, myEmployee]);

  const filteredRecords = records.filter((r: any) => {
    if (!q) return true;
    const search = q.toLowerCase();
    return (
      r.employees?.full_name?.toLowerCase().includes(search) ||
      r.employees?.employee_code?.toLowerCase().includes(search) ||
      r.date.includes(search)
    );
  });

  const summaryData = useMemo(() => {
    const summary: Record<string, any> = {};
    
    records.forEach((r: any) => {
      const d = new Date(r.date);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      
      const mMatch = selMonth === "all" || String(m) === selMonth;
      const yMatch = selYear === "all" || String(y) === selYear;
      
      if (!mMatch || !yMatch) return;
      
      const key = `${r.employee_id}-${m}-${y}`;
      if (!summary[key]) {
        summary[key] = {
          employee: r.employees,
          month: m,
          year: y,
          days: new Set(),
          hours: 0
        };
      }
      
      summary[key].days.add(r.date);
      summary[key].hours += Number(r.hours_worked || 0);
    });
    
    return Object.values(summary).sort((a: any, b: any) => b.year - a.year || b.month - a.month);
  }, [records, selMonth, selYear]);

  const availableYears = Array.from(new Set(records.map((r: any) => new Date(r.date).getFullYear()))).sort((a: any, b: any) => b - a);

  const [isPunching, setIsPunching] = useState(false);
  const punch = async (type: "in" | "out") => {
    let currentEmployee = myEmployee;

    // Auto-create employee record for admins if missing
    if (!currentEmployee && isAdmin) {
      console.log("[Attendance] Admin has no employee record, creating one...");
      const { data: newEmp, error: createError } = await (supabase.from("employees") as any).insert({
        full_name: user?.user_metadata?.full_name || "System Admin",
        email: user?.email,
        employee_code: "ADMIN-" + Math.random().toString(36).substring(7).toUpperCase(),
        department: "Management",
        user_id: user?.id
      }).select().single();
      
      if (createError) {
        console.error("Failed to auto-create admin employee:", createError);
        return toast.error("Could not link your admin account to an employee profile.");
      }
      currentEmployee = newEmp;
      await qc.invalidateQueries({ queryKey: ["my-employee"] });
    }

    if (!currentEmployee) return toast.error("No employee profile linked.");
    setIsPunching(true);
    
    let lat, lng;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { 
          enableHighAccuracy: true,
          timeout: 10000, // Wait up to 10 seconds for user to click "Allow"
          maximumAge: 0
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {
      console.error("GPS Error:", e);
      setIsPunching(false);
      return toast.error("GPS is mandatory. Please enable location in your browser settings and click 'Allow'.");
    }

    try {
      if (type === "in") {
        const { error } = await (supabase.from("attendance") as any).insert({ 
          employee_id: currentEmployee.id, date: today, check_in: new Date().toISOString(), 
          status: "present", check_in_lat: lat, check_in_lng: lng,
          metadata: isMarketing ? { mode: 'field', zone: 'India-Wide' } : { mode: 'office' }
        });
        if (error) throw error;
        toast.success(isMarketing ? "Field Check-in started!" : "Checked in successfully!");
      } else {
        const start = new Date(latestRecord!.check_in!);
        const hours = Math.max(0, (Date.now() - start.getTime()) / 3_600_000);
        const { error } = await (supabase.from("attendance") as any).update({ 
          check_out: new Date().toISOString(), hours_worked: Number(hours.toFixed(2)),
          check_out_lat: lat, check_out_lng: lng
        }).eq("id", latestRecord!.id);
        if (error) throw error;
        toast.success("Checked out successfully!");
      }
      
      // Force a re-fetch of everything
      await qc.invalidateQueries({ queryKey: ["attendance"] });
      await qc.refetchQueries({ queryKey: ["attendance"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update attendance.");
    } finally {
      setIsPunching(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
           <h1 className="font-display text-4xl font-black tracking-tight text-foreground">Time Tracking</h1>
           {isMarketing && (
             <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-amber-200">
                <Plane className="size-3" /> Field Mode Active
             </span>
           )}
        </div>
        <p className="text-muted-foreground font-medium">Monitor your attendance and session logs across multiple office hubs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isAdmin && adminStats ? (
          <>
            <AttendanceStat icon={Activity} label="Active Sessions" value={adminStats.active} color="bg-indigo-500" />
            <AttendanceStat icon={CheckCircle2} label="Completed Today" value={adminStats.completed} color="bg-teal-500" />
            <AttendanceStat icon={Users} label="Total Records" value={adminStats.active + adminStats.completed} color="bg-primary" />
          </>
        ) : (
          <>
            <AttendanceStat icon={Clock} label="Today's Hours" value={`${totalToday.toFixed(1)}h`} color="bg-indigo-500" />
            <AttendanceStat icon={Calendar} label="Weekly Total" value={`${weeklyTotal.toFixed(1)}h`} color="bg-purple-500" />
            <AttendanceStat icon={Activity} label="Current Session" value={elapsed} color="bg-primary" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <div className="rounded-2xl border bg-card p-8 shadow-card border-b-8 border-b-primary flex flex-col items-center text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <SparklesIcon className="size-20 text-primary" />
            </div>
            
            <div className="size-24 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 relative shadow-inner">
              <Clock className={cn("size-12 text-primary", isCheckedIn && "animate-pulse")} />
              {isCheckedIn && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500 border-2 border-white"></span>
                </span>
              )}
            </div>
            
            <h3 className="text-2xl font-black text-foreground tracking-tight">
              {isCheckedIn ? "Active Session" : "Log In Your Day"}
            </h3>
            <p className="text-sm text-muted-foreground font-medium mt-2 max-w-[200px]">
              {isMarketing ? "Marketing Field-Track enabled. Record your time anywhere in India." : "Punch in to start your working timer."}
            </p>
            
            <div className="w-full my-8 py-6 px-4 glass rounded-2xl border-2 border-primary/10 shadow-inner">
              <div className="text-4xl font-black font-display text-primary tabular-nums tracking-tighter">
                {isCheckedIn ? elapsed : "00:00:00"}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Elapsed Time</p>
            </div>

            {isCheckedIn ? (
              <Button onClick={() => punch("out")} disabled={isPunching} variant="destructive" className="w-full h-14 rounded-xl text-lg font-black gap-3 shadow-lg shadow-red-200">
                <Square className="size-5 fill-current" /> {isPunching ? "Finishing..." : "Finish Session"}
              </Button>
            ) : (
              <Button onClick={() => punch("in")} disabled={isPunching} className="w-full h-14 rounded-xl text-lg font-black gap-3 shadow-lg shadow-indigo-200">
                <Play className="size-5 fill-current" /> {isPunching ? "Starting..." : "Start Session"}
              </Button>
            )}
            
            {latestRecord && (
              <div className="mt-8 w-full pt-8 border-t flex justify-between gap-4">
                <div className="text-left flex-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Clock In</p>
                  <p className="font-black text-lg text-foreground">{new Date(latestRecord.check_in!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="text-left flex-1">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Clock Out</p>
                  <p className="font-black text-lg text-foreground">{latestRecord.check_out ? new Date(latestRecord.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="rounded-2xl border bg-card shadow-card overflow-hidden flex flex-col">
            <div className="bg-muted/20 px-8 py-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                 <h3 className="font-black text-xl tracking-tight">Attendance Records</h3>
                 <div className="flex items-center gap-2 mt-1">
                    <button 
                      onClick={() => setViewMode("date")} 
                      className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md transition-all", viewMode === "date" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}
                    >
                      By Date
                    </button>
                    <button 
                      onClick={() => setViewMode("employee")} 
                      className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md transition-all", viewMode === "employee" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}
                    >
                      By Employee
                    </button>
                    <button 
                      onClick={() => setViewMode("summary")} 
                      className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md transition-all", viewMode === "summary" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}
                    >
                      Summary
                    </button>
                 </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {viewMode === "summary" && (
                  <div className="flex items-center gap-2">
                    <Select value={selMonth} onValueChange={setSelMonth}>
                      <SelectTrigger className="w-[100px] h-9 bg-background shadow-none border-dashed rounded-lg">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Months</SelectItem>
                        {months.map((m, i) => (
                          <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selYear} onValueChange={setSelYear}>
                      <SelectTrigger className="w-[100px] h-9 bg-background shadow-none border-dashed rounded-lg">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {availableYears.map((y: any) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {(selMonth !== "all" || selYear !== "all") && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setSelMonth("all"); setSelYear("all"); }}
                        className="h-9 px-2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                )}
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input 
                    placeholder={isAdmin ? "Search employees..." : "Search by date..."}
                    className="pl-10 h-10 bg-background shadow-none rounded-xl" 
                    value={q} 
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {viewMode === "date" ? (
                Object.entries(
                  filteredRecords.reduce((acc: any, r: any) => {
                    if (!acc[r.date]) acc[r.date] = [];
                    acc[r.date].push(r);
                    return acc;
                  }, {})
                ).sort(([a], [b]) => b.localeCompare(a)).map(([date, dayRecords]: [string, any]) => (
                  <div key={date} className="border-b last:border-0">
                    <div className="bg-slate-50/80 dark:bg-slate-900/80 px-8 py-2 border-y flex items-center justify-between">
                      <span className="text-xs font-black text-primary uppercase tracking-[0.2em]">{new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">{dayRecords.length} Sessions</span>
                    </div>
                    <Table>
                      <TableBody>
                        {Object.entries(
                          dayRecords.reduce((eAcc: any, r: any) => {
                            const key = r.employee_id;
                            if (!eAcc[key]) eAcc[key] = { employee: r.employees, sessions: [], totalHours: 0, breakTime: 0 };
                            eAcc[key].sessions.push(r);
                            eAcc[key].totalHours += Number(r.hours_worked || 0);
                            
                            const sorted = [...eAcc[key].sessions].sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
                            let b = 0;
                            for (let i = 0; i < sorted.length - 1; i++) {
                              if (sorted[i].check_out && sorted[i+1].check_in) {
                                b += Math.max(0, (new Date(sorted[i+1].check_in).getTime() - new Date(sorted[i].check_out).getTime()) / 3600000);
                              }
                            }
                            eAcc[key].breakTime = b;
                            return eAcc;
                          }, {})
                        ).map(([empId, data]: [string, any]) => (
                          <div key={empId} className="border-b last:border-0 p-4 bg-white/50 dark:bg-slate-900/50">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-4">
                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">
                                  {data.employee?.full_name?.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-black text-foreground">{data.employee?.full_name}</p>
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{data.employee?.department} · {data.employee?.employee_code}</p>
                                </div>
                              </div>
                              <div className="text-right flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Break</p>
                                  <p className="font-bold text-sm">{data.breakTime > 0 ? `${data.breakTime.toFixed(2)}h` : "-"}</p>
                                </div>
                                <div className="text-right">
                                  <div className="px-3 py-1 rounded-lg bg-primary text-white text-sm font-black shadow-lg shadow-primary/20">
                                    Total: {data.totalHours.toFixed(2)}h
                                  </div>
                                  <p className="text-[10px] font-black text-muted-foreground uppercase mt-1 text-right">Work Time</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2 ml-14">
                              {data.sessions.map((h: any) => {
                                const isField = (h as any).metadata?.mode === 'field';
                                return (
                                  <div key={h.id} className="flex items-center justify-between py-2 px-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group">
                                    <div className="flex items-center gap-6">
                                      <div className="text-[10px] font-black flex gap-3">
                                        <div className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg flex items-center gap-1.5">
                                          <div className="size-1.5 rounded-full bg-green-500" />
                                          {h.check_in ? new Date(h.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                                        </div>
                                        <div className="px-2 py-1 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg flex items-center gap-1.5">
                                          <div className="size-1.5 rounded-full bg-rose-500" />
                                          {h.check_out ? new Date(h.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                                        </div>
                                      </div>
                                      {(h as any).check_in_lat && (
                                        <a href={`https://www.google.com/maps?q=${(h as any).check_in_lat},${(h as any).check_in_lng}`} target="_blank" rel="noreferrer" className={cn(
                                          "size-7 rounded-lg flex items-center justify-center transition-all",
                                          isField ? "bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white" : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                                        )}>
                                          {isField ? <Plane className="size-3" /> : <MapPin className="size-3" />}
                                        </a>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xs font-black text-foreground">{h.hours_worked ?? 0}h</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))
              ) : viewMode === "employee" ? (
                  Object.entries(
                    filteredRecords.reduce((acc: any, r: any) => {
                      const key = r.employee_id;
                      if (!acc[key]) acc[key] = { employee: r.employees, days: {} };
                      if (!acc[key].days[r.date]) acc[key].days[r.date] = [];
                      acc[key].days[r.date].push(r);
                      return acc;
                    }, {})
                  ).map(([empId, data]: [string, any]) => (
                    <div key={empId} className="border-b last:border-0 p-8 bg-white dark:bg-slate-950">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                          {data.employee?.full_name?.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">{data.employee?.full_name}</h3>
                          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{data.employee?.employee_code} · {data.employee?.department}</p>
                        </div>
                      </div>
                      
                      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                        <Table>
                          <TableHeader className="bg-slate-100/50 dark:bg-slate-800/50">
                            <TableRow className="hover:bg-transparent border-b border-slate-200 dark:border-slate-800">
                              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 py-4">Date</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 py-4">In Time</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 py-4">Out Time</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 py-4">Working</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 py-4">Break</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 py-4">Status</TableHead>
                              <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70 py-4 text-center">Map</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(data.days).sort(([a], [b]) => b.localeCompare(a)).map(([date, sessions]: [string, any]) => {
                              const dayTotal = sessions.reduce((s: number, r: any) => s + Number(r.hours_worked || 0), 0);
                              const sortedSessions = [...sessions].sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
                              
                              const firstIn = sortedSessions[0]?.check_in;
                              const lastOut = sortedSessions[sortedSessions.length - 1]?.check_out;
                              const dayStatus = sortedSessions[sortedSessions.length - 1]?.status;

                              let breakTime = 0;
                              for (let i = 0; i < sortedSessions.length - 1; i++) {
                                if (sortedSessions[i].check_out && sortedSessions[i+1].check_in) {
                                  breakTime += Math.max(0, (new Date(sortedSessions[i+1].check_in).getTime() - new Date(sortedSessions[i].check_out).getTime()) / 3600000);
                                }
                              }

                              return (
                                <TableRow key={date} className="hover:bg-primary/5 border-b border-slate-200 dark:border-slate-800 last:border-0 transition-colors">
                                  <TableCell className="py-4 font-bold text-sm text-foreground">
                                    {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                  </TableCell>
                                  <TableCell className="py-4 text-sm font-medium text-muted-foreground">
                                    {firstIn ? new Date(firstIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </TableCell>
                                  <TableCell className="py-4 text-sm font-medium text-muted-foreground">
                                    {lastOut ? new Date(lastOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                  </TableCell>
                                  <TableCell className="py-4 font-bold text-sm text-indigo-600 dark:text-indigo-400">
                                    {dayTotal.toFixed(1)}h
                                  </TableCell>
                                  <TableCell className="py-4 text-sm text-muted-foreground">
                                    {breakTime > 0 ? `${breakTime.toFixed(1)}h` : '-'}
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <span className={cn(
                                      "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                      dayStatus === 'present' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : 
                                      dayStatus === 'late' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                      "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                    )}>
                                      {dayStatus}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-4 text-center">
                                     {sortedSessions[0]?.check_in_lat ? (
                                       <a 
                                         href={`https://www.google.com/maps?q=${sortedSessions[0].check_in_lat},${sortedSessions[0].check_in_lng}`} 
                                         target="_blank" rel="noreferrer"
                                         className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
                                         title="View on Google Maps"
                                       >
                                         <MapPin className="size-4" />
                                       </a>
                                     ) : "-"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))
                ) : (
                 <Table>
                   <TableHeader className="bg-muted/30">
                     <TableRow>
                       <TableHead className="pl-8 text-[10px] font-black uppercase tracking-widest">Employee</TableHead>
                       <TableHead className="text-[10px] font-black uppercase tracking-widest">Period</TableHead>
                       <TableHead className="text-center text-[10px] font-black uppercase tracking-widest">Days Present</TableHead>
                       <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest">Total Hours</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {summaryData
                       .filter((item: any) => {
                         if (!q) return true;
                         const search = q.toLowerCase();
                         return (
                           item.employee?.full_name?.toLowerCase().includes(search) ||
                           item.employee?.employee_code?.toLowerCase().includes(search)
                         );
                       })
                       .map((item: any, i) => (
                         <TableRow key={i} className="hover:bg-muted/5 transition-colors border-b last:border-0">
                           <TableCell className="pl-8 py-4">
                             <div className="flex items-center gap-3">
                               <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-black">
                                 {item.employee?.full_name?.charAt(0)}
                               </div>
                               <div>
                                 <p className="font-bold text-sm">{item.employee?.full_name}</p>
                                 <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{item.employee?.employee_code}</p>
                               </div>
                             </div>
                           </TableCell>
                           <TableCell className="font-bold text-sm text-foreground">
                             {months[item.month - 1]} {item.year}
                           </TableCell>
                           <TableCell className="text-center">
                             <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-black">
                               {item.days.size} Days
                             </span>
                           </TableCell>
                           <TableCell className="text-right pr-8">
                             <span className="font-black text-foreground text-lg tracking-tight">{item.hours.toFixed(1)}h</span>
                           </TableCell>
                         </TableRow>
                       ))}
                   </TableBody>
                 </Table>
               )}
              {filteredRecords.length === 0 && (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                  <div className="size-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground/30">
                    <Activity className="size-8" />
                  </div>
                  <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No activity found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendanceStat({ icon: Icon, label, value, color }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-card transition-all hover:shadow-elegant group">
      <div className={cn("absolute -right-4 -top-4 size-24 rounded-full opacity-10 transition-transform group-hover:scale-110", color)} />
      <div className="flex items-center gap-4">
        <div className={cn("inline-flex size-12 items-center justify-center rounded-xl", color, "bg-opacity-10")}>
          <Icon className={cn("size-6", color.replace('bg-', 'text-'))} />
        </div>
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
          <p className="mt-1 font-display text-3xl font-black tracking-tighter text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
    </svg>
  );
}
