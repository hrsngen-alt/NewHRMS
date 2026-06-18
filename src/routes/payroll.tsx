import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase = supabaseClient as any;

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { 
  Play, FileDown, Wallet, AlertTriangle, Upload, 
  Settings, CheckCircle2, Mail, Send, RefreshCw, 
  Trash2, ShieldCheck, CalendarRange, Clock, Sparkles, 
  Percent, CircleAlert, Check, HelpCircle, Lock as LockIcon, Unlock as UnlockIcon
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { generatePayslipPDF } from "@/lib/payslip";
import { cn } from "../lib/utils";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/payroll")({ component: () => <AppShell><PayrollPage /></AppShell> });

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const monthsFull = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function PayrollPage() {
  const qc = useQueryClient();
  const { role, user } = useAuth();

  if (role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-card border rounded-2xl p-8 max-w-md mx-auto shadow-elegant">
        <AlertTriangle className="size-12 text-destructive animate-pulse" />
        <h2 className="text-2xl font-black tracking-tight text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground font-medium">This page is restricted to Admin users. If you believe this is an error, please contact support.</p>
      </div>
    );
  }

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selDept, setSelDept] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  // Excel upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [parsedAttendance, setParsedAttendance] = useState<any[]>([]);
  const [detectedAnomalies, setDetectedAnomalies] = useState<any[]>([]);
  const [ignoredAnomalies, setIgnoredAnomalies] = useState<Set<string>>(new Set());

  // Loan state
  const [loanForm, setLoanForm] = useState({ employee_id: "", amount: "", monthly_emi: "" });
  const [addonForm, setAddonForm] = useState({ employee_id: "", incentive: "", overtime_rate: "", other_deductions: "" });

  // Preview State
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewSlips, setPreviewSlips] = useState<any[]>([]);

  // Delivery log simulated state
  const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);
  const [deliveringIds, setDeliveringIds] = useState<Set<string>>(new Set());

  // Core Data Queries
  const { data: runs = [] } = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: async () => (await supabase.from("payroll_runs").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false })).data ?? [],
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-payroll"],
    queryFn: async () => (await supabase.from("employees").select("*").eq("status", "active").order("full_name")).data ?? [],
  });
  
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("department");
      return Array.from(new Set((data ?? []).map((e: any) => e.department).filter(Boolean))) as string[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await supabase.from("company_settings").select("company_name").maybeSingle()).data,
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["loans-list"],
    queryFn: async () => (await supabase.from("loans").select("*, employees(full_name, employee_code)").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: addons = [] } = useQuery({
    queryKey: ["addons-list", month, year],
    queryFn: async () => (await supabase.from("payroll_addons").select("*").eq("period_month", month).eq("period_year", year)).data ?? [],
  });

  const companyName = (settings as any)?.company_name || "SN Gene HR";

  const { data: latestSlips = [] } = useQuery({
    queryKey: ["latest-payslips", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payslips")
        .select("*, employees(department, full_name, employee_code, email, phone), payroll_runs!inner(period_month, period_year, status, approved_by, approved_at, approval_logs)")
        .eq("payroll_runs.period_month", month)
        .eq("payroll_runs.period_year", year);
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeRun = runs.find((r: any) => r.period_month === month && r.period_year === year);

  const deptSummary = useMemo(() => {
    const summary: Record<string, { gross: number; deductions: number; net: number; count: number }> = {};
    latestSlips.forEach((s: any) => {
      const d = s.employees?.department || "Unassigned";
      if (!summary[d]) summary[d] = { gross: 0, deductions: 0, net: 0, count: 0 };
      summary[d].gross += Number(s.gross);
      summary[d].deductions += Number(s.total_deductions);
      summary[d].net += Number(s.net_pay);
      summary[d].count += 1;
    });
    return Object.entries(summary).map(([name, data]) => ({ name, ...data }));
  }, [latestSlips]);

  // Attendance Sheet Excel Upload Parsing
  const handleAttendanceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          toast.error("The uploaded spreadsheet is empty!");
          setUploadLoading(false);
          return;
        }

        // Auto Map Columns: Date, Employee Code, Check In, Check Out
        const keys = Object.keys(rawData[0] as any);
        const codeKey = keys.find(k => k.toLowerCase().replace(/\s+/g, "").includes("code") || k.toLowerCase().replace(/\s+/g, "").includes("id"));
        const dateKey = keys.find(k => k.toLowerCase().includes("date"));
        const inKey = keys.find(k => k.toLowerCase().replace(/\s+/g, "").includes("in"));
        const outKey = keys.find(k => k.toLowerCase().replace(/\s+/g, "").includes("out"));

        if (!codeKey || !dateKey || !inKey || !outKey) {
          toast.error("Required columns ('Code', 'Date', 'In', 'Out') could not be automatically identified.");
          setUploadLoading(false);
          return;
        }

        const parsed: any[] = [];
        const anomalies: any[] = [];
        const graceTime = "09:15"; // standard grace check-in limit

        // Track employee consecutive absence check
        const empDatesMap: Record<string, Set<string>> = {};

        rawData.forEach((row: any, index: number) => {
          const empCode = String(row[codeKey]).trim();
          let rawDate = row[dateKey];
          let checkIn = row[inKey];
          let checkOut = row[outKey];

          if (!empCode || !rawDate) return;

          // Normalize Date to YYYY-MM-DD
          let dateStr = "";
          if (rawDate instanceof Date) {
            dateStr = rawDate.toISOString().slice(0, 10);
          } else {
            dateStr = String(rawDate).trim();
          }

          if (!empDatesMap[empCode]) empDatesMap[empCode] = new Set();
          empDatesMap[empCode].add(dateStr);

          // Normalize Check In / Check Out Times
          let checkInStr = checkIn ? String(checkIn).trim() : null;
          let checkOutStr = checkOut ? String(checkOut).trim() : null;

          let hoursWorked = 0;
          let isLate = false;
          let lateMinutes = 0;
          let isHalfDay = false;
          let status = "present";

          // Calculate hours if both exist
          if (checkInStr && checkOutStr) {
            try {
              const parseTime = (timeStr: string) => {
                const parts = timeStr.replace(/(AM|PM)/i, "").trim().split(":");
                let hr = Number(parts[0]);
                const mn = Number(parts[1] || 0);
                if (timeStr.toLowerCase().includes("pm") && hr < 12) hr += 12;
                if (timeStr.toLowerCase().includes("am") && hr === 12) hr = 0;
                return { hr, mn };
              };

              const inTime = parseTime(checkInStr);
              const outTime = parseTime(checkOutStr);

              const inVal = inTime.hr * 60 + inTime.mn;
              const outVal = outTime.hr * 60 + outTime.mn;

              hoursWorked = Math.max(0, (outVal - inVal) / 60);

              // grace calculation: check-in is late if after 09:15 AM
              const graceLimitVal = 9 * 60 + 15;
              if (inVal > graceLimitVal) {
                isLate = true;
                lateMinutes = inVal - graceLimitVal;
              }

              if (hoursWorked < 4) {
                isHalfDay = false;
                status = "absent"; // too short shifts counted as absent
              } else if (hoursWorked < 8) {
                isHalfDay = true;
                status = "half_day";
              }
            } catch (err) {
              console.error("Time parsing error at index:", index, err);
            }
          }

          // Detect Anomaly 1: Missing Check-out or Check-in
          if (checkInStr && !checkOutStr) {
            anomalies.push({
              id: `${empCode}-${dateStr}-missing-out`,
              employee_code: empCode,
              date: dateStr,
              type: "Missing Check-out",
              severity: "warning",
              description: `Employee checked in at ${checkInStr} but has no checkout log.`
            });
          } else if (!checkInStr && checkOutStr) {
            anomalies.push({
              id: `${empCode}-${dateStr}-missing-in`,
              employee_code: empCode,
              date: dateStr,
              type: "Missing Check-in",
              severity: "warning",
              description: `Employee has a checkout at ${checkOutStr} but no checkin log.`
            });
          }

          // Detect Anomaly 2: Extreme short working hours (less than 4 hours but checkins present)
          if (checkInStr && checkOutStr && hoursWorked < 4) {
            anomalies.push({
              id: `${empCode}-${dateStr}-short-hours`,
              employee_code: empCode,
              date: dateStr,
              type: "Short Working Hours",
              severity: "error",
              description: `Shift duration is only ${hoursWorked.toFixed(1)} hrs. Flagged as LOP absent.`
            });
          }

          // Detect Anomaly 3: Check-in before 06:00 AM or check-out after 11:00 PM
          if (checkInStr) {
            const timeParts = checkInStr.split(":");
            const hr = Number(timeParts[0]);
            if (hr < 6 && !checkInStr.toLowerCase().includes("pm")) {
              anomalies.push({
                id: `${empCode}-${dateStr}-early-in`,
                employee_code: empCode,
                date: dateStr,
                type: "Odd Check-in Hour",
                severity: "info",
                description: `Suspicious early check-in logged at ${checkInStr}.`
              });
            }
          }

          parsed.push({
            employee_code: empCode,
            date: dateStr,
            check_in: checkInStr ? `${dateStr}T${checkInStr.padStart(5, "0")}:00Z` : null,
            check_out: checkOutStr ? `${dateStr}T${checkOutStr.padStart(5, "0")}:00Z` : null,
            status,
            hours_worked: hoursWorked,
            overtime_hours: Math.max(0, hoursWorked - 8),
            is_half_day: isHalfDay,
            is_late: isLate,
            late_minutes: lateMinutes
          });
        });

        // Detect Anomaly 4: High frequency lates (late more than 3 times in month)
        const lateCounts: Record<string, number> = {};
        parsed.forEach((p: any) => {
          if (p.is_late) {
            lateCounts[p.employee_code] = (lateCounts[p.employee_code] || 0) + 1;
          }
        });
        Object.entries(lateCounts).forEach(([code, count]) => {
          if (count > 3) {
            anomalies.push({
              id: `${code}-frequent-late`,
              employee_code: code,
              date: "Monthly Run Summary",
              type: "Frequent Tardiness",
              severity: "info",
              description: `Employee has clocked in late ${count} times during this period.`
            });
          }
        });

        setParsedAttendance(parsed);
        setDetectedAnomalies(anomalies);
        toast.success(`Successfully parsed ${parsed.length} logs! Verified ${anomalies.length} anomaly cases.`);
      } catch (err: any) {
        console.error(err);
        toast.error("Failed to parse sheet. Please ensure it is in valid formatting.");
      } finally {
        setUploadLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleToggleIgnoreAnomaly = (id: string) => {
    const next = new Set(ignoredAnomalies);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setIgnoredAnomalies(next);
  };

  const handleSaveAttendance = async () => {
    if (parsedAttendance.length === 0) return toast.error("No parsed data to commit.");

    // Filter out rows that have unresolved anomalies (unless explicitly checked as ignored/approved override)
    const activeAnomalies = detectedAnomalies.filter(anom => !ignoredAnomalies.has(anom.id));
    const codesToBlock = new Set(activeAnomalies.map(anom => anom.employee_code));

    const finalUploads: any[] = [];
    let blockedCount = 0;

    for (const p of parsedAttendance) {
      // Find matching employee UUID
      const emp = employees.find((e: any) => e.employee_code === p.employee_code);
      if (!emp) {
        blockedCount++;
        continue;
      }
      
      // If employee has a critical block, skip
      if (codesToBlock.has(p.employee_code)) {
        blockedCount++;
        continue;
      }

      finalUploads.push({
        employee_id: emp.id,
        date: p.date,
        check_in: p.check_in,
        check_out: p.check_out,
        status: p.status,
        hours_worked: p.hours_worked,
        overtime_hours: p.overtime_hours,
        is_half_day: p.is_half_day,
        is_late: p.is_late,
        late_minutes: p.late_minutes
      });
    }

    try {
      // Upsert into database
      const { error } = await supabase.from("attendance").upsert(finalUploads, { onConflict: "employee_id,date" });
      if (error) throw error;

      toast.success(`Uploaded ${finalUploads.length} attendance records. ${blockedCount} items skipped due to blocked anomalies or invalid codes.`);
      setParsedAttendance([]);
      setDetectedAnomalies([]);
      setIgnoredAnomalies(new Set());
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      toast.error(err.message || "Failed to save attendance");
    }
  };

  // Salary Preview Calculations
  const calculatePreview = async () => {
    setIsPreviewMode(true);
    const todayDate = new Date();
    const isFuture = year > todayDate.getFullYear() || (year === todayDate.getFullYear() && month > todayDate.getMonth() + 1);
    if (isFuture) {
      setIsPreviewMode(false);
      return toast.error("Cannot process preview for future months");
    }

    let q = supabase.from("employees").select("*").eq("status", "active");
    if (selDept !== "all") q = q.eq("department", selDept);
    
    const { data: activeEmployees } = await q;
    if (!activeEmployees || activeEmployees.length === 0) {
      setIsPreviewMode(false);
      return toast.error("No active employees found");
    }

    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    const isCurrentMonthYear = todayDate.getMonth() + 1 === month && todayDate.getFullYear() === year;
    const maxDay = isCurrentMonthYear ? todayDate.getDate() : totalDaysInMonth;

    // Fetch dependencies
    const { data: leaves } = await supabase.from("leaves").select("*").eq("status", "approved").lte("start_date", monthEnd).gte("end_date", monthStart);
    const { data: holidays } = await supabase.from("holidays").select("date").gte("date", monthStart).lte("date", monthEnd);
    const { data: att } = await supabase.from("attendance").select("*").gte("date", monthStart).lte("date", monthEnd);
    const { data: activeLoans } = await supabase.from("loans").select("*").eq("is_active", true);

    const holidayDates = new Set((holidays ?? []).map((h: any) => h.date));
    
    // Group attendance details
    const attMap: Record<string, any[]> = {};
    (att ?? []).forEach((a: any) => {
      if (!attMap[a.employee_id]) attMap[a.employee_id] = [];
      attMap[a.employee_id].push(a);
    });

    // Group leaves
    const leavesMap: Record<string, Array<{ start: string; end: string }>> = {};
    (leaves ?? []).forEach((l: any) => {
      if (!leavesMap[l.employee_id]) leavesMap[l.employee_id] = [];
      leavesMap[l.employee_id].push({ start: l.start_date, end: l.end_date });
    });

    const calculatedSlips = activeEmployees.map((e: any) => {
      const empAttendance = attMap[e.id] ?? [];
      const empLeaves = leavesMap[e.id] ?? [];

      let presentCount = 0;
      let lateCount = 0;
      let halfDayCount = 0;
      let overtimeHoursSum = 0;
      let approvedLeaveCount = 0;
      let holidayCount = 0;
      let sundayCount = 0;
      let absentCount = 0;

      // Group attendance dates for lookup
      const dateLogs: Record<string, any> = {};
      empAttendance.forEach(a => {
        dateLogs[a.date] = a;
      });

      for (let d = 1; d <= totalDaysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const dObj = new Date(year, month - 1, d);
        const isSunday = dObj.getDay() === 0;
        const isHoliday = holidayDates.has(dateStr);
        const isLeave = empLeaves.some(l => dateStr >= l.start && dateStr <= l.end);
        const log = dateLogs[dateStr];

        if (d <= maxDay) {
          if (log) {
            if (log.status === "present") presentCount++;
            else if (log.status === "half_day") {
              halfDayCount++;
              presentCount += 0.5;
            } else if (log.status === "absent") {
              absentCount++;
            }
            if (log.is_late) lateCount++;
            overtimeHoursSum += Number(log.overtime_hours || 0);
          } else if (isSunday) {
            sundayCount++;
          } else if (isHoliday) {
            holidayCount++;
          } else if (isLeave) {
            approvedLeaveCount++;
          } else {
            absentCount++; // missing log counts as absent
          }
        } else {
          // Future day (projections)
          if (isSunday) sundayCount++;
          else if (isHoliday) holidayCount++;
          else if (isLeave) approvedLeaveCount++;
          else absentCount++;
        }
      }

      // Math formulas
      const workingDays = 30;
      const isActive = (presentCount + approvedLeaveCount) > 0;
      const paidDays = isActive ? Math.min(workingDays, presentCount + approvedLeaveCount + holidayCount + sundayCount) : 0;
      
      const basic = Number(e.basic_salary);
      const hra = Number(e.hra);
      const conveyance = Number(e.conveyance || 0);
      const medical = Number(e.medical || 0);
      const special = Number(e.special_allowance || 0);

      // Addons (incentives / overtime rate overrides)
      const empAddon = addons.find((ad: any) => ad.employee_id === e.id);
      const incentiveAmt = empAddon ? Number(empAddon.incentive) : 0;
      const otRate = (empAddon && Number(empAddon.overtime_rate) > 0) ? Number(empAddon.overtime_rate) : (basic / 240 * 1.5);
      const otPay = overtimeHoursSum * otRate;

      // Loans Deduction
      const empLoan = activeLoans.find((ln: any) => ln.employee_id === e.id);
      let loanEMI = 0;
      if (empLoan) {
        loanEMI = Math.min(Number(empLoan.monthly_emi), Number(empLoan.outstanding_amount));
      }

      // Calculations
      const grossWithoutAddons = basic + hra + conveyance + medical + special;
      const leaveDeduction = isActive ? Math.round((grossWithoutAddons / workingDays) * (workingDays - paidDays)) : grossWithoutAddons;
      const taxableGross = Math.max(0, grossWithoutAddons - leaveDeduction + otPay + incentiveAmt);

      const pf = paidDays > 0 ? Number(e.pf_amount ?? 0) : 0;
      const esic = (paidDays > 0 && basic <= 21000) ? Number(e.esic_amount ?? 0) : 0;
      const pt = taxableGross > 15000 ? 200 : 0;
      const tds = taxableGross > 50000 ? Math.round(taxableGross * 0.05) : 0;

      const otherDeductions = empAddon ? Number(empAddon.other_deductions) : 0;
      const totalDed = pf + esic + pt + tds + leaveDeduction + loanEMI + otherDeductions;
      const netPay = Math.max(0, taxableGross + conveyance + medical - (pf + esic + pt + tds + loanEMI + otherDeductions));

      return {
        id: e.id,
        employees: { full_name: e.full_name, employee_code: e.employee_code, department: e.department },
        working_days: workingDays,
        paid_days: paidDays,
        absent_days: absentCount,
        half_days: halfDayCount,
        late_marks: lateCount,
        overtime_hours: overtimeHoursSum,
        overtime_pay: otPay,
        incentives: incentiveAmt,
        loan_deductions: loanEMI,
        basic, hra, conveyance, medical, special_allowance: special, bonus: 0,
        pf, esic, pt, tds, leave_deduction: leaveDeduction, other_deductions: otherDeductions,
        gross: taxableGross,
        total_deductions: totalDed,
        net_pay: netPay
      };
    });

    setPreviewSlips(calculatedSlips);
  };

  // Bulk commit generated preview
  const handleCommitPreview = async () => {
    if (previewSlips.length === 0) return;

    try {
      // Create/find Payroll Run
      const { data: run, error: runErr } = await supabase.from("payroll_runs")
        .upsert({ period_month: month, period_year: year, status: "draft", processed_at: new Date().toISOString() }, { onConflict: "period_month,period_year" })
        .select().single();

      if (runErr || !run) throw runErr || new Error("Failed to initialize payroll run.");

      const slipsToUpsert = previewSlips.map((p: any) => ({
        payroll_run_id: run.id,
        employee_id: p.id,
        working_days: p.working_days,
        paid_days: p.paid_days,
        basic: p.basic,
        hra: p.hra,
        conveyance: p.conveyance,
        medical: p.medical,
        special_allowance: p.special_allowance,
        bonus: p.bonus,
        pf: p.pf,
        esic: p.esic,
        pt: p.pt,
        tds: p.tds,
        leave_deduction: p.leave_deduction,
        overtime_hours: p.overtime_hours,
        overtime_pay: p.overtime_pay,
        incentives: p.incentives,
        loan_deductions: p.loan_deductions,
        absent_days: p.absent_days,
        half_days: p.half_days,
        late_marks: p.late_marks,
        gross: p.gross,
        total_deductions: p.total_deductions,
        net_pay: p.net_pay
      }));

      const { error: insErr } = await supabase.from("payslips").upsert(slipsToUpsert, { onConflict: "payroll_run_id,employee_id" });
      if (insErr) throw insErr;

      // Update loans outstanding values
      for (const p of previewSlips) {
        if (p.loan_deductions > 0) {
          const { data: ln } = await supabase.from("loans").select("*").eq("employee_id", p.id).eq("is_active", true).maybeSingle();
          if (ln) {
            const nextOutstanding = Math.max(0, Number(ln.outstanding_amount) - p.loan_deductions);
            await supabase.from("loans").update({ 
              outstanding_amount: nextOutstanding, 
              is_active: nextOutstanding > 0 
            }).eq("id", ln.id);
          }
        }
      }

      const totalNet = slipsToUpsert.reduce((s: number, p: any) => s + p.net_pay, 0);
      await supabase.from("payroll_runs").update({ total_net: totalNet }).eq("id", run.id);

      toast.success(`Successfully processed ${previewSlips.length} employee payslips!`);
      setIsPreviewMode(false);
      setPreviewSlips([]);
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      qc.invalidateQueries({ queryKey: ["latest-payslips"] });
      qc.invalidateQueries({ queryKey: ["loans-list"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to commit payroll run.");
    }
  };

  // Loans Actions
  const handleSanctionLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.employee_id || !loanForm.amount || !loanForm.monthly_emi) {
      return toast.error("Please fill in principal amount and monthly EMI installment.");
    }

    try {
      const payload = {
        employee_id: loanForm.employee_id,
        amount: Number(loanForm.amount),
        monthly_emi: Number(loanForm.monthly_emi),
        outstanding_amount: Number(loanForm.amount),
        is_active: true
      };

      const { error } = await supabase.from("loans").insert(payload);
      if (error) throw error;

      toast.success("Employee loan sanctioned successfully!");
      setLoanForm({ employee_id: "", amount: "", monthly_emi: "" });
      qc.invalidateQueries({ queryKey: ["loans-list"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addonForm.employee_id) return toast.error("Please select an employee.");

    try {
      const payload = {
        employee_id: addonForm.employee_id,
        period_month: month,
        period_year: year,
        incentive: Number(addonForm.incentive || 0),
        overtime_rate: Number(addonForm.overtime_rate || 0),
        other_deductions: Number(addonForm.other_deductions || 0)
      };

      const { error } = await supabase.from("payroll_addons").upsert(payload, { onConflict: "employee_id,period_month,period_year" });
      if (error) throw error;

      toast.success("Compensation configurations saved!");
      setAddonForm({ employee_id: "", incentive: "", overtime_rate: "", other_deductions: "" });
      qc.invalidateQueries({ queryKey: ["addons-list", month, year] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateRunStatus = async (runId: string, nextStatus: "draft" | "pending_review" | "approved" | "locked") => {
    try {
      const logEntry = {
        approved_by: user?.email,
        action: nextStatus,
        comment: `Workflow stage modified to ${nextStatus}`,
        timestamp: new Date().toISOString()
      };

      const currentLogs = activeRun?.approval_logs || [];
      const updatedLogs = [...currentLogs, logEntry];

      const { error } = await supabase.from("payroll_runs")
        .update({ 
          status: nextStatus,
          approved_by: nextStatus === "approved" || nextStatus === "locked" ? user?.id : null,
          approved_at: nextStatus === "approved" || nextStatus === "locked" ? new Date().toISOString() : null,
          approval_logs: updatedLogs
        })
        .eq("id", runId);

      if (error) throw error;
      toast.success(`Payroll period status updated to: ${nextStatus}`);
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      qc.invalidateQueries({ queryKey: ["latest-payslips"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Communications simulated distribution
  const handleSimulateBulkDelivery = async (channel: "email" | "whatsapp") => {
    if (latestSlips.length === 0) return toast.error("No payslips computed to send.");
    
    setDeliveringIds(new Set(latestSlips.map((s: any) => s.id)));
    setDeliveryLogs([]);

    for (const s of latestSlips) {
      const empName = s.employees?.full_name || "Employee";
      const targetVal = channel === "email" ? (s.employees?.email || "N/A") : (s.employees?.phone || "N/A");
      
      // Simulated sending latency
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const newLog = {
        id: s.id,
        employee: empName,
        channel: channel.toUpperCase(),
        destination: targetVal,
        status: "SUCCESS",
        timestamp: new Date().toLocaleTimeString()
      };

      setDeliveryLogs(prev => [newLog, ...prev]);
      setDeliveringIds(prev => {
        const next = new Set(prev);
        next.delete(s.id);
        return next;
      });
    }

    toast.success(`Successfully dispatched ${latestSlips.length} payslips via ${channel.toUpperCase()}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Wallet className="size-10 text-primary" /> Attendance-Based Payroll
          </h1>
          <p className="text-sm font-medium text-muted-foreground/60 mt-1">Configure compensation rates, process monthly attendance uploads, compute statutory deductions, and lock payroll runs.</p>
        </div>
      </div>

      {/* Date & Period Controls Header */}
      <Card className="rounded-2xl border-2 border-primary/5 bg-muted/10">
        <CardContent className="p-6 flex flex-wrap items-end gap-6">
          <div className="space-y-1.5 flex-1 min-w-[150px]">
            <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Select Month</Label>
            <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setIsPreviewMode(false); }}>
              <SelectTrigger className="h-11 rounded-xl bg-background border"><SelectValue /></SelectTrigger>
              <SelectContent>{monthsFull.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[120px]">
            <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Select Year</Label>
            <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setIsPreviewMode(false); }}>
              <SelectTrigger className="h-11 rounded-xl bg-background border"><SelectValue /></SelectTrigger>
              <SelectContent>{[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[180px]">
            <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Department Filter</Label>
            <Select value={selDept} onValueChange={setSelDept}>
              <SelectTrigger className="h-11 rounded-xl bg-background border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={calculatePreview} className="h-11 px-6 rounded-xl font-bold bg-primary hover:bg-primary-glow flex items-center gap-2">
              <Play className="size-4" /> Preview Payroll
            </Button>
            {latestSlips.length > 0 && (
              <Button onClick={() => latestSlips.forEach((s: any) => generatePayslipPDF(s as never, companyName))} variant="outline" className="h-11 rounded-xl font-bold gap-2">
                <FileDown className="size-4" /> Bulk PDFs
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs Control Board */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl h-auto w-full flex flex-wrap justify-start gap-2 mb-8">
          <TabsTrigger value="overview" className="rounded-xl font-bold gap-2 py-2.5 flex-1 max-w-[200px] data-[state=active]:shadow-md">
            <Wallet className="size-4" /> Overview & Preview
          </TabsTrigger>
          <TabsTrigger value="upload" className="rounded-xl font-bold gap-2 py-2.5 flex-1 max-w-[200px] data-[state=active]:shadow-md">
            <Upload className="size-4" /> Attendance Sheet
          </TabsTrigger>
          <TabsTrigger value="addons" className="rounded-xl font-bold gap-2 py-2.5 flex-1 max-w-[200px] data-[state=active]:shadow-md">
            <Settings className="size-4" /> Addons & Loans
          </TabsTrigger>
          <TabsTrigger value="approvals" className="rounded-xl font-bold gap-2 py-2.5 flex-1 max-w-[200px] data-[state=active]:shadow-md">
            <ShieldCheck className="size-4" /> Approval Logs
          </TabsTrigger>
          <TabsTrigger value="delivery" className="rounded-xl font-bold gap-2 py-2.5 flex-1 max-w-[200px] data-[state=active]:shadow-md">
            <Send className="size-4" /> Payslip Delivery
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW & RUN */}
        <TabsContent value="overview" className="space-y-6">
          {isPreviewMode ? (
            <Card className="rounded-2xl border-2 border-amber-500/20 bg-amber-500/5 shadow-card overflow-hidden">
              <CardHeader className="bg-amber-500/10 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <CircleAlert className="size-5 text-amber-500" /> Payroll Calculation Preview
                  </CardTitle>
                  <CardDescription className="text-xs text-amber-700/80 dark:text-amber-400/80">Review working days, deductions, and incentives variables before committing to databases.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setIsPreviewMode(false)} className="rounded-xl font-bold text-amber-800 dark:text-amber-300">Cancel</Button>
                  <Button onClick={handleCommitPreview} className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold px-6">Commit Payroll Run</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="pl-6 font-bold text-[10px] text-slate-800 dark:text-slate-200">Employee</TableHead>
                      <TableHead className="text-center font-bold text-[10px] text-slate-800 dark:text-slate-200">Paid / Absent</TableHead>
                      <TableHead className="text-center font-bold text-[10px] text-slate-800 dark:text-slate-200">Lates / Half</TableHead>
                      <TableHead className="text-center font-bold text-[10px] text-slate-800 dark:text-slate-200">OT Pay</TableHead>
                      <TableHead className="text-center font-bold text-[10px] text-slate-800 dark:text-slate-200">Incentives</TableHead>
                      <TableHead className="text-center font-bold text-[10px] text-slate-800 dark:text-slate-200">Loans</TableHead>
                      <TableHead className="text-center font-bold text-[10px] text-slate-800 dark:text-slate-200">LOP Ded.</TableHead>
                      <TableHead className="text-center font-bold text-[10px] text-slate-800 dark:text-slate-200">Gross Pay</TableHead>
                      <TableHead className="text-right pr-6 font-bold text-[10px] text-slate-800 dark:text-slate-200">Net Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y">
                    {previewSlips.map((p: any) => (
                      <TableRow key={p.id} className="hover:bg-amber-500/5">
                        <TableCell className="pl-6 py-4">
                          <p className="font-bold text-sm text-foreground">{p.employees.full_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{p.employees.employee_code}</p>
                        </TableCell>
                        <TableCell className="text-center font-medium text-xs">
                          {p.paid_days} <span className="text-muted-foreground">/</span> <span className="text-rose-500">{p.absent_days}</span>
                        </TableCell>
                        <TableCell className="text-center font-medium text-xs">
                          {p.late_marks} <span className="text-muted-foreground">/</span> {p.half_days}
                        </TableCell>
                        <TableCell className="text-center text-xs font-semibold">₹{p.overtime_pay.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-center text-xs font-semibold text-emerald-600">₹{p.incentives.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-center text-xs font-semibold text-rose-500">₹{p.loan_deductions.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-center text-xs font-semibold text-rose-500">₹{p.leave_deduction.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-center text-xs font-semibold">₹{p.gross.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right pr-6 font-bold text-sm text-primary">₹{p.net_pay.toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Quick Metrics Cards */}
              <div className="grid gap-6 md:grid-cols-4">
                <Card className="rounded-2xl border-2 border-primary/5 shadow-card bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Net Payouts</span>
                    <Wallet className="size-4 text-primary" />
                  </div>
                  <h3 className="text-3xl font-black mt-4">
                    ₹{latestSlips.reduce((s: number, p: any) => s + Number(p.net_pay), 0).toLocaleString("en-IN")}
                  </h3>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 mt-1">Total distributed net pay</p>
                </Card>
                <Card className="rounded-2xl border-2 border-primary/5 shadow-card bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Addon Incentives</span>
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <h3 className="text-3xl font-black mt-4">
                    ₹{latestSlips.reduce((s: number, p: any) => s + Number(p.incentives || 0), 0).toLocaleString("en-IN")}
                  </h3>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 mt-1">Paid performance bonus</p>
                </Card>
                <Card className="rounded-2xl border-2 border-primary/5 shadow-card bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Overtime Paid</span>
                    <Clock className="size-4 text-primary" />
                  </div>
                  <h3 className="text-3xl font-black mt-4">
                    ₹{latestSlips.reduce((s: number, p: any) => s + Number(p.overtime_pay || 0), 0).toLocaleString("en-IN")}
                  </h3>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 mt-1">Additional OT hours earnings</p>
                </Card>
                <Card className="rounded-2xl border-2 border-primary/5 shadow-card bg-card p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Loan Deductions</span>
                    <Percent className="size-4 text-primary" />
                  </div>
                  <h3 className="text-3xl font-black mt-4">
                    ₹{latestSlips.reduce((s: number, p: any) => s + Number(p.loan_deductions || 0), 0).toLocaleString("en-IN")}
                  </h3>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 mt-1">Monthly EMIs recovered</p>
                </Card>
              </div>

              {/* Department Table Summary */}
              {deptSummary.length > 0 && (
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="bg-muted/20 px-6 py-4 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Department-wise Summary ({months[month-1]} {year})</h3>
                    <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">{deptSummary.length} Departments</span>
                  </div>
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="pl-6 font-bold text-[10px]">Department</TableHead>
                        <TableHead className="text-center font-bold text-[10px]">Employees</TableHead>
                        <TableHead className="text-right font-bold text-[10px]">Total Gross</TableHead>
                        <TableHead className="text-right font-bold text-[10px]">Total Ded.</TableHead>
                        <TableHead className="text-right pr-6 font-bold text-[10px]">Net Payout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deptSummary.map((d) => (
                        <TableRow key={d.name}>
                          <TableCell className="font-bold pl-6 text-sm">{d.name}</TableCell>
                          <TableCell className="text-center font-semibold text-sm">{d.count}</TableCell>
                          <TableCell className="text-right font-medium text-sm">₹{d.gross.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-right text-rose-500 font-medium text-sm">₹{d.deductions.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-right font-black pr-6 text-sm text-primary">₹{d.net.toLocaleString("en-IN")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Recent Payroll Runs History */}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="bg-muted/20 px-6 py-4 border-b">
                  <h3 className="font-semibold text-sm">Recent Payroll Runs</h3>
                </div>
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] text-foreground pl-6">Payroll Period</TableHead>
                      <TableHead className="font-bold text-[10px] text-foreground">Workflow Status</TableHead>
                      <TableHead className="text-right font-bold text-[10px] text-foreground">Total Net Payout</TableHead>
                      <TableHead className="text-right font-bold text-[10px] text-foreground pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((r: any) => (
                      <TableRow key={r.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="font-bold pl-6 text-sm">{monthsFull[r.period_month - 1]} {r.period_year}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest border",
                            r.status === "locked" ? "bg-slate-100 text-slate-700 border-slate-200" :
                            r.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            r.status === "pending_review" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            {r.status.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-sm">₹{Number(r.total_net).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => downloadAll(r.id)} className="h-9 gap-1.5 border-primary/20 text-primary hover:bg-primary/5">
                              <FileDown className="size-3.5" /> Download Slips
                            </Button>
                            {r.status !== "locked" && (
                              <Button size="sm" variant="outline" onClick={() => handleUpdateRunStatus(r.id, "locked")} className="h-9 gap-1.5 border-rose-200 text-rose-500 hover:bg-rose-50">
                                <LockIcon className="size-3.5" /> Lock Period
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {runs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Wallet className="size-10 text-muted-foreground/30" />
                            <p className="text-muted-foreground font-semibold">No payroll periods generated yet.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        {/* TAB 2: BULK ATTENDANCE SHEET UPLOAD */}
        <TabsContent value="upload" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Area */}
            <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden lg:col-span-1">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <Upload className="size-4 text-primary" /> Import Excel Sheet
                </CardTitle>
                <CardDescription className="text-xs">Select monthly attendance logs spreadsheet.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div 
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-primary/20 hover:border-primary/50 transition-all rounded-xl p-8 text-center cursor-pointer bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center gap-3"
                >
                  <Upload className="size-8 text-muted-foreground animate-bounce" />
                  <p className="text-xs font-bold text-foreground">Click to upload spreadsheet</p>
                  <p className="text-[10px] text-muted-foreground/75 uppercase tracking-widest">Excel / CSV formats</p>
                  <input type="file" accept=".xlsx, .xls, .csv" ref={fileRef} onChange={handleAttendanceUpload} className="hidden" />
                </div>
                
                {parsedAttendance.length > 0 && (
                  <div className="space-y-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                    <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-500" /> Upload Verification Complete
                    </h4>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Ready to commit {parsedAttendance.length} records to Supabase storage. skipped anomalies will be omitted.</p>
                    <Button onClick={handleSaveAttendance} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 mt-2 font-bold text-xs">Save & Commit Logs</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Anomaly Detection Grid */}
            <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden lg:col-span-2">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" /> Attendance Anomalies & Overrides
                </CardTitle>
                <CardDescription className="text-xs">Identify log errors, short hours, or tardiness. Approve overrides to exclude them from LOP deductions.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto max-h-[350px]">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-transparent">
                      <TableHead className="pl-6 font-bold text-[10px]">Emp Code</TableHead>
                      <TableHead className="font-bold text-[10px]">Date</TableHead>
                      <TableHead className="font-bold text-[10px]">Anomaly Type</TableHead>
                      <TableHead className="font-bold text-[10px]">Details</TableHead>
                      <TableHead className="pr-6 text-right font-bold text-[10px]">Override Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y">
                    {detectedAnomalies.map((anom) => {
                      const isIgnored = ignoredAnomalies.has(anom.id);
                      return (
                        <TableRow key={anom.id} className={cn("hover:bg-muted/5", isIgnored && "opacity-60 bg-emerald-500/5")}>
                          <TableCell className="pl-6 font-bold text-xs text-foreground py-3">{anom.employee_code}</TableCell>
                          <TableCell className="text-xs font-mono">{anom.date}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "inline-flex px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border",
                              anom.severity === "error" ? "bg-rose-50 text-rose-600 border-rose-100" :
                              anom.severity === "warning" ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-blue-50 text-blue-600 border-blue-100"
                            )}>
                              {anom.type}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-medium max-w-[200px] truncate" title={anom.description}>
                            {anom.description}
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <Button 
                              variant={isIgnored ? "outline" : "ghost"}
                              size="sm"
                              onClick={() => handleToggleIgnoreAnomaly(anom.id)}
                              className={cn(
                                "h-8 rounded-lg font-bold text-xs gap-1.5",
                                isIgnored ? "border-emerald-200 text-emerald-600 bg-emerald-50" : "hover:text-emerald-600 hover:bg-emerald-50"
                              )}
                            >
                              {isIgnored ? <Check className="size-3" /> : <HelpCircle className="size-3" />}
                              {isIgnored ? "Authorized" : "Authorize"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {detectedAnomalies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-16 text-center text-xs text-muted-foreground italic">
                          No unresolved attendance anomalies found. Upload a sheet to scan.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: ADDONS & LOANS */}
        <TabsContent value="addons" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sanction Loans Form */}
            <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <Wallet className="size-4 text-primary" /> Loan Sanctioning & recovery
                </CardTitle>
                <CardDescription className="text-xs">Sanction employee loans. Monthly EMIs will auto-deduct during payroll run.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSanctionLoan} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Select Employee</Label>
                    <Select value={loanForm.employee_id} onValueChange={(val) => setLoanForm({ ...loanForm, employee_id: val })}>
                      <SelectTrigger className="h-11 rounded-xl bg-background border"><SelectValue placeholder="Select Employee" /></SelectTrigger>
                      <SelectContent>
                        {employees.map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Principal Amount</Label>
                      <Input type="number" placeholder="₹ Amount" value={loanForm.amount} onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })} className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Monthly EMI Installment</Label>
                      <Input type="number" placeholder="₹ Monthly Pay" value={loanForm.monthly_emi} onChange={(e) => setLoanForm({ ...loanForm, monthly_emi: e.target.value })} className="h-11 rounded-xl" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary-glow font-bold h-11 rounded-xl">Sanction Active Loan</Button>
                </form>

                {/* Active Loans Table */}
                <div className="mt-8 border rounded-xl overflow-hidden">
                  <Table className="w-full">
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                      <TableRow>
                        <TableHead className="pl-4 font-bold text-[10px]">Employee</TableHead>
                        <TableHead className="font-bold text-[10px]">Sanctioned</TableHead>
                        <TableHead className="font-bold text-[10px]">EMI</TableHead>
                        <TableHead className="pr-4 text-right font-bold text-[10px]">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y text-xs">
                      {loans.map((ln: any) => (
                        <TableRow key={ln.id}>
                          <TableCell className="pl-4 font-bold py-3">
                            {ln.employees?.full_name}
                            <p className="text-[9px] text-muted-foreground font-mono">{ln.employees?.employee_code}</p>
                          </TableCell>
                          <TableCell>₹{Number(ln.amount).toLocaleString("en-IN")}</TableCell>
                          <TableCell>₹{Number(ln.monthly_emi).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="pr-4 text-right font-bold text-rose-500">₹{Number(ln.outstanding_amount).toLocaleString("en-IN")}</TableCell>
                        </TableRow>
                      ))}
                      {loans.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center italic text-muted-foreground">
                            No active loans found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Compensation Adjustments Form */}
            <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <Settings className="size-4 text-primary" /> Monthly Adjustments & Addons
                </CardTitle>
                <CardDescription className="text-xs">Adjust employee incentives, manual deductions, and custom overtime rates for {monthsFull[month-1]} {year}.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSaveAddon} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Select Employee</Label>
                    <Select value={addonForm.employee_id} onValueChange={(val) => setAddonForm({ ...addonForm, employee_id: val })}>
                      <SelectTrigger className="h-11 rounded-xl bg-background border"><SelectValue placeholder="Select Employee" /></SelectTrigger>
                      <SelectContent>
                        {employees.map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Incentive Pay</Label>
                      <Input type="number" placeholder="₹ Addon" value={addonForm.incentive} onChange={(e) => setAddonForm({ ...addonForm, incentive: e.target.value })} className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Custom OT Rate / Hr</Label>
                      <Input type="number" placeholder="Auto" value={addonForm.overtime_rate} onChange={(e) => setAddonForm({ ...addonForm, overtime_rate: e.target.value })} className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Other Deductions</Label>
                      <Input type="number" placeholder="₹ Deduct" value={addonForm.other_deductions} onChange={(e) => setAddonForm({ ...addonForm, other_deductions: e.target.value })} className="h-11 rounded-xl" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary-glow font-bold h-11 rounded-xl">Save Adjustments</Button>
                </form>

                {/* Adjustments Overview list */}
                <div className="mt-8 border rounded-xl overflow-hidden">
                  <Table className="w-full">
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                      <TableRow>
                        <TableHead className="pl-4 font-bold text-[10px]">Employee</TableHead>
                        <TableHead className="font-bold text-[10px]">Incentive</TableHead>
                        <TableHead className="font-bold text-[10px]">OT Rate</TableHead>
                        <TableHead className="pr-4 text-right font-bold text-[10px]">Deduction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y text-xs">
                      {addons.map((ad: any) => {
                        const empName = employees.find((e: any) => e.id === ad.employee_id)?.full_name || "Employee";
                        return (
                          <TableRow key={ad.id}>
                            <TableCell className="pl-4 font-bold py-3">{empName}</TableCell>
                            <TableCell className="text-emerald-600 font-semibold">+₹{Number(ad.incentive).toLocaleString("en-IN")}</TableCell>
                            <TableCell>{ad.overtime_rate > 0 ? `₹${ad.overtime_rate}/hr` : "Standard"}</TableCell>
                            <TableCell className="pr-4 text-right text-rose-500 font-semibold">-₹{Number(ad.other_deductions).toLocaleString("en-IN")}</TableCell>
                          </TableRow>
                        );
                      })}
                      {addons.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center italic text-muted-foreground">
                            No custom adjustments logged for this period.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: APPROVAL WORKFLOWS */}
        <TabsContent value="approvals" className="space-y-6">
          <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Payroll Period Approvals
              </CardTitle>
              <CardDescription className="text-xs">Lock runs after review to prevent duplicate calculations and record audit steps history.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {activeRun ? (
                <div className="space-y-8">
                  {/* Status strip */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-xl bg-slate-50 dark:bg-slate-900/50">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-black tracking-widest">Active Period</p>
                      <h4 className="font-bold text-lg text-foreground mt-0.5">{monthsFull[month-1]} {year}</h4>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-black tracking-widest text-right">Workflow Status</p>
                      <span className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider border mt-1",
                        activeRun.status === "locked" ? "bg-slate-100 text-slate-700 border-slate-200" :
                        activeRun.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        activeRun.status === "pending_review" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
                      )}>
                        {activeRun.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {activeRun.status === "draft" && (
                        <Button onClick={() => handleUpdateRunStatus(activeRun.id, "pending_review")} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-4 font-bold text-xs">Submit for Review</Button>
                      )}
                      {activeRun.status === "pending_review" && (
                        <Button onClick={() => handleUpdateRunStatus(activeRun.id, "approved")} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4 font-bold text-xs">Approve Run</Button>
                      )}
                      {activeRun.status === "approved" && (
                        <Button onClick={() => handleUpdateRunStatus(activeRun.id, "locked")} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-10 px-4 font-bold text-xs">Lock Payroll</Button>
                      )}
                      {activeRun.status !== "draft" && (
                        <Button onClick={() => handleUpdateRunStatus(activeRun.id, "draft")} variant="ghost" className="h-10 text-xs font-bold rounded-xl text-muted-foreground hover:text-foreground">Revert Draft</Button>
                      )}
                    </div>
                  </div>

                  {/* Log Trail */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Approval Log Trail</h4>
                    <div className="border rounded-xl divide-y">
                      {(activeRun.approval_logs || []).map((log: any, idx: number) => (
                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors text-xs">
                          <div>
                            <p className="font-bold text-foreground capitalize">Stage: {log.action.replace("_", " ")}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{log.comment}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">{log.approved_by}</p>
                            <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{new Date(log.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                      {(activeRun.approval_logs || []).length === 0 && (
                        <div className="p-8 text-center text-muted-foreground italic">
                          No audit workflow activities logged for this run period.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-muted-foreground italic text-sm">
                  Please trigger a preview calculation or execute a payroll run for this period first to initialize approval workflows.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: DELIVERY CONSOLE */}
        <TabsContent value="delivery" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Delivery triggers */}
            <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden lg:col-span-1">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <Send className="size-4 text-primary" /> Delivery Broadcast Console
                </CardTitle>
                <CardDescription className="text-xs">Distribute dynamic salary slips to active employee profiles.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Button 
                    onClick={() => handleSimulateBulkDelivery("email")}
                    disabled={deliveringIds.size > 0 || latestSlips.length === 0}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2"
                  >
                    <Mail className="size-4" /> Email Payslips ({latestSlips.length})
                  </Button>
                  <Button 
                    onClick={() => handleSimulateBulkDelivery("whatsapp")}
                    disabled={deliveringIds.size > 0 || latestSlips.length === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2"
                  >
                    <Send className="size-4" /> WhatsApp Payslips ({latestSlips.length})
                  </Button>
                </div>

                {deliveringIds.size > 0 && (
                  <div className="p-4 bg-muted/40 rounded-xl space-y-2 border">
                    <p className="text-xs font-bold text-foreground animate-pulse">Dispatched batch in progress...</p>
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300" 
                        style={{ width: `${((latestSlips.length - deliveringIds.size) / latestSlips.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Simulated Logs Report */}
            <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden lg:col-span-2">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" /> Dispatch Delivery Logs
                </CardTitle>
                <CardDescription className="text-xs">Real-time status updates of notifications delivery.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto max-h-[350px]">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-transparent">
                      <TableHead className="pl-6 font-bold text-[10px]">Employee</TableHead>
                      <TableHead className="font-bold text-[10px]">Channel</TableHead>
                      <TableHead className="font-bold text-[10px]">Contact Info</TableHead>
                      <TableHead className="font-bold text-[10px]">Status</TableHead>
                      <TableHead className="pr-6 text-right font-bold text-[10px]">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y text-xs">
                    {deliveryLogs.map((log, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="pl-6 py-3 font-bold">{log.employee}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black border",
                            log.channel === "EMAIL" ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                          )}>
                            {log.channel}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">{log.destination}</TableCell>
                        <TableCell className="text-emerald-600 font-bold flex items-center gap-1"><Check className="size-3.5" /> {log.status}</TableCell>
                        <TableCell className="pr-6 text-right font-mono text-muted-foreground">{log.timestamp}</TableCell>
                      </TableRow>
                    ))}
                    {deliveryLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-16 text-center text-xs text-muted-foreground italic">
                          No delivery triggers fired for this active session.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Download payslips utility
const downloadAll = async (runId: string) => {
  const { data } = await supabase.from("payslips").select("*, payroll_runs(period_month, period_year), employees(*)").eq("payroll_run_id", runId);
  (data ?? []).forEach((p: any) => generatePayslipPDF(p as never, (p.employees?.bank_name ? "SN Gene HR" : "SN Gene HR")));
  toast.success(`Generated PDF salary slips for ${data?.length ?? 0} employees!`);
};
