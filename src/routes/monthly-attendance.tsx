import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { toast } from "sonner";
import { 
  Clock, Play, Square, Search, Users, Calendar, Activity, 
  CheckCircle2, MapPin, ExternalLink, TrendingUp, ShieldCheck, 
  Plane, Sparkles, Timer, Coffee, CheckCircle, XCircle, AlertCircle, X, AlertTriangle, FileSpreadsheet, Download, Scan
} from "lucide-react";
import { cn } from "../lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import * as XLSX from "xlsx";
import { normalizeDepartment } from "@/lib/departments";

const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export const Route = createFileRoute("/monthly-attendance")({ component: () => <AppShell><AttendancePage /></AppShell> });

function AttendancePage() {
  const qc = useQueryClient();
  const { user, role, loading } = useAuth();
  const { myEmployee, isLoading: empLoading } = useMyEmployee();

  const [q, setQ] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [viewingEmpId, setViewingEmpId] = useState<string>("");
  const [selMonth, setSelMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selYear, setSelYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [downloadingDetailed, setDownloadingDetailed] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterTime, setFilterTime] = useState("10:00");

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["employees", "list"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name, employee_code, department, reporting_manager").in("status", ["active", "Active", "ACTIVE", "resigned", "Resigned", "RESIGNED"]);
      if (error) return [];
      return data;
    }
  });

  const isAdmin = role === "admin";
  const visibleEmployees = useMemo(() => {
    if (isAdmin) return allEmployees;
    if (myEmployee) {
      const mName = myEmployee.full_name?.trim().toLowerCase();
      const mId = myEmployee.id?.trim().toLowerCase();
      const mCode = myEmployee.employee_code?.trim().toLowerCase();
      const mEmail = myEmployee.email?.trim().toLowerCase();
      return allEmployees.filter((e: any) => {
        if (e.id === myEmployee.id) return true;
        const rm = e.reporting_manager ? String(e.reporting_manager).trim().toLowerCase() : "";
        if (!rm) return false;
        return (mName && rm === mName) || (mId && rm === mId) || (mCode && rm === mCode) || (mEmail && rm === mEmail);
      });
    }
    return [];
  }, [allEmployees, isAdmin, myEmployee]);

  const hasTeam = visibleEmployees.some((e: any) => e.id !== myEmployee?.id);
  const isManager = role === "manager" || hasTeam;
  const isAuthorized = isAdmin || isManager;

  const downloadMonthlyAttendanceReport = async () => {
    setDownloadingReport(true);
    const loadingToast = toast.loading("Compiling monthly attendance report...");
    try {
      const year = Number(selYear);
      const month = Number(selMonth);
      const totalDays = new Date(year, month, 0).getDate();
      const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
      const endStr = `${year}-${String(month).padStart(2, "0")}-${totalDays}`;

      // 1. Fetch active employees (filtered by team if manager, or department if selected)
      let empQuery = supabase
        .from("employees")
        .select("*")
        .in("status", ["active", "Active", "ACTIVE", "resigned", "Resigned", "RESIGNED"]);
      if (selectedDept && selectedDept !== "all") {
        empQuery = empQuery.eq("department", selectedDept);
      }
      const { data: rawEmployees, error: empErr } = await empQuery;
      if (empErr) throw empErr;

      const mName = myEmployee?.full_name?.trim().toLowerCase();
      const employees = isManager && myEmployee
        ? (rawEmployees || []).filter((e: any) => {
            const rm = e.reporting_manager?.trim().toLowerCase();
            return (mName && rm === mName) || e.id === myEmployee.id;
          })
        : (rawEmployees || []);

      if (!employees || employees.length === 0) {
        toast.error("No active employees found.");
        return;
      }

      // 2. Fetch attendance logs for all fetched employees (paginated to handle >1000 rows)
      const employeeIds = employees.map(e => e.id);
      const attendanceLogs: any[] = [];
      const pageSize = 1000;
      let attPage = 0;
      while (true) {
        const from = attPage * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("attendance")
          .select("*")
          .in("employee_id", employeeIds)
          .gte("date", startStr)
          .lte("date", endStr)
          .range(from, to);
        if (error) throw error;
        if (!data || data.length === 0) break;
        attendanceLogs.push(...data);
        if (data.length < pageSize) break;
        attPage++;
      }

      // 3. Fetch leaves for fetched employees (paginated to handle >1000 rows)
      const leavesLogs: any[] = [];
      let lvPage = 0;
      while (true) {
        const from = lvPage * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("leaves")
          .select("*")
          .in("employee_id", employeeIds)
          .eq("status", "approved")
          .lte("start_date", endStr)
          .gte("end_date", startStr)
          .range(from, to);
        if (error) throw error;
        if (!data || data.length === 0) break;
        leavesLogs.push(...data);
        if (data.length < pageSize) break;
        lvPage++;
      }

      // 4. Fetch holidays
      const { data: holidaysLogs, error: holErr } = await supabase
        .from("holidays" as any)
        .select("*")
        .gte("date", startStr)
        .lte("date", endStr);
      const holidays = holidaysLogs || [];

      const now = new Date();
      const isCurrentMonthYear = now.getFullYear() === year && (now.getMonth() + 1) === month;
      const todayDate = now.getDate();
      const elapsedDays = isCurrentMonthYear ? Math.min(todayDate, totalDays) : totalDays;

      // 5. Calculate metrics for each employee
      const reportRows = employees.map((emp) => {
        const empAtt = (attendanceLogs || []).filter((a) => a.employee_id === emp.id);
        const empLeaves = (leavesLogs || []).filter((l) => l.employee_id === emp.id);

        let presentCount = 0;
        let absentCount = 0;
        let leaveCount = 0;
        let halfCount = 0;
        let lateCount = 0;
        let otCount = 0;

        const dayWiseData: Record<string, string> = {};

        for (let d = 1; d <= totalDays; d++) {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dObj = new Date(year, month - 1, d);
          const isSunday = dObj.getDay() === 0;
          const isFuture = isCurrentMonthYear && d > todayDate;

          const daySessions = empAtt.filter((a) => a.date === dateStr);
          const isHoliday = holidays.some((h: any) => h.date === dateStr);
          const isLeave = empLeaves.some((l) => dateStr >= l.start_date && dateStr <= l.end_date);

          if (daySessions.length > 0) {
            // Aggregate hours worked across all sessions for the day
            let dayHours = 0;
            for (const s of daySessions) {
              let hrs = Number(s.hours_worked) || 0;
              if (!hrs && s.check_in && s.check_out) {
                hrs = (new Date(s.check_out).getTime() - new Date(s.check_in).getTime()) / 3600000;
              }
              if (hrs > 0) dayHours += hrs;
            }

            // Check late arrivals based on earliest check-in of the day
            const checkIns = daySessions
              .filter((s) => s.check_in)
              .map((s) => new Date(s.check_in))
              .sort((a, b) => a.getTime() - b.getTime());

            if (checkIns.length > 0) {
              const earliestIn = checkIns[0];
              const thresh = new Date(earliestIn);
              thresh.setHours(9, 45, 0, 0);
              if (earliestIn.getTime() > thresh.getTime()) {
                lateCount++;
              }
            }

            const roundedHrs = Number(dayHours.toFixed(1));
            if (roundedHrs > 0) {
              if (roundedHrs < 4) {
                halfCount++;
                presentCount += 0.5;
              } else {
                presentCount++;
              }
              if (roundedHrs > 9) {
                otCount += (roundedHrs - 9);
              }
              dayWiseData[`Day ${d}`] = `${roundedHrs} hrs`;
            } else {
              presentCount++;
              dayWiseData[`Day ${d}`] = "Present";
            }
          } else if (isFuture) {
            dayWiseData[`Day ${d}`] = "—";
          } else if (isHoliday) {
            dayWiseData[`Day ${d}`] = "H"; // Holiday
          } else if (isSunday) {
            dayWiseData[`Day ${d}`] = "W"; // Weekend
          } else if (isLeave) {
            leaveCount++;
            dayWiseData[`Day ${d}`] = "L"; // Leave
          } else {
            absentCount++;
            dayWiseData[`Day ${d}`] = "A"; // Absent
          }
        }

        const paid = Math.max(0, elapsedDays - absentCount - (halfCount * 0.5));

        return {
          "Employee ID": emp.employee_code || "—",
          "Employee Name": emp.full_name || "—",
          "Department": emp.department || "—",
          "Designation": emp.designation || "—",
          "Total Days": totalDays,
          ...(isCurrentMonthYear ? { "Elapsed Days": elapsedDays } : {}),
          "Paid Days": Number(paid.toFixed(1)),
          "Leave Days": leaveCount,
          "Absent Days": absentCount,
          "Half Days": halfCount,
          "Late Marks": lateCount,
          "OT Hours": Number(otCount.toFixed(1)),
          ...dayWiseData,
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
      let empQuery = supabase.from("employees").select("id, full_name, employee_code, department, reporting_manager").in("status", ["active", "Active", "ACTIVE", "resigned", "Resigned", "RESIGNED"]);
      if (selectedDept && selectedDept !== "all") {
        empQuery = empQuery.eq("department", selectedDept);
      }
      const { data: rawEmployees, error: empErr } = await empQuery;
      if (empErr) throw empErr;

      const mName = myEmployee?.full_name?.trim().toLowerCase();
      const employees = isManager && myEmployee
        ? (rawEmployees || []).filter((e: any) => {
            const rm = e.reporting_manager?.trim().toLowerCase();
            return (mName && rm === mName) || e.id === myEmployee.id;
          })
        : (rawEmployees || []);

      if (!employees || employees.length === 0) {
        toast.error("No active employees found.");
        return;
      }

      // 2. Fetch all detailed logs for these employees (paginated to handle >1000 rows)
      const employeeIds = employees.map(e => e.id);
      const logs: any[] = [];
      const pageSize = 1000;
      let logPage = 0;
      while (true) {
        const from = logPage * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("attendance")
          .select("*")
          .in("employee_id", employeeIds)
          .gte("date", startStr)
          .lte("date", endStr)
          .order("check_in", { ascending: true })
          .range(from, to);
        if (error) throw error;
        if (!data || data.length === 0) break;
        logs.push(...data);
        if (data.length < pageSize) break;
        logPage++;
      }

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

        let hoursStr = "—";
        if (log.hours_worked !== null && log.hours_worked !== undefined) {
          hoursStr = `${Number(log.hours_worked).toFixed(2)} hrs`;
        } else if (log.check_in && log.check_out) {
          const diff = (new Date(log.check_out).getTime() - new Date(log.check_in).getTime()) / 3600000;
          hoursStr = `${Math.max(0, diff).toFixed(2)} hrs`;
        }

        return {
          "Employee ID": emp?.employee_code || "—",
          "Employee Name": log.employee_name || emp?.full_name || "—",
          "Team/Department": log.department || emp?.department || "—",
          "Date": log.date,
          "Check-In Time": checkInTime,
          "Check-Out Time": checkOutTime,
          "Hours Worked": hoursStr,
          "Check-Out Type": log.check_out_type || "—",
          "Check-In Location (Lat/Lng)": log.check_in_lat && log.check_in_lng ? `${log.check_in_lat}, ${log.check_in_lng}` : "—",
          "Check-In Address": log.check_in_address || "—",
          "Check-Out Location (Lat/Lng)": log.check_out_lat && log.check_out_lng ? `${log.check_out_lat}, ${log.check_out_lng}` : "—",
          "Check-Out Address": log.check_out_type === 'Automatic' ? 'System Generated (Auto Checkout)' : (log.check_out_address || "—"),
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



  const suggestions = useMemo(() => {
    if (!q) return [];
    const search = q.toLowerCase();
    return visibleEmployees.filter((e: any) =>
      e.full_name?.toLowerCase().includes(search) ||
      e.employee_code?.toLowerCase().includes(search)
    );
  }, [visibleEmployees, q]);

  const departments = useMemo(() => Array.from(new Set(visibleEmployees.map((e: any) => normalizeDepartment(e.department)).filter(Boolean))).sort(), [visibleEmployees]);

  const targetEmployeeId = isAuthorized ? (selectedEmpId || myEmployee?.id) : myEmployee?.id;
  const targetEmployee = isAuthorized ? (visibleEmployees.find((e: any) => e.id === targetEmployeeId) || myEmployee) : myEmployee;

  const isMarketing = targetEmployee?.department?.toLowerCase() === "marketing";

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance", role, myEmployee?.id, targetEmployeeId, visibleEmployees.map((e: any) => e.id).join(",")],
    queryFn: async () => {
      if (!isAdmin && !isManager && myEmployee) {
        const { data, error } = await supabase
          .from("attendance" as any)
          .select("*, employees(full_name, employee_code, department)")
          .eq("employee_id", myEmployee.id)
          .order("date", { ascending: false })
          .order("check_in", { ascending: false, nullsFirst: false })
          .limit(1000);
        if (error) {
          console.error("[MonthlyAttendance] employee records error:", error);
          throw error;
        }
        return (data as any) || [];
      } else if (isManager && myEmployee) {
        // Collect all IDs: all team members + manager self + target employee if selected
        const teamIdSet = new Set<string>();
        visibleEmployees.forEach((e: any) => teamIdSet.add(e.id));
        if (myEmployee.id) teamIdSet.add(myEmployee.id);
        if (targetEmployeeId) teamIdSet.add(targetEmployeeId);

        let teamIds = Array.from(teamIdSet);
        if (teamIds.length === 0) teamIds = [myEmployee.id];

        const allRecords: any[] = [];
        const pageSize = 1000;
        for (let page = 0; page < 5; page++) {
          const from = page * pageSize;
          const to = from + pageSize - 1;
          const { data, error } = await supabase
            .from("attendance" as any)
            .select("*, employees(full_name, employee_code, department)")
            .in("employee_id", teamIds)
            .order("date", { ascending: false })
            .order("check_in", { ascending: false, nullsFirst: false })
            .range(from, to);
          if (error) {
            console.error("[MonthlyAttendance] manager records error:", error);
            throw error;
          }
          if (!data || data.length === 0) break;
          allRecords.push(...data);
          if (data.length < pageSize) break;
        }
        return (allRecords as any) || [];
      } else {
        const allRecords: any[] = [];
        const pageSize = 1000;
        for (let page = 0; page < 5; page++) {
          const from = page * pageSize;
          const to = from + pageSize - 1;
          const { data, error } = await supabase
            .from("attendance" as any)
            .select("*, employees(full_name, employee_code, department)")
            .order("date", { ascending: false })
            .order("check_in", { ascending: false, nullsFirst: false })
            .range(from, to);
          if (error) {
            console.error("[MonthlyAttendance] admin records error:", error);
            throw error;
          }
          if (!data || data.length === 0) break;
          allRecords.push(...data);
          if (data.length < pageSize) break;
        }
        return (allRecords as any) || [];
      }
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
      if (r.employee_id !== targetEmployeeId) return false;
      let m = 0, y = 0;
      if (r.date) {
        const parts = String(r.date).split("-").map(Number);
        if (parts.length >= 2) {
          y = parts[0];
          m = parts[1];
        }
      }
      if (!m || !y) {
        const d = new Date(r.date || r.check_in);
        m = d.getMonth() + 1;
        y = d.getFullYear();
      }
      return m === currentMonth && y === currentYear;
    });

    const totalProdHours = monthRecords.reduce((acc: number, r: any) => {
      let hrs = Number(r.hours_worked) || 0;
      if (!hrs && r.check_in && r.check_out) {
        hrs = (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000;
      } else if (!r.check_out && r.check_in) {
        hrs = (new Date().getTime() - new Date(r.check_in).getTime()) / 3600000;
      }
      return acc + Math.max(0, hrs);
    }, 0);
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

    let lateArrivals = 0;
    let earlyDepartures = 0;
    let missedPunches = 0;
    const todayStr = new Date().toLocaleDateString('en-CA');

    const dailyStats = Object.entries(dailyGroups).map(([date, sessions]: [string, any]) => {
      const sorted = [...sessions].sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
      const firstIn = new Date(sorted[0].check_in);
      
      if (firstIn.getHours() > 9 || (firstIn.getHours() === 9 && firstIn.getMinutes() > 45)) {
        lateArrivals++;
      }

      const hasMissedPunch = sessions.some((s: any) => !s.check_out && s.date !== todayStr);
      if (hasMissedPunch) {
        missedPunches++;
      }

      const lastOut = sorted[sorted.length - 1].check_out ? new Date(sorted[sorted.length - 1].check_out) : new Date();
      const availability = (lastOut.getTime() - firstIn.getTime()) / 3600000;
      const production = sessions.reduce((s: number, r: any) => {
        let hrs = Number(r.hours_worked) || 0;
        if (!hrs && r.check_in && r.check_out) {
          hrs = (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000;
        } else if (!r.check_out && r.check_in) {
          hrs = (new Date().getTime() - new Date(r.check_in).getTime()) / 3600000;
        }
        return s + Math.max(0, hrs);
      }, 0);

      if (date !== todayStr && !hasMissedPunch && production < 8.5) {
        earlyDepartures++;
      }

      return { availability, production };
    });

    const totalAvailHours = dailyStats.reduce((acc, s) => acc + s.availability, 0);
    const totalBreakHours = Math.max(0, totalAvailHours - totalProdHours);
    const breakPercentage = totalAvailHours > 0 ? (totalBreakHours / totalAvailHours) * 100 : 0;

    return { totalProdHours, workingDays, punctuality, totalBreakHours, breakPercentage, totalAvailHours, dailyGroups, lateArrivals, earlyDepartures, missedPunches };
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

  const lateCheckIns = useMemo(() => {
    if (!filterDate || !filterTime) return [];
    return records.filter((a: any) => {
      if (!a.check_in || !a.date) return false;
      if (a.date !== filterDate) return false;
      
      const checkInDate = new Date(a.check_in);
      const hours = checkInDate.getHours().toString().padStart(2, '0');
      const minutes = checkInDate.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;
      return timeStr > filterTime;
    });
  }, [records, filterDate, filterTime]);

  if (loading && !role) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-card border rounded-2xl p-8 max-w-md mx-auto shadow-elegant">
        <Clock className="size-10 text-primary animate-spin" />
        <h2 className="text-xl font-bold tracking-tight text-foreground">Loading attendance...</h2>
        <p className="text-xs text-muted-foreground font-medium">Verifying authorization and records...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-card border rounded-2xl p-8 max-w-md mx-auto shadow-elegant">
        <AlertTriangle className="size-12 text-destructive animate-pulse" />
        <h2 className="text-2xl font-black tracking-tight text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground font-medium">This page is restricted to Admin or Manager users. If you believe this is an error, please contact support.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 p-4 md:p-8">
      {/* Header Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            {isAuthorized ? "Team Monthly Attendance" : "My Monthly Attendance"}
          </h1>
        </div>
      </div>

      <Tabs defaultValue="attendance" className="w-full space-y-8 mt-6">
        {isAuthorized && (
          <TabsList className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 h-auto mb-2 inline-flex flex-wrap">
            <TabsTrigger value="attendance" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">Monthly Attendance</TabsTrigger>
            <TabsTrigger value="late-arrivals" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm text-rose-500 data-[state=active]:text-rose-600">Time-Wise Late Arrivals</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="attendance" className="space-y-8 m-0 focus:outline-none">
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
           <SummaryItem label="Late Arrivals" value={String(monthlyMetrics?.lateArrivals || 0)} color="text-amber-500" />
           <SummaryItem label="Early Departures" value={String(monthlyMetrics?.earlyDepartures || 0)} color="text-orange-500" />
           <SummaryItem label="Missed Punches" value={String(monthlyMetrics?.missedPunches || 0)} color="text-rose-600 dark:text-rose-400" />
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
                  const validCheckIns = sorted.filter((s: any) => !!s.check_in);
                  const firstIn = validCheckIns.length > 0 ? new Date(validCheckIns[0].check_in) : null;
                  const validCheckOuts = sorted.filter((s: any) => !!s.check_out);
                  const lastOut = validCheckOuts.length > 0 ? new Date(validCheckOuts[validCheckOuts.length - 1].check_out) : null;
                  
                  const availHours = (firstIn && lastOut) ? Math.max(0, (lastOut.getTime() - firstIn.getTime()) / 3600000) : 0;
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
                            {firstIn ? firstIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "NO TIME"} — {lastOut ? lastOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "ACTIVE"}
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
              const validCheckIns = sorted.filter((s: any) => !!s.check_in);
              const firstIn = validCheckIns.length > 0 ? new Date(validCheckIns[0].check_in) : null;
              const validCheckOuts = sorted.filter((s: any) => !!s.check_out);
              const lastOut = validCheckOuts.length > 0 ? new Date(validCheckOuts[validCheckOuts.length - 1].check_out) : null;
              
              const availHours = (firstIn && lastOut) ? Math.max(0, (lastOut.getTime() - firstIn.getTime()) / 3600000) : 0;
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
                        {firstIn ? firstIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "NO TIME"} — {lastOut ? lastOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "ACTIVE"}
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
                               {s.metadata?.selfie && (
                                 <Dialog>
                                   <DialogTrigger asChild>
                                     <button onClick={(e) => e.stopPropagation()} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-200/50 dark:border-indigo-800 w-fit">
                                       <Scan className="size-3" /> View Photo
                                     </button>
                                   </DialogTrigger>
                                   <DialogContent className="max-w-xs p-0 overflow-hidden bg-slate-950 border-slate-800 rounded-[2rem]">
                                     <img src={s.metadata.selfie} alt="Verification" className="w-full aspect-square object-cover" />
                                     <div className="p-4 text-center text-xs font-medium text-slate-400">
                                       Captured at {checkIn.toLocaleTimeString()}
                                     </div>
                                   </DialogContent>
                                 </Dialog>
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
                                   {s.check_out_address ? (
                                     <p className="text-[10px] font-medium text-muted-foreground/80 mt-1 max-w-[220px] leading-tight">{s.check_out_address}</p>
                                   ) : s.check_out_type === 'Forget Check Out' ? (
                                     <p className="text-[10px] font-medium text-rose-500/80 mt-1 max-w-[220px] leading-tight">System Generated (Forgot Checkout)</p>
                                   ) : s.check_out_type === 'Manual' ? (
                                     <p className="text-[10px] font-medium text-muted-foreground/80 mt-1 max-w-[220px] leading-tight">Location Unavailable</p>
                                   ) : (
                                     <p className="text-[10px] font-medium text-amber-500/80 mt-1 max-w-[220px] leading-tight">System Generated (Auto Checkout)</p>
                                   )}
                                   {s.metadata?.selfie_out && (
                                     <Dialog>
                                       <DialogTrigger asChild>
                                         <button onClick={(e) => e.stopPropagation()} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] font-bold hover:bg-rose-100 transition-colors shadow-sm border border-rose-200/50 dark:border-rose-800 w-fit">
                                           <Scan className="size-3" /> View Photo
                                         </button>
                                       </DialogTrigger>
                                       <DialogContent className="max-w-xs p-0 overflow-hidden bg-slate-950 border-slate-800 rounded-[2rem]">
                                         <img src={s.metadata.selfie_out} alt="Verification" className="w-full aspect-square object-cover" />
                                         <div className="p-4 text-center text-xs font-medium text-slate-400">
                                           Captured at {checkOut.toLocaleTimeString()}
                                         </div>
                                       </DialogContent>
                                     </Dialog>
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
      </TabsContent>

      {isAuthorized && (
        <TabsContent value="late-arrivals" className="m-0 focus:outline-none">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 rounded-[32px] p-4 md:p-6 shadow-xl dark:shadow-none">
             <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                 <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Time-Wise Late Arrivals</h2>
                 <p className="text-sm text-muted-foreground font-medium">Filter employees who checked in after a specific time.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
                 <input 
                   type="date" 
                   value={filterDate}
                   onChange={e => setFilterDate(e.target.value)}
                   className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-bold shadow-sm"
                 />
                 <span className="text-sm font-bold text-muted-foreground hidden sm:inline">After:</span>
                 <input 
                   type="time" 
                   value={filterTime}
                   onChange={e => setFilterTime(e.target.value)}
                   className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-bold shadow-sm"
                 />
              </div>
           </div>
           
           {lateCheckIns.length > 0 ? (
             <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800 -mx-4 md:mx-0">
               <Table className="min-w-full">
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                     <TableRow>
                        <TableHead className="pl-4 md:pl-6 font-black uppercase text-[10px] tracking-widest whitespace-nowrap">Employee</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest whitespace-nowrap">Department</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-4 md:pr-6 whitespace-nowrap">Check-in</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {lateCheckIns.map((a: any) => (
                        <TableRow key={a.id} className="hover:primary/5 transition-colors">
                           <TableCell className="pl-4 md:pl-6 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                             {a.employees?.full_name || a.employee_name || "Unknown"}
                           </TableCell>
                           <TableCell className="font-medium text-muted-foreground text-xs md:text-sm whitespace-nowrap">
                             {a.employees?.department || a.department || "Staff"}
                           </TableCell>
                           <TableCell className="text-right pr-4 md:pr-6 font-black text-rose-500 whitespace-nowrap">
                              {new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
             </div>
           ) : (
             <div className="py-12 text-center flex flex-col items-center justify-center">
               <CheckCircle2 className="size-12 text-emerald-500 mb-4 opacity-50" />
               <p className="text-slate-900 dark:text-white font-bold text-lg">No Late Arrivals</p>
               <p className="text-sm text-muted-foreground mt-1">Everyone checked in before {filterTime} on this date.</p>
             </div>
           )}
        </div>
        </TabsContent>
      )}
      </Tabs>
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
