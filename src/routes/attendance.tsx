import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { toast } from "sonner";
import { 
  Clock, Play, Square, Search, Users, Calendar, Activity, 
  CheckCircle2, MapPin, ExternalLink, TrendingUp, ShieldCheck, 
  Plane, Sparkles, Timer, Coffee, CheckCircle, XCircle, AlertCircle, X
} from "lucide-react";
import { cn, getDeviceInfo, fetchAddress } from "../lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export const Route = createFileRoute("/attendance")({ component: () => <AppShell><AttendancePage /></AppShell> });

function AttendancePage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [q, setQ] = useState("");
  const { myEmployee } = useMyEmployee();
  const [selMonth, setSelMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selYear, setSelYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string | null>(null);
  const [isPunching, setIsPunching] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", role, myEmployee?.id],
    queryFn: async () => {
      const { data: res, error } = await supabase.functions.invoke(
        `attendance-cached?role=${role || "employee"}&employee_id=${myEmployee?.id || ""}`,
        { method: "GET" }
      );
      if (error) throw error;
      if (!res) return [];
      const finalData = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      return (finalData as any[]) || [];
    },
    enabled: !!user && (isAdmin || !!myEmployee),
  });

  const { data: dbHolidays = [] } = useQuery({
    queryKey: ["holidays-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays" as any)
        .select("*");
      if (error) return [];
      return data || [];
    }
  });

  const { data: dbLeaves = [] } = useQuery({
    queryKey: ["leaves-all", myEmployee?.id],
    enabled: !!myEmployee?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaves")
        .select("*")
        .eq("employee_id", myEmployee.id);
      if (error) return [];
      return (data || []).filter((l: any) => l.status?.toLowerCase() === "approved");
    }
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
  const myTodayRecords = useMemo(() => 
    records.filter((r: any) => r.date === todayStr && r.employee_id === myEmployee?.id),
    [records, todayStr, myEmployee?.id]
  );
  
  const latestRecord = myTodayRecords.length > 0 ? myTodayRecords[0] : null;
  const isCheckedIn = !!(latestRecord && !latestRecord.check_out);

  const [elapsed, setElapsed] = useState<string>("00:00:00");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    let interval: any;
    if (isCheckedIn && latestRecord?.check_in) {
      const updateElapsed = () => {
        const start = new Date(latestRecord.check_in!).getTime();
        const diff = Date.now() - start;
        setElapsedSeconds(Math.floor(diff / 1000));
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      };
      updateElapsed();
      interval = setInterval(updateElapsed, 1000);
    } else {
      setElapsed("00:00:00");
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isCheckedIn, latestRecord?.check_in]);

  const monthlyMetrics = useMemo(() => {
    if (!myEmployee) return null;
    const currentMonth = Number(selMonth === "all" ? new Date().getMonth() + 1 : selMonth);
    const currentYear = Number(selYear === "all" ? new Date().getFullYear() : selYear);

    const monthRecords = records.filter((r: any) => {
      const d = new Date(r.date);
      return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear && r.employee_id === myEmployee.id;
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
  }, [records, myEmployee, selMonth, selYear]);

  // Generate all days for the selected month/year and determine status
  const dayStatuses = useMemo(() => {
    if (!myEmployee?.id) return [];
    
    const isAllMonths = selMonth === "all";
    const isAllYears = selYear === "all";
    
    if (isAllMonths || isAllYears) {
      // Fallback: only list dates that actually have records
      const dailyGroups = monthlyMetrics?.dailyGroups || {};
      const dates = Object.keys(dailyGroups).sort((a, b) => b.localeCompare(a));
      return dates.map((dateStr) => {
        const sessions = dailyGroups[dateStr];
        return {
          dateStr,
          type: "present" as const,
          details: "",
          sessions
        };
      });
    }
    
    const currentMonth = Number(selMonth);
    const currentYear = Number(selYear);
    
    const today = new Date();
    const isCurrentMonthYear = today.getMonth() + 1 === currentMonth && today.getFullYear() === currentYear;
    
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const maxDay = isCurrentMonthYear ? today.getDate() : totalDaysInMonth;
    
    const daysList = [];
    for (let d = 1; d <= maxDay; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysList.push(dateStr);
    }
    
    daysList.sort((a, b) => b.localeCompare(a));
    
    return daysList.map((dateStr) => {
      const sessions = monthlyMetrics?.dailyGroups[dateStr];
      const hasPunch = !!sessions;
      
      const holiday = dbHolidays.find((h: any) => h.date === dateStr) as any;
      
      const dObj = new Date(dateStr);
      const dayOfWeek = dObj.getDay();
      const isWeekend = dayOfWeek === 0; // Only Sunday
      
      const leave = dbLeaves.find((l: any) => {
        const start = l.start_date;
        const end = l.end_date;
        return dateStr >= start && dateStr <= end;
      });
      
      let type: "present" | "holiday" | "weekend" | "leave" | "absent" = "absent";
      let details = "";
      
      if (hasPunch) {
        type = "present";
      } else if (holiday) {
        type = "holiday";
        details = holiday.name || "Public Holiday";
      } else if (isWeekend) {
        type = "weekend";
        details = "Sunday";
      } else if (leave) {
        type = "leave";
        details = `Approved Leave (${leave.leave_type || "General"})`;
      } else {
        type = "absent";
        details = "Leave to be Considered";
      }
      
      return {
        dateStr,
        type,
        details,
        sessions
      };
    });
  }, [myEmployee?.id, selMonth, selYear, monthlyMetrics, dbHolidays, dbLeaves]);

  const summaryStats = useMemo(() => {
    let workingDays = 0;
    let leaveDays = 0;
    let leaveToConsider = 0;
    let totalHolidays = 0;
    
    dayStatuses.forEach((day) => {
      if (day.type === "present") {
        workingDays++;
      } else if (day.type === "leave") {
        leaveDays++;
      } else if (day.type === "absent") {
        leaveToConsider++;
      } else if (day.type === "holiday") {
        totalHolidays++;
      }
    });
    
    const expectedWorkingDays = workingDays + leaveDays + leaveToConsider;
    
    return {
      workingDays,
      leaveDays,
      leaveToConsider,
      totalHolidays,
      expectedWorkingDays
    };
  }, [dayStatuses]);

  const availableYears = Array.from(new Set(records.map((r: any) => new Date(r.date).getFullYear()))).sort((a: any, b: any) => b - a);
  const isMarketing = myEmployee?.department?.toLowerCase() === "marketing";

  const punch = async (type: "in" | "out") => {
    if (!myEmployee) return toast.error("No employee profile linked.");
    if (myEmployee.status === "Terminated") {
      return toast.error("Terminated employees cannot perform attendance actions.");
    }
    if (myEmployee.status === "Resigned") {
      return toast.error("Resigned employees cannot perform attendance actions.");
    }
    
    setIsPunching(true);
    let lat, lng;
    try {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, { 
            enableHighAccuracy: true, 
            timeout: 10000,
            maximumAge: 0
          });
        }).catch(async (e) => {
          if (e.code === 1) throw e;
          return await new Promise<GeolocationPosition>((res2, rej2) => {
            navigator.geolocation.getCurrentPosition(res2, rej2, { 
              enableHighAccuracy: false, 
              timeout: 10000,
              maximumAge: 0
            });
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } else {
        throw new Error("Geolocation not supported");
      }
    } catch (e: any) {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
          lat = data.latitude;
          lng = data.longitude;
          toast.info("Using approximate network location.");
        } else {
          throw new Error("IP Geolocation failed");
        }
      } catch (ipError) {
        let msg = "Location access is mandatory for attendance tracking.";
        if (e?.code === 1) msg = "Permission denied. Please allow location access in your browser/device settings.";
        
        if (type === "in") {
          return toast.error(msg);
        } else {
          toast.warning("Check-out location could not be fetched, proceeding with check-out.");
        }
      }
    }

    try {
      // 1. Fetch policies to resolve the rules
      const { data: policies } = await supabase
        .from("attendance_policies")
        .select("*");
      
      const policiesList = (policies as any[]) || [];
      const resolvedPolicy = policiesList.find((p: any) => p.id === myEmployee.attendance_policy_id)
        || policiesList.find((p: any) => p.name?.toLowerCase() === myEmployee.department?.toLowerCase())
        || policiesList.find((p: any) => p.name?.toLowerCase() === "inhouse");
      
      const isAutoCheckout = resolvedPolicy?.auto_checkout_enabled ?? false;
      const policyMinutes = resolvedPolicy?.auto_checkout_after_minutes ?? 120;

      // 2. Fetch address and device info
      let address = "";
      if (lat && lng) {
        address = await fetchAddress(lat, lng);
      }
      const deviceInfo = getDeviceInfo();

      if (type === "in") {
        // Enforce single check-in constraint for non-auto-checkout policies (e.g. Inhouse)
        if (!isAutoCheckout && latestRecord) {
          return toast.error("You have already completed your attendance session for today.");
        }

        // Insert check-in record
        await (supabase.from("attendance") as any).insert({ 
          employee_id: myEmployee?.id, 
          date: todayStr, 
          check_in: new Date().toISOString(), 
          status: "present", 
          check_in_lat: lat || null, 
          check_in_lng: lng || null,
          check_in_address: address || null,
          employee_name: myEmployee.full_name,
          department: myEmployee.department || "Staff",
          check_out_type: "Manual",
          metadata: { mode: isMarketing ? 'field' : 'office', deviceInfo }
        });

        await supabase.functions.invoke("attendance-cached", {
          method: "POST",
          body: { employee_id: myEmployee?.id }
        });
        toast.success("Shift started!");
      } else {
        const start = new Date(latestRecord!.check_in!);
        const diffMs = Date.now() - start.getTime();
        const diffMins = diffMs / 60000;

        if (isAutoCheckout && diffMins >= policyMinutes) {
          // Closed automatically at duration limit
          const hours = policyMinutes / 60.0;
          await (supabase.from("attendance") as any).update({ 
            check_out: new Date(start.getTime() + policyMinutes * 60000).toISOString(), 
            hours_worked: Number(hours.toFixed(2)),
            check_out_lat: lat || null, 
            check_out_lng: lng || null,
            check_out_address: address || null,
            check_out_type: "Automatic"
          }).eq("id", latestRecord!.id);
          toast.success("Shift closed automatically after 2 hours limit.");
        } else {
          // Normal manual check-out
          const hours = Math.max(0, diffMs / 3_600_000);
          await (supabase.from("attendance") as any).update({ 
            check_out: new Date().toISOString(), 
            hours_worked: Number(hours.toFixed(2)),
            check_out_lat: lat || null, 
            check_out_lng: lng || null,
            check_out_address: address || null,
            check_out_type: "Manual"
          }).eq("id", latestRecord!.id);
          toast.success("Shift ended!");
        }

        await supabase.functions.invoke("attendance-cached", {
          method: "POST",
          body: { employee_id: myEmployee?.id }
        });
      }
      qc.invalidateQueries({ queryKey: ["my-attendance-today"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: any) {
      toast.error("Failed to update attendance.");
    } finally {
      setIsPunching(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <h1 className="font-display text-5xl font-black tracking-tight text-foreground">My Attendance</h1>
             {isMarketing && (
               <span className="px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border border-amber-200/50 shadow-sm">
                  <Plane className="size-3" /> Field Mode
               </span>
             )}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xl font-black text-green-500 flex items-center gap-2">
              Today's Production <span className="tabular-nums">{isCheckedIn ? elapsed : "00:00:00"} hrs</span>
            </p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              Regular Shift Timings <span className="text-foreground">09:30 AM ↔ 07:00 PM</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <Select value={selMonth} onValueChange={setSelMonth}>
             <SelectTrigger className="w-[140px] h-12 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-bold shadow-sm">
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Months</SelectItem>
               {months.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
             </SelectContent>
           </Select>
           <Select value={selYear} onValueChange={setSelYear}>
             <SelectTrigger className="w-[110px] h-12 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-bold shadow-sm">
               <SelectValue />
             </SelectTrigger>
               <SelectContent>
               <SelectItem value="all">All Years</SelectItem>
               {(availableYears as number[]).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
             </SelectContent>
           </Select>
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input 
                placeholder="Search logs..." 
                className="pl-12 h-12 w-[240px] bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-medium shadow-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
           </div>
        </div>
      </div>

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

      {/* Punch Controls */}
      {selMonth === String(new Date().getMonth() + 1) && (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-transparent flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm dark:shadow-2xl dark:shadow-indigo-500/20 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 dark:from-indigo-500/10 to-transparent opacity-50" />
          <div className="relative z-10 flex items-center gap-6">
            <div className={cn("size-20 rounded-2xl flex items-center justify-center border-2 border-slate-100 dark:border-white/10", isCheckedIn ? "bg-green-500" : "bg-indigo-500 shadow-lg shadow-indigo-500/40")}>
              <Clock className={cn("size-10 text-white", isCheckedIn && "animate-pulse")} />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{isCheckedIn ? "You are currently Clocked In" : "Ready to start your day?"}</h3>
              <p className="text-slate-500 dark:text-indigo-200/70 font-medium">Capture your location and start your work timer.</p>
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-4 w-full md:w-auto">
            {isCheckedIn ? (
              <Button 
                onClick={() => punch("out")} 
                size="lg" 
                variant="destructive" 
                disabled={isPunching}
                className="h-16 px-10 rounded-2xl text-lg font-black gap-3 shadow-xl shadow-red-500/40 w-full md:w-auto"
              >
                {isPunching ? <div className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Square className="size-6 fill-current" />}
                {isPunching ? "Checking out..." : "End Shift"}
              </Button>
            ) : (
              <Button 
                onClick={() => punch("in")} 
                size="lg" 
                disabled={isPunching}
                className="h-16 px-10 rounded-2xl text-lg font-black gap-3 shadow-xl shadow-indigo-500/40 bg-indigo-500 hover:bg-indigo-600 w-full md:w-auto"
              >
                {isPunching ? <div className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Play className="size-6 fill-current" />}
                {isPunching ? "Checking in..." : "Check In"}
              </Button>
            )}
          </div>        </div>
      )}

      {/* Summary Table */}
      {!(selMonth === "all" || selYear === "all") && (
        <div className="rounded-3xl border-2 border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          <div className="bg-slate-50/50 dark:bg-slate-800/50 px-8 py-4 border-b dark:border-slate-800">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">SUMMARY OF {months[Number(selMonth)-1]?.toUpperCase()} {selYear}</h3>
           </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 divide-x divide-y dark:divide-slate-800">
             <SummaryItem 
               label="Employee Working Days / Total Working Days" 
               value={`${summaryStats.workingDays}/${summaryStats.expectedWorkingDays - summaryStats.leaveDays}`} 
             />
             <SummaryItem label="Leave Days" value={String(summaryStats.leaveDays)} />
             <SummaryItem label="Leave to be Considered" value={String(summaryStats.leaveToConsider)} color="text-red-500" />
             <SummaryItem 
               label="Actual Hours / Expected Hours" 
               value={`${monthlyMetrics?.totalProdHours.toFixed(1) || 0} / ${((summaryStats.expectedWorkingDays - summaryStats.leaveDays) * 9).toFixed(1)}`} 
             />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 divide-x divide-y dark:divide-slate-800 border-t dark:border-slate-800">
             <SummaryItem label="Total Holidays" value={String(summaryStats.totalHolidays)} />
             <SummaryItem label="Total Timesheet Hours" value={`${monthlyMetrics?.totalProdHours.toFixed(1) || 0}h`} color="text-indigo-600 dark:text-indigo-400" />
             <SummaryItem label="Project Timesheet Hours" value={`${monthlyMetrics?.totalProdHours.toFixed(1) || 0}h`} color="text-blue-600 dark:text-blue-400" />
             <SummaryItem label="Free Timesheet Hours" value="0h 0m" color="text-rose-600 dark:text-rose-400" />
          </div>
        </div>
      )}

      {/* Time Log */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Timer className="size-6 text-indigo-500" />
            <span>Time</span>
            <span className="text-indigo-600 dark:text-indigo-400">Log</span>
          </h2>
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-green-500" /> Working Day</span>
            <span className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-amber-500" /> Holiday</span>
            <span className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-slate-400" /> Weekend</span>
            <span className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-rose-500" /> Leave</span>
            <span className="flex items-center gap-1.5"><div className="size-2 rounded-full bg-red-500 animate-pulse" /> Leave to be Considered</span>
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block rounded-3xl border-2 border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableRow className="hover:bg-transparent border-b-2">
                <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-widest">In-Out Time</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Breaks</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Availability</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Production</TableHead>
                <TableHead className="pr-8 text-[10px] font-black uppercase tracking-widest text-right">Shift Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayStatuses.map((day) => {
                const { dateStr, type, details, sessions } = day;
                
                if (type === "present" && sessions) {
                  const sorted = [...sessions].sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
                  const firstIn = new Date(sorted[0].check_in);
                  const lastOut = sorted[sorted.length - 1].check_out ? new Date(sorted[sorted.length - 1].check_out) : null;
                  
                  const availHours = lastOut ? (lastOut.getTime() - firstIn.getTime()) / 3600000 : 0;
                  const prodHours = sessions.reduce((s: number, r: any) => s + (Number(r.hours_worked) || 0), 0);
                  const breakHours = Math.max(0, availHours - prodHours);
                  
                  const isShiftComplete = prodHours >= 8;

                  return (
                    <TableRow 
                      key={dateStr} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all border-b dark:border-slate-800 last:border-0 group cursor-pointer"
                      onClick={() => {
                        setSelectedTimelineDate(dateStr);
                        setIsTimelineOpen(true);
                      }}
                    >
                      <TableCell className="pl-8 py-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                            {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            <span className="size-2 rounded-full bg-green-500 shrink-0" />
                          </span>
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            {firstIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} — {lastOut ? lastOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "ACTIVE"}
                          </span>
                          {sorted[0]?.check_in_address ? (
                            <span className="text-[9px] font-semibold text-muted-foreground/70 truncate max-w-[200px]" title={sorted[0].check_in_address}>
                              In: {sorted[0].check_in_address}
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold text-muted-foreground/70 truncate max-w-[200px]" title="Location Unavailable">
                              In: Location Unavailable
                            </span>
                          )}
                          {lastOut && (
                            <span className="text-[9px] font-semibold text-muted-foreground/70 truncate max-w-[200px]" title={sorted[sorted.length - 1]?.check_out_address || "System Generated"}>
                              Out: {sorted[sorted.length - 1].check_out_address || (sorted[sorted.length - 1].check_out_type === 'Manual' ? "Location Unavailable" : "System Generated (Auto)")}
                            </span>
                          )}
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
                      <TableCell className="pr-8 text-right">
                         <div className="inline-flex items-center justify-center px-4 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                            {isShiftComplete ? "YES" : "NO"}
                         </div>
                      </TableCell>
                    </TableRow>
                  );
                } else {
                  let statusBg = "";
                  let statusTextClass = "";
                  let statusDot = "";
                  
                  if (type === "holiday") {
                    statusBg = "bg-amber-50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/10";
                    statusTextClass = "text-amber-600 dark:text-amber-400";
                    statusDot = "bg-amber-500";
                  } else if (type === "weekend") {
                    statusBg = "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/50";
                    statusTextClass = "text-slate-500 dark:text-slate-400";
                    statusDot = "bg-slate-400";
                  } else if (type === "leave") {
                    statusBg = "bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/10";
                    statusTextClass = "text-rose-600 dark:text-rose-400";
                    statusDot = "bg-rose-500";
                  } else {
                    statusBg = "bg-red-50 dark:bg-red-500/5 border-red-100 dark:border-red-500/10";
                    statusTextClass = "text-red-600 dark:text-red-400";
                    statusDot = "bg-red-500 animate-pulse";
                  }

                  return (
                    <TableRow 
                      key={dateStr} 
                      className="border-b dark:border-slate-800 last:border-0 hover:bg-transparent"
                    >
                      <TableCell className="pl-8 py-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                            {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            <span className={cn("size-2 rounded-full shrink-0", statusDot)} />
                          </span>
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                            No Clock In
                          </span>
                        </div>
                      </TableCell>
                      <TableCell colSpan={4} className="pr-8 text-right">
                        <div className={cn("inline-flex items-center px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-wider", statusBg, statusTextClass)}>
                          {details}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }
              })}
              {dayStatuses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-20 text-center">
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

        {/* Mobile View */}
        <div className="block md:hidden space-y-4">
          {dayStatuses.map((day) => {
            const { dateStr, type, details, sessions } = day;

            if (type === "present" && sessions) {
              const sorted = [...sessions].sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
              const firstIn = new Date(sorted[0].check_in);
              const lastOut = sorted[sorted.length - 1].check_out ? new Date(sorted[sorted.length - 1].check_out) : null;

              const availHours = lastOut ? (lastOut.getTime() - firstIn.getTime()) / 3600000 : 0;
              const prodHours = sessions.reduce((s: number, r: any) => s + (Number(r.hours_worked) || 0), 0);
              const breakHours = Math.max(0, availHours - prodHours);
              const remaining = Math.max(0, 8 - prodHours);
              const isShiftComplete = prodHours >= 8;

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    setSelectedTimelineDate(dateStr);
                    setIsTimelineOpen(true);
                  }}
                  className="bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 rounded-3xl p-6 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-[0.98] space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="size-2 rounded-full bg-green-500 shrink-0" />
                      </h4>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        {firstIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} — {lastOut ? lastOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "ACTIVE"}
                      </p>
                      {sorted[0]?.check_in_address ? (
                        <p className="text-[9px] font-semibold text-muted-foreground/70 truncate max-w-[180px]">
                          In: {sorted[0].check_in_address}
                        </p>
                      ) : (
                        <p className="text-[9px] font-semibold text-muted-foreground/70 truncate max-w-[180px]">
                          In: Location Unavailable
                        </p>
                      )}
                      {lastOut && (
                        <p className="text-[9px] font-semibold text-muted-foreground/70 truncate max-w-[180px]">
                          Out: {sorted[sorted.length - 1].check_out_address || (sorted[sorted.length - 1].check_out_type === 'Manual' ? "Location Unavailable" : "System Generated (Auto)")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-[9px] uppercase tracking-widest">
                        Shift Complete: {isShiftComplete ? "YES" : "NO"}
                      </div>
                      <span className={cn("text-[9px] font-black uppercase tracking-tighter px-2.5 py-0.5 rounded-full", isShiftComplete ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400")}>
                        {isShiftComplete ? "Goal Reached" : `${remaining.toFixed(1)}H REMAINING`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t dark:border-slate-800 text-center">
                    <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/30">
                      <Coffee className="size-3.5 text-amber-500 mb-1" />
                      <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">{formatDuration(breakHours)}</span>
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter mt-0.5">Breaks</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20">
                      <Clock className="size-3.5 text-indigo-500 mb-1" />
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{formatDuration(availHours)}</span>
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter mt-0.5">Total Log</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/30">
                      <Timer className="size-3.5 text-emerald-500 mb-1" />
                      <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">{formatDuration(prodHours)}</span>
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter mt-0.5">Production</span>
                    </div>
                  </div>
                </div>
              );
            } else {
              let statusBg = "";
              let statusTextClass = "";
              let statusDot = "";

              if (type === "holiday") {
                statusBg = "bg-amber-50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/10";
                statusTextClass = "text-amber-600 dark:text-amber-400";
                statusDot = "bg-amber-500";
              } else if (type === "weekend") {
                statusBg = "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/50";
                statusTextClass = "text-slate-500 dark:text-slate-400";
                statusDot = "bg-slate-400";
              } else if (type === "leave") {
                statusBg = "bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/10";
                statusTextClass = "text-rose-600 dark:text-rose-400";
                statusDot = "bg-rose-500";
              } else {
                statusBg = "bg-red-50 dark:bg-red-500/5 border-red-100 dark:border-red-500/10";
                statusTextClass = "text-red-600 dark:text-red-400";
                statusDot = "bg-red-500 animate-pulse";
              }

              return (
                <div
                  key={dateStr}
                  className="bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      <span className={cn("size-2 rounded-full shrink-0", statusDot)} />
                    </h4>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      No Clock In
                    </p>
                  </div>
                  <div className={cn("inline-flex items-center px-3 py-1.5 rounded-2xl border text-[10px] font-black uppercase tracking-wider", statusBg, statusTextClass)}>
                    {details}
                  </div>
                </div>
              );
            }
          })}

          {/* Empty State */}
          {dayStatuses.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 rounded-3xl p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="size-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto">
                  <AlertCircle className="size-8" />
                </div>
                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No records for this period</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Sheet open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
        <SheetContent className="w-full sm:max-w-md bg-white dark:bg-slate-900 border-l dark:border-slate-800 p-0 overflow-y-auto">
          <div className="p-8 space-y-8">
            <SheetHeader className="flex flex-row items-center justify-between space-y-0 text-left">
               <div>
                 <SheetTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                    <Calendar className="size-6 text-indigo-500" />
                    {selectedTimelineDate ? new Date(selectedTimelineDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "Timeline"}
                 </SheetTitle>
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Detailed Log Entry</p>
               </div>
               <Button variant="ghost" size="icon" onClick={() => setIsTimelineOpen(false)} className="rounded-full">
                 <X className="size-5" />
               </Button>
            </SheetHeader>

            <div className="relative pl-8 space-y-12 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800 before:dashed">
              {selectedTimelineDate && monthlyMetrics?.dailyGroups[selectedTimelineDate] && (
                ([...monthlyMetrics.dailyGroups[selectedTimelineDate]].sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime())).map((s: any, idx: number, arr: any[]) => {
                  const checkIn = new Date(s.check_in);
                  const checkOut = s.check_out ? new Date(s.check_out) : null;
                  const prodHrs = checkOut ? (checkOut.getTime() - checkIn.getTime()) / 3600000 : 0;
                  let breakHrs = 0;
                  if (idx > 0) {
                    const prevOut = arr[idx-1].check_out ? new Date(arr[idx-1].check_out) : null;
                    if (prevOut) breakHrs = (checkIn.getTime() - prevOut.getTime()) / 3600000;
                  }

                  return (
                    <div key={s.id} className="space-y-12">
                      {breakHrs > 0 && (
                        <div className="relative">
                          <div className="absolute -left-[25px] top-1/2 -translate-y-1/2 size-4 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-900 z-10" />
                          <div className="px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500 w-fit">
                            Break: {formatDuration(breakHrs)}
                          </div>
                        </div>
                      )}

                      <div className="relative">
                        <div className="absolute -left-[25px] top-2 size-4 rounded-full bg-indigo-500 border-4 border-white dark:border-slate-900 z-10" />
                        <div className="flex items-start justify-between gap-4">
                           <div className="flex items-start gap-3">
                             <div className="space-y-1">
                               <p className="text-sm font-black text-slate-900 dark:text-white">In/Out Entry {idx + 1}(I)</p>
                               <p className="text-xs font-bold text-muted-foreground">{checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                               {s.check_in_address && (
                                 <p className="text-[10px] font-medium text-muted-foreground/80 mt-1 max-w-[220px] leading-tight">{s.check_in_address}</p>
                               )}
                             </div>
                             {s.check_in_lat && (
                               <a href={`https://www.google.com/maps?q=${s.check_in_lat},${s.check_in_lng}`} target="_blank" rel="noreferrer" 
                                  className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all border border-indigo-100 dark:border-indigo-500/20 shrink-0"
                                  title="Check-in Location">
                                 <MapPin className="size-3.5" />
                               </a>
                             )}
                           </div>
                           <div className="px-4 py-1.5 rounded-full bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0">
                             Checked In
                           </div>
                        </div>
                        
                        {prodHrs > 0 && (
                          <div className="mt-8 mb-8 relative">
                             <div className="px-4 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 w-fit">
                               Production: {formatDuration(prodHrs)}
                             </div>
                          </div>
                        )}

                        {checkOut && (
                          <div className="mt-12 relative">
                            <div className="absolute -left-[25px] top-2 size-4 rounded-full bg-rose-500 border-4 border-white dark:border-slate-900 z-10" />
                            <div className="flex items-start justify-between gap-4">
                               <div className="flex items-start gap-3">
                                 <div className="space-y-1">
                                   <p className="text-sm font-black text-slate-900 dark:text-white">In/Out Entry {idx + 1}(O)</p>
                                   <p className="text-xs font-bold text-muted-foreground">{checkOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                                   {s.check_out_address ? (
                                     <p className="text-[10px] font-medium text-muted-foreground/80 mt-1 max-w-[220px] leading-tight">{s.check_out_address}</p>
                                   ) : s.check_out_type === 'Manual' ? (
                                     <p className="text-[10px] font-medium text-muted-foreground/80 mt-1 max-w-[220px] leading-tight">Location Unavailable</p>
                                   ) : (
                                     <p className="text-[10px] font-medium text-amber-500/80 mt-1 max-w-[220px] leading-tight">System Generated (Auto Checkout)</p>
                                   )}
                                 </div>
                                 {s.check_out_lat && (
                                   <a href={`https://www.google.com/maps?q=${s.check_out_lat},${s.check_out_lng}`} target="_blank" rel="noreferrer" 
                                      className="size-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all border border-rose-100 dark:border-rose-500/20 shrink-0"
                                      title="Check-out Location">
                                     <MapPin className="size-3.5" />
                                   </a>
                                 )}
                               </div>
                               <div className={cn(
                                 "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0",
                                 s.check_out_type === "Automatic"
                                   ? "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                   : "bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                               )}>
                                 Checked Out ({s.check_out_type || "Manual"})
                               </div>
                            </div>
                          </div>
                        )}

                        {s.metadata && typeof s.metadata === "object" && (s.metadata as any).deviceInfo && (
                          <div className="text-[9px] font-mono font-bold text-muted-foreground mt-4 border-t pt-2 border-dashed border-slate-100 dark:border-slate-800">
                            Device: {(s.metadata as any).deviceInfo.os || "Unknown OS"} ({(s.metadata as any).deviceInfo.browser || "Unknown Browser"})
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
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

function formatDuration(hours: number) {
  const h = Math.floor(hours);
  const m = Math.floor((hours % 1) * 60);
  return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
}

function SummaryItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-6 flex flex-col gap-1">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className={cn("text-lg font-black tracking-tight", color || "text-slate-900 dark:text-white")}>{value}</p>
    </div>
  );
}
