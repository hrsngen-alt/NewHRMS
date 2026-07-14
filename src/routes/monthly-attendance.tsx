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
  Plane, Sparkles, Timer, Coffee, CheckCircle, XCircle, AlertCircle, X, AlertTriangle, FileSpreadsheet, Download
} from "lucide-react";
import { cn } from "../lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import * as XLSX from "xlsx";

const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export const Route = createFileRoute("/monthly-attendance")({ component: () => <AppShell><AttendancePage /></AppShell> });

function AttendancePage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isAuthorized = isAdmin || isManager;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-card border rounded-2xl p-8 max-w-md mx-auto shadow-elegant">
        <AlertTriangle className="size-12 text-destructive animate-pulse" />
        <h2 className="text-2xl font-black tracking-tight text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground font-medium">This page is restricted to Admin or Manager users. If you believe this is an error, please contact support.</p>
      </div>
    );
  }

  const [q, setQ] = useState("");
  const { myEmployee, isLoading: empLoading } = useMyEmployee();
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [viewingEmpId, setViewingEmpId] = useState<string>("");
  const [selMonth, setSelMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selYear, setSelYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const downloadMonthlyAttendanceReport = async () => {
    setDownloadingReport(true);
    const loadingToast = toast.loading("Compiling monthly attendance report...");
    try {
      const year = Number(selYear);
      const month = Number(selMonth);
      const totalDays = new Date(year, month, 0).getDate();
      const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
      const endStr = `${year}-${String(month).padStart(2, "0")}-${totalDays}`;

      // 1. Fetch active employees (filtered by department if manager)
      let empQuery = supabase.from("employees").select("*").eq("status", "active");
      if (isManager && myEmployee) {
        empQuery = empQuery.eq("department", myEmployee.department);
      }
      const { data: employees, error: empErr } = await empQuery;
      if (empErr) throw empErr;

      if (!employees || employees.length === 0) {
        toast.error("No active employees found.");
        return;
      }

      // 2. Fetch attendance logs for all fetched employees
      const employeeIds = employees.map(e => e.id);
      const { data: attendanceLogs, error: attErr } = await supabase
        .from("attendance")
        .select("*")
        .in("employee_id", employeeIds)
        .gte("date", startStr)
        .lte("date", endStr);
      if (attErr) throw attErr;

      // 3. Fetch leaves for fetched employees
      const { data: leavesLogs, error: lvErr } = await supabase
        .from("leaves")
        .select("*")
        .in("employee_id", employeeIds)
        .eq("status", "approved")
        .or(`and(start_date.lte.${endStr},end_date.gte.${startStr})`);
      if (lvErr) throw lvErr;

      // 4. Fetch holidays
      const { data: holidaysLogs, error: holErr } = await supabase
        .from("holidays" as any)
        .select("*")
        .gte("date", startStr)
        .lte("date", endStr);
      const holidays = holidaysLogs || [];

      // 5. Calculate metrics for each employee
      const reportRows = employees.map((emp) => {
        const empAtt = (attendanceLogs || []).filter((a) => a.employee_id === emp.id);
        const empLeaves = (leavesLogs || []).filter((l) => l.employee_id === emp.id);

        let presentCount = 0;
        let absentCount = 0;
        let halfCount = 0;
        let lateCount = 0;
        let otCount = 0;

        for (let d = 1; d <= totalDays; d++) {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dObj = new Date(year, month - 1, d);
          const isSunday = dObj.getDay() === 0;

          const attRec = empAtt.find((a) => a.date === dateStr);
          const isHoliday = holidays.some((h: any) => h.date === dateStr);
          const isLeave = empLeaves.some((l) => dateStr >= l.start_date && dateStr <= l.end_date);

          if (attRec) {
            const hrs = Number(attRec.hours_worked || 0);
            if (hrs > 0 && hrs < 4) {
              halfCount++;
              presentCount += 0.5;
            } else {
              presentCount++;
            }
            if (hrs > 9) {
              otCount += (hrs - 9);
            }
            if (attRec.check_in) {
              const ciTime = new Date(attRec.check_in);
              const thresh = new Date(attRec.check_in);
              thresh.setHours(9, 45, 0, 0);
              if (ciTime.getTime() > thresh.getTime()) {
                lateCount++;
              }
            }
          } else {
            if (!isHoliday && !isSunday && !isLeave) {
              absentCount++;
            }
          }
        }

        const paid = totalDays - absentCount - (halfCount * 0.5);

        return {
          "Employee ID": emp.employee_code,
          "Employee Name": emp.full_name,
          "Department": emp.department || "—",
          "Designation": emp.designation || "—",
          "Total Days": totalDays,
          "Paid Days": Number(paid.toFixed(1)),
          "Absent Days": absentCount,
          "Half Days": halfCount,
          "Late Marks": lateCount,
          "OT Hours": Number(otCount.toFixed(1)),
        };
      });

      // 6. Generate Excel workbook
      const ws = XLSX.utils.json_to_sheet(reportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
      
      const periodStr = `${months[month - 1]}_${year}`;
      XLSX.writeFile(wb, `Attendance_Report_${periodStr}.xlsx`);
      toast.success("Attendance report downloaded!");
    } catch (err: any) {
      toast.error("Failed to generate report: " + err.message);
    } finally {
      setDownloadingReport(false);
      toast.dismiss(loadingToast);
    }
  };

  const [downloadingDetailed, setDownloadingDetailed] = useState(false);

  const downloadDetailedAttendanceReport = async () => {
    setDownloadingDetailed(true);
    const loadingToast = toast.loading("Compiling detailed attendance logs...");
    try {
      const year = Number(selYear);
      const month = Number(selMonth);
      const totalDays = new Date(year, month, 0).getDate();
      const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
      const endStr = `${year}-${String(month).padStart(2, "0")}-${totalDays}`;

      // 1. Fetch active employees
      let empQuery = supabase.from("employees").select("id, full_name, employee_code, department").in("status", ["active", "Active", "ACTIVE", "resigned", "Resigned", "RESIGNED"]);
      if (isManager && myEmployee) {
        empQuery = empQuery.eq("department", myEmployee.department);
      }
      const { data: employees, error: empErr } = await empQuery;
      if (empErr) throw empErr;

      if (!employees || employees.length === 0) {
        toast.error("No active employees found.");
        return;
      }

      // 2. Fetch all detailed logs for these employees
      const employeeIds = employees.map(e => e.id);
      const { data: logs, error: logErr } = await supabase
        .from("attendance")
        .select("*")
        .in("employee_id", employeeIds)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("check_in", { ascending: true });
      if (logErr) throw logErr;

      // 3. Format rows
      const reportRows = (logs || []).map((log) => {
        const emp = employees.find(e => e.id === log.employee_id);
        const checkInTime = log.check_in ? new Date(log.check_in).toLocaleString() : "—";
        const checkOutTime = log.check_out ? new Date(log.check_out).toLocaleString() : "—";
        
        let deviceStr = "—";
        if (log.metadata && typeof log.metadata === "object") {
          const info = (log.metadata as any).deviceInfo;
          if (info) deviceStr = `${info.os} (${info.browser})`;
        }

        return {
          "Employee ID": emp?.employee_code || "—",
          "Employee Name": log.employee_name || emp?.full_name || "—",
          "Team/Department": log.department || emp?.department || "—",
          "Date": log.date,
          "Check-In Time": checkInTime,
          "Check-Out Time": checkOutTime,
          "Hours Worked": log.hours_worked !== null ? String(log.hours_worked) : "—",
          "Check-Out Type": log.check_out_type || "—",
          "Check-In Location (Lat/Lng)": log.check_in_lat && log.check_in_lng ? `${log.check_in_lat}, ${log.check_in_lng}` : "—",
          "Check-In Address": log.check_in_address || "—",
          "Check-Out Location (Lat/Lng)": log.check_out_lat && log.check_out_lng ? `${log.check_out_lat}, ${log.check_out_lng}` : "—",
          "Check-Out Address": log.check_out_address || "—",
          "Device Info": deviceStr
        };
      });

      // 4. Excel export
      const ws = XLSX.utils.json_to_sheet(reportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Detailed Logs");
      
      const periodStr = `${months[month - 1]}_${year}`;
      XLSX.writeFile(wb, `Detailed_Attendance_Logs_${periodStr}.xlsx`);
      toast.success("Detailed attendance logs downloaded!");
    } catch (err: any) {
      toast.error("Failed to generate detailed report: " + err.message);
    } finally {
      setDownloadingDetailed(false);
      toast.dismiss(loadingToast);
    }
  };

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["employees", "list"],
    enabled: isAuthorized,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name, employee_code, department").in("status", ["active", "Active", "ACTIVE", "resigned", "Resigned", "RESIGNED"]);
      if (error) return [];
      return data;
    }
  });

  const visibleEmployees = useMemo(() => {
    if (isAdmin) return allEmployees;
    if (isManager && myEmployee) {
      return allEmployees.filter((e: any) => e.department === myEmployee.department);
    }
    return [];
  }, [allEmployees, isAdmin, isManager, myEmployee]);

  const suggestions = useMemo(() => {
    if (!q) return [];
    const search = q.toLowerCase();
    return visibleEmployees.filter((e: any) =>
      e.full_name?.toLowerCase().includes(search) ||
      e.employee_code?.toLowerCase().includes(search)
    );
  }, [visibleEmployees, q]);

  const departments = useMemo(() => Array.from(new Set(visibleEmployees.map((e: any) => e.department).filter(Boolean))), [visibleEmployees]);

  const targetEmployeeId = isAuthorized ? (selectedEmpId || myEmployee?.id) : myEmployee?.id;
  const targetEmployee = isAuthorized ? (visibleEmployees.find((e: any) => e.id === targetEmployeeId) || myEmployee) : myEmployee;

  const isMarketing = targetEmployee?.department?.toLowerCase() === "marketing";

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", role, myEmployee?.id],
    queryFn: async () => {
      let query = supabase
        .from("attendance" as any)
        .select("*, employees(full_name, employee_code, department)")
        .order("check_in", { ascending: false });
      
      if (!isAdmin && !isManager && myEmployee) query = query.eq("employee_id", myEmployee.id).limit(200);
      else query = query.limit(500);
      
      const { data, error } = await query;
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!user && (isAuthorized || !!myEmployee),
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
    queryKey: ["leaves-all", targetEmployeeId],
    enabled: !!targetEmployeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaves")
        .select("*")
        .eq("employee_id", targetEmployeeId);
      if (error) return [];
      return (data || []).filter((l: any) => l.status?.toLowerCase() === "approved");
    }
  });

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

  // Generate all days for the selected month/year and determine status
  const dayStatuses = useMemo(() => {
    if (!targetEmployeeId) return [];
    
    const currentMonth = Number(selMonth === "all" ? new Date().getMonth() + 1 : selMonth);
    const currentYear = Number(selYear === "all" ? new Date().getFullYear() : selYear);
    
    const today = new Date();
    const isCurrentMonthYear = today.getMonth() + 1 === currentMonth && today.getFullYear() === currentYear;
    
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const maxDay = isCurrentMonthYear ? today.getDate() : totalDaysInMonth;
    
    const daysList = [];
    for (let d = 1; d <= maxDay; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysList.push(dateStr);
    }
    
    // Sort reverse: latest date first
    daysList.sort((a, b) => b.localeCompare(a));
    
    return daysList.map((dateStr) => {
      const sessions = monthlyMetrics?.dailyGroups[dateStr];
      const hasPunch = !!sessions;
      
      // Check Holiday
      const holiday = dbHolidays.find((h: any) => h.date === dateStr) as any;
      
      // Check Weekend (Sunday Only)
      const dObj = new Date(dateStr);
      const dayOfWeek = dObj.getDay();
      const isWeekend = dayOfWeek === 0; // Sunday only
      
      // Check Approved Leave
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
  }, [targetEmployeeId, selMonth, selYear, monthlyMetrics, dbHolidays, dbLeaves]);

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
          {isAuthorized ? "Team Monthly Attendance" : "My Monthly Attendance"}
        </h1>

        <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900/50 p-6 rounded-3xl border-2 border-slate-50 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            {isAuthorized && (
              <div className="relative w-full md:w-auto md:min-w-[280px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input 
                  placeholder="Search employee name/code..." 
                  className="pl-12 h-12 w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setShowSuggestions(false)}
                />

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto p-2 space-y-1">
                    {suggestions.map((e: any) => (
                      <button
                        key={e.id}
                        onMouseDown={() => {
                          setSelectedEmpId(e.id);
                          setQ(e.full_name);
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-300"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold">{e.full_name}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">{e.department}</span>
                        </div>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-muted-foreground font-mono">
                          {e.employee_code}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isAuthorized && (
              <div className="relative w-full md:w-auto md:min-w-[240px]">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                  <SelectTrigger className="pl-12 h-12 w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold">
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleEmployees.filter((e: any) => 
                      !q || e.full_name?.toLowerCase().includes(q.toLowerCase()) || e.employee_code?.toLowerCase().includes(q.toLowerCase())
                    ).map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isAuthorized && (
              <div className="relative w-full md:w-auto md:min-w-[180px]">
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="h-12 w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d: any) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

           <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-2 h-12 w-full md:w-auto justify-between md:justify-start">
             <div className="flex items-center">
               <Calendar className="size-4 text-muted-foreground mr-2" />
               <Select value={selMonth} onValueChange={setSelMonth}>
                 <SelectTrigger className="w-[120px] border-none bg-transparent font-bold shadow-none">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {months.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
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
            onClick={() => { 
              setSelectedEmpId(""); 
              setSelectedDept("all"); 
              setSelMonth(String(new Date().getMonth() + 1)); 
              setQ(""); 
              setShowSuggestions(false); 
            }}
            className="h-12 w-full md:w-auto px-6 rounded-xl font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
           >
             Clear Filters
           </Button>

           <Button
              variant="outline"
              onClick={downloadMonthlyAttendanceReport}
              disabled={downloadingReport}
              className="h-12 w-full md:w-auto px-6 rounded-xl font-bold text-green-600 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-500/10 flex items-center gap-2 shadow-sm"
            >
              <FileSpreadsheet className={cn("size-4", downloadingReport && "animate-spin")} />
              Export Summary Excel
            </Button>

            <Button
              variant="outline"
              onClick={downloadDetailedAttendanceReport}
              disabled={downloadingDetailed}
              className="h-12 w-full md:w-auto px-6 rounded-xl font-bold text-indigo-600 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex items-center gap-2 shadow-sm"
            >
              <Download className={cn("size-4", downloadingDetailed && "animate-spin")} />
              Export Detailed Logs
            </Button>

            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto md:ml-auto justify-center md:justify-end text-[10px] font-black uppercase tracking-widest text-muted-foreground pt-2 md:pt-0">
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
          subtext={`${summaryStats.workingDays} working days`}
          icon={TrendingUp}
          color="indigo"
          progress={(monthlyMetrics?.totalProdHours || 0) / 160 * 100}
        />
        <PremiumStatCard 
          label="BEGINNING YOUR DAY FOR MONTH"
          value={`${monthlyMetrics?.punctuality.toFixed(0) || 100}%`}
          subtext={`${summaryStats.workingDays}/${summaryStats.workingDays} On time`}
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

      {/* Time Log Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
             <Timer className="size-6 text-indigo-500" /> 
             TIME LOG {targetEmployee && <span className="text-muted-foreground/40 font-normal">: {targetEmployee.full_name?.toUpperCase()}</span>}
           </h2>
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
                            {new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            <span className="size-2 rounded-full bg-green-500 shrink-0" />
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
                            {new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                        {new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="size-2 rounded-full bg-green-500 shrink-0" />
                      </h4>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        {firstIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {lastOut ? lastOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "ACTIVE"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-[9px] uppercase tracking-widest">
                        Shift Complete: {isShiftComplete ? "YES" : "NO"}
                      </div>
                      <span className={cn("text-[9px] font-black uppercase tracking-tighter px-2.5 py-0.5 rounded-full", isShiftComplete ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400")}>
                        {isShiftComplete ? "Goal Reached" : `${(8 - prodHours).toFixed(1)}H REMAINING`}
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
                      {new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
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
          {dayStatuses.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 rounded-3xl p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="size-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300">
                  <AlertCircle className="size-8" />
                </div>
                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No records for this period</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Sidebar */}
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
                    if (prevOut) {
                      breakHrs = (checkIn.getTime() - prevOut.getTime()) / 3600000;
                    }
                  }

                  return (
                    <div key={s.id} className="space-y-12">
                      {breakHrs > 0 && (
                        <div className="relative">
                          <div className="absolute -left-[25px] top-1/2 -translate-y-1/2 size-4 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-900 z-10" />
                          <div className="flex items-center gap-3">
                             <div className="px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                               Break: {formatDuration(breakHrs)}
                             </div>
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
                             <div className="size-1.5 rounded-full bg-current animate-pulse" />
                             Checked In
                           </div>
                        </div>
                        
                        {prodHrs > 0 && (
                          <div className="mt-8 mb-8 relative">
                            <div className="flex items-center gap-3">
                               <div className="px-4 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                                 Production: {formatDuration(prodHrs)}
                               </div>
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
                                   {s.check_out_address && (
                                     <p className="text-[10px] font-medium text-muted-foreground/80 mt-1 max-w-[220px] leading-tight">{s.check_out_address}</p>
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
                                 <div className="size-1.5 rounded-full bg-current" />
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
