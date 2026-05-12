import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { toast } from "sonner";
import { Clock, Play, Square, Search, Users, Calendar, Activity, CheckCircle2, MapPin, ExternalLink, TrendingUp, ShieldCheck, Plane } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/attendance")({ component: () => <AppShell><AttendancePage /></AppShell> });

function AttendancePage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [q, setQ] = useState("");
  const { myEmployee, isLoading: empLoading } = useMyEmployee();

  const isMarketing = myEmployee?.department?.toLowerCase() === "marketing";

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", role, myEmployee?.id],
    queryFn: async () => {
      let q = supabase.from("attendance" as any).select("*, employees(full_name, employee_code, department)").order("date", { ascending: false });
      if (!isAdmin && myEmployee) q = q.eq("employee_id", myEmployee.id).limit(100);
      else q = q.limit(300);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!user && (isAdmin || !!myEmployee),
  });

  const today = new Date().toLocaleDateString('en-CA');
  
  const myTodayRecords = records.filter((r: any) => r.date === today && r.employee_id === myEmployee?.id);
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

  const totalToday = myTodayRecords.reduce((acc: number, r: any) => {
    if (r.hours_worked) return acc + Number(r.hours_worked);
    if (r.check_in && !r.check_out) {
      return acc + (Date.now() - new Date(r.check_in).getTime()) / 3600000;
    }
    return acc;
  }, 0);

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

  const [isPunching, setIsPunching] = useState(false);
  const punch = async (type: "in" | "out") => {
    if (!myEmployee) return toast.error("No employee profile linked.");
    setIsPunching(true);
    
    let lat, lng;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { 
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {
      if (!isMarketing) {
        setIsPunching(false);
        return toast.error("Location access is required for office check-ins.");
      }
      toast.warning("Field check-in: Location captured as approximate.");
    }

    try {
      if (type === "in") {
        const { error } = await (supabase.from("attendance") as any).insert({ 
          employee_id: myEmployee.id, date: today, check_in: new Date().toISOString(), 
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
            <div className="bg-muted/20 px-8 py-6 border-b flex items-center justify-between gap-4">
              <div>
                 <h3 className="font-black text-xl tracking-tight">Activity Log</h3>
                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Historical Session Data</p>
              </div>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="pl-8 font-black uppercase text-[10px] tracking-widest">Date</TableHead>
                    {isAdmin && <TableHead className="font-black uppercase text-[10px] tracking-widest">Employee</TableHead>}
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Punches</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Location</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-8">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((h: any) => {
                    const isField = (h as any).metadata?.mode === 'field';
                    return (
                      <TableRow key={h.id} className="hover:bg-primary/5 transition-colors group">
                        <TableCell className="font-black pl-8">{h.date}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex flex-col">
                              <p className="font-bold text-sm text-foreground">{h.employees?.full_name}</p>
                              <p className="text-[10px] font-black text-primary uppercase tracking-widest">{h.employees?.department}</p>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="text-[10px] font-black flex gap-3">
                            <div className="px-2 py-1 bg-green-50 text-green-700 rounded-lg">IN: {h.check_in ? new Date(h.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}</div>
                            <div className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg">OUT: {h.check_out ? new Date(h.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(h as any).check_in_lat && (
                              <a href={`https://www.google.com/maps?q=${(h as any).check_in_lat},${(h as any).check_in_lng}`} target="_blank" rel="noreferrer" className={cn(
                                "size-8 rounded-lg flex items-center justify-center transition-all shadow-sm",
                                isField ? "bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white" : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                              )}>
                                {isField ? <Plane className="size-4" /> : <MapPin className="size-4" />}
                              </a>
                            )}
                            {isField && <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">Field</span>}
                            {!(h as any).check_in_lat && <span className="text-[10px] font-bold text-muted-foreground italic">No GPS</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                           <span className="inline-flex items-center gap-1.5 font-black text-foreground">
                              {h.hours_worked ?? 0}h
                              {h.hours_worked && h.hours_worked > 8 && <TrendingUp className="size-3 text-green-500" />}
                           </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
