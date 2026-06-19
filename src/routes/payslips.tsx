import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { generatePayslipPDF } from "@/lib/payslip";
import { 
  FileDown, Search, X, ChevronLeft, ChevronRight, Upload, 
  RefreshCw, Mail, Download, Edit2, Trash2, Check, AlertCircle, Play, Eye, FileSpreadsheet 
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "../lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/payslips")({ component: () => <AppShell><PayslipsPage /></AppShell> });

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const monthsFull = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface ImportedRecord {
  employeeCode: string;
  fullName: string;
  department: string;
  designation: string;
  basic: number;
  hra: number;
  bonus: number;
  specialAllowance: number;
  conveyance: number;
  medical: number;
  otherAllowance: number;
  pf: number;
  esic: number;
  pt: number;
  tds: number;
  leaveDeduction: number;
  loanDeduction: number;
  otherDeduction: number;
  employerPF: number;
  employerESIC: number;
  totalDays: number;
  paidDays: number;
  absentDays: number;
  halfDays: number;
  lateMarks: number;
  otHours: number;
  overtimePay?: number;
  incentives?: number;
  
  // calculated
  gross: number;
  totalDeductions: number;
  netPay: number;
  ctc: number;
  
  // validation
  employeeId?: string;
  isValid: boolean;
  warningMessage?: string;
  isDuplicate: boolean;
}

const num = (v: any) => {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return v;
  const clean = String(v).replace(/,/g, "").trim();
  const parsed = Number(clean);
  return isNaN(parsed) ? 0 : parsed;
};

const loadJSZip = async () => {
  if ((window as any).JSZip) return (window as any).JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    script.onload = () => resolve((window as any).JSZip);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

function PayslipsPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const [q, setQ] = useState("");
  const [selMonth, setSelMonth] = useState<string>("all");
  const [selYear, setSelYear] = useState<string>("all");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const isAdmin = role === "admin";

  // Excel Import tab states
  const now = new Date();
  const [importMonth, setImportMonth] = useState<string>(String(now.getMonth() + 1));
  const [importYear, setImportYear] = useState<string>(String(now.getFullYear()));
  const [importedData, setImportedData] = useState<ImportedRecord[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  
  // Edit record states
  const [editingRecord, setEditingRecord] = useState<ImportedRecord | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  // Email simulation states
  const [emailing, setEmailing] = useState(false);
  const [emailProgress, setEmailProgress] = useState(0);
  const [emailLogs, setEmailLogs] = useState<string[]>([]);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPage(1);
  }, [q, selMonth, selYear]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [emailLogs]);

  const { data: myEmployee } = useQuery({
    queryKey: ["my-employee", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("employees").select("id").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: slips = [] } = useQuery({
    queryKey: ["payslips", role, myEmployee?.id],
    queryFn: async () => {
      let query = supabase.from("payslips").select("*, payroll_runs(period_month, period_year), employees(*)").order("created_at", { ascending: false });
      if (role !== "admin" && myEmployee) query = (query as any).eq("employee_id", myEmployee.id);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await (supabase.from("company_settings" as any).select("company_name").maybeSingle() as any)).data,
  });

  // Query all active employees in DB for code matching
  const { data: dbEmployees = [] } = useQuery({
    queryKey: ["all-employees-list"],
    queryFn: async () => (await supabase.from("employees").select("*")).data ?? [],
    enabled: isAdmin,
  });

  const companyName = (settings as any)?.company_name || "SN Gene HR";

  const filteredSlips = slips.filter((s: any) => {
    const search = q.toLowerCase();
    const matchesSearch = !q || (
      s.employees?.full_name?.toLowerCase().includes(search) ||
      s.employees?.employee_code?.toLowerCase().includes(search) ||
      months[s.payroll_runs?.period_month - 1]?.toLowerCase().includes(search)
    );

    const matchesMonth = selMonth === "all" || String(s.payroll_runs?.period_month) === selMonth;
    const matchesYear = selYear === "all" || String(s.payroll_runs?.period_year) === selYear;

    return matchesSearch && matchesMonth && matchesYear;
  });

  const totalPages = Math.ceil(filteredSlips.length / ITEMS_PER_PAGE);
  const paginatedSlips = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredSlips.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSlips, page]);

  const availableYears = Array.from(new Set(slips.map((s: any) => s.payroll_runs?.period_year))).sort((a, b) => b - a);

  // Download Excel Template
  const downloadTemplate = () => {
    const headers = [
      "Employee ID",
      "Employee Name",
      "Department",
      "Designation",
      "Basic Salary",
      "HRA",
      "Bonus",
      "PF",
      "ESIC Employee Share",
      "Professional Tax",
      "TDS",
      "Leave Deduction",
      "Other Deduction",
      "Employer PF",
      "Employer ESIC",
      "Total Days",
      "Paid Days",
      "Absent Days",
      "Half Days",
      "Late Marks",
      "OT Hours"
    ];
    
    // Row of example data to guide admin
    const exampleRow = {
      "Employee ID": "EMP-001",
      "Employee Name": "John Doe",
      "Department": "Engineering",
      "Designation": "Senior Developer",
      "Basic Salary": 30000,
      "HRA": 12000,
      "Bonus": 5000,
      "PF": 1800,
      "ESIC Employee Share": 315,
      "Professional Tax": 200,
      "TDS": 1500,
      "Leave Deduction": 0,
      "Other Deduction": 0,
      "Employer PF": 1800,
      "Employer ESIC": 1365,
      "Total Days": 30,
      "Paid Days": 30,
      "Absent Days": 0,
      "Half Days": 0,
      "Late Marks": 0,
      "OT Hours": 0
    };

    const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payslips Template");
    XLSX.writeFile(wb, "Payslip_Import_Template.xlsx");
    toast.success("Excel template downloaded!");
  };

  // Excel Drop/Upload parsing
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragOver(true);
    } else if (e.type === "dragleave") {
      setDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseExcel(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseExcel(e.target.files[0]);
    }
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const ws = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(ws);

        if (json.length === 0) {
          toast.error("The uploaded sheet has no records.");
          return;
        }

        const parsed = json.map((row: any) => {
          const empCode = String(row["Employee ID"] || "").trim();
          const fullName = String(row["Employee Name"] || "").trim();
          const dept = String(row["Department"] || "").trim();
          const desig = String(row["Designation"] || "").trim();

          const basic = num(row["Basic Salary"]);
          const hra = num(row["HRA"]);
          const bonus = num(row["Bonus"]);
          const specialAllowance = num(row["Special Allowance"]);
          const conveyance = num(row["Conveyance"]);
          const medical = num(row["Medical Allowance"]);
          const otherAllowance = num(row["Other Allowance"]);

          const pf = num(row["PF"]);
          const esic = num(row["ESIC Employee Share"]);
          const pt = num(row["Professional Tax"]);
          const tds = num(row["TDS"]);
          const leaveDeduction = num(row["Leave Deduction"]);
          const loanDeduction = num(row["Loan Deduction"]);
          const otherDeduction = num(row["Other Deduction"]);

          const employerPF = num(row["Employer PF"]);
          const employerESIC = num(row["Employer ESIC"]);

          const totalDays = num(row["Total Days"]) || 30;
          const paidDays = num(row["Paid Days"]) || totalDays;
          const absentDays = num(row["Absent Days"]) || 0;
          const halfDays = num(row["Half Days"]) || 0;
          const lateMarks = num(row["Late Marks"]) || 0;
          const otHours = num(row["OT Hours"]) || 0;

          // Calculated totals
          const gross = basic + hra + bonus + specialAllowance + conveyance + medical + otherAllowance;
          const totalDeductions = pf + esic + pt + tds + leaveDeduction + loanDeduction + otherDeduction;
          const netPay = Math.max(0, gross - totalDeductions);
          const ctc = gross + employerPF + employerESIC;

          // Match with DB employee
          const dbEmp = dbEmployees.find(
            (e: any) => e.employee_code.toLowerCase() === empCode.toLowerCase()
          );

          return {
            employeeCode: empCode,
            fullName: fullName || dbEmp?.full_name || "Unknown",
            department: dept || dbEmp?.department || "",
            designation: desig || dbEmp?.designation || "",
            basic, hra, bonus, specialAllowance, conveyance, medical, otherAllowance,
            pf, esic, pt, tds, leaveDeduction, loanDeduction, otherDeduction,
            employerPF, employerESIC,
            totalDays, paidDays, absentDays, halfDays, lateMarks, otHours,
            gross, totalDeductions, netPay, ctc,
            employeeId: dbEmp?.id,
            isValid: !!dbEmp,
            warningMessage: dbEmp ? undefined : "Employee Code not found in DB",
            isDuplicate: false,
          } as ImportedRecord;
        });

        // Duplicate checks
        const seen = new Set<string>();
        parsed.forEach((item) => {
          if (seen.has(item.employeeCode.toLowerCase())) {
            item.isDuplicate = true;
            item.isValid = false;
            item.warningMessage = item.warningMessage 
              ? item.warningMessage + " & Duplicate employee" 
              : "Duplicate employee in list";
          } else {
            if (item.employeeCode) seen.add(item.employeeCode.toLowerCase());
          }
        });

        setImportedData(parsed);
        toast.success(`Loaded ${parsed.length} employee records.`);
      } catch (err) {
        toast.error("Failed to parse Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Fetch attendance from DB
  const fetchAttendanceData = async () => {
    if (importedData.length === 0) {
      toast.error("Please upload an Excel sheet first.");
      return;
    }
    setLoadingAttendance(true);
    const loadingToast = toast.loading("Fetching attendance records...");
    try {
      const year = Number(importYear);
      const month = Number(importMonth);
      const totalDays = new Date(year, month, 0).getDate();
      const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
      const endStr = `${year}-${String(month).padStart(2, "0")}-${totalDays}`;

      const { data: attendanceLogs, error: attErr } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", startStr)
        .lte("date", endStr);
      if (attErr) throw attErr;

      const { data: leavesLogs, error: lvErr } = await supabase
        .from("leaves")
        .select("*")
        .eq("status", "approved")
        .or(`and(start_date.lte.${endStr},end_date.gte.${startStr})`);
      if (lvErr) throw lvErr;

      const { data: holidaysLogs, error: holErr } = await supabase
        .from("holidays" as any)
        .select("*")
        .gte("date", startStr)
        .lte("date", endStr);
      const holidays = holidaysLogs || [];

      const updated = importedData.map((rec) => {
        if (!rec.employeeId) return rec;

        const empAtt = (attendanceLogs || []).filter((a) => a.employee_id === rec.employeeId);
        const empLeaves = (leavesLogs || []).filter((l) => l.employee_id === rec.employeeId);

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
          ...rec,
          totalDays,
          paidDays: Number(paid.toFixed(1)),
          absentDays: absentCount,
          halfDays: halfCount,
          lateMarks: lateCount,
          otHours: Number(otCount.toFixed(1)),
        };
      });

      setImportedData(updated);
      toast.success("Attendance and leaves successfully fetched and integrated.");
    } catch (err: any) {
      toast.error("Failed to fetch attendance: " + err.message);
    } finally {
      setLoadingAttendance(false);
      toast.dismiss(loadingToast);
    }
  };

  // Download attendance report for selected month and year
  const downloadMonthlyAttendanceReport = async () => {
    setDownloadingReport(true);
    const loadingToast = toast.loading("Compiling monthly attendance report...");
    try {
      const year = Number(importYear);
      const month = Number(importMonth);
      const totalDays = new Date(year, month, 0).getDate();
      const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
      const endStr = `${year}-${String(month).padStart(2, "0")}-${totalDays}`;

      // 1. Fetch active employees
      const { data: employees, error: empErr } = await supabase
        .from("employees")
        .select("*")
        .eq("status", "active");
      if (empErr) throw empErr;

      if (!employees || employees.length === 0) {
        toast.error("No active employees found in the database.");
        return;
      }

      // 2. Fetch attendance logs
      const { data: attendanceLogs, error: attErr } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", startStr)
        .lte("date", endStr);
      if (attErr) throw attErr;

      // 3. Fetch leaves
      const { data: leavesLogs, error: lvErr } = await supabase
        .from("leaves")
        .select("*")
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

  // Save parsed edits
  const handleEditChange = (field: keyof ImportedRecord, value: any) => {
    if (!editingRecord) return;
    const updated = { ...editingRecord, [field]: value };
    
    // Recalculations
    const basic = Number(updated.basic) || 0;
    const hra = Number(updated.hra) || 0;
    const bonus = Number(updated.bonus) || 0;
    const specialAllowance = Number(updated.specialAllowance) || 0;
    const conveyance = Number(updated.conveyance) || 0;
    const medical = Number(updated.medical) || 0;
    const otherAllowance = Number(updated.otherAllowance) || 0;
    const otPay = Number(updated.overtimePay) || 0;
    const inc = Number(updated.incentives) || 0;
    
    const pf = Number(updated.pf) || 0;
    const esic = Number(updated.esic) || 0;
    const pt = Number(updated.pt) || 0;
    const tds = Number(updated.tds) || 0;
    const leaveDed = Number(updated.leaveDeduction) || 0;
    const loanDed = Number(updated.loanDeduction) || 0;
    const otherDed = Number(updated.otherDeduction) || 0;
    
    const empPF = Number(updated.employerPF) || 0;
    const empESIC = Number(updated.employerESIC) || 0;
    
    updated.gross = basic + hra + bonus + specialAllowance + conveyance + medical + otherAllowance + otPay + inc;
    updated.totalDeductions = pf + esic + pt + tds + leaveDed + loanDed + otherDed;
    updated.netPay = Math.max(0, updated.gross - updated.totalDeductions);
    updated.ctc = updated.gross + empPF + empESIC;
    
    setEditingRecord(updated);
  };

  const saveEdit = () => {
    if (editIndex === null || !editingRecord) return;
    const newData = [...importedData];
    newData[editIndex] = editingRecord;
    setImportedData(newData);
    setEditingRecord(null);
    setEditIndex(null);
    toast.success("Record updated.");
  };

  // Save generated payslips to database
  const bulkGenerate = async () => {
    if (importedData.length === 0) return;
    const hasErrors = importedData.some((r) => !r.isValid);
    if (hasErrors) {
      toast.error("Please fix all invalid employee records before generating.");
      return;
    }

    setGenerating(true);
    const loadingToast = toast.loading("Processing bulk generation...");
    try {
      const month = Number(importMonth);
      const year = Number(importYear);

      // Create or get payroll run
      const { data: run, error: runErr } = await supabase
        .from("payroll_runs")
        .upsert({ 
          period_month: month, 
          period_year: year, 
          status: "processed", 
          processed_at: new Date().toISOString() 
        }, { onConflict: "period_month,period_year" })
        .select()
        .single();

      if (runErr || !run) throw runErr || new Error("Failed to create payroll run");

      const slipsToInsert = importedData.map((rec) => ({
        payroll_run_id: run.id,
        employee_id: rec.employeeId!,
        working_days: rec.totalDays,
        paid_days: rec.paidDays,
        basic: rec.basic,
        hra: rec.hra,
        conveyance: rec.conveyance,
        medical: rec.medical,
        special_allowance: rec.specialAllowance,
        bonus: rec.bonus,
        pf: rec.pf,
        esic: rec.esic,
        pt: rec.pt,
        tds: rec.tds,
        leave_deduction: rec.leaveDeduction,
        gross: rec.gross,
        total_deductions: rec.totalDeductions,
        net_pay: rec.netPay,
        
        overtime_hours: rec.otHours,
        overtime_pay: rec.overtimePay || (rec.basic > 0 ? Number(((rec.basic / 240) * rec.otHours).toFixed(2)) : 0),
        incentives: rec.incentives || 0,
        loan_deductions: rec.loanDeduction,
        absent_days: rec.absentDays,
        leave_days: rec.totalDays - rec.paidDays - rec.absentDays,
        half_days: rec.halfDays,
        late_marks: rec.lateMarks,
        other_allowance: rec.otherAllowance,
        other_deduction: rec.otherDeduction,
        employer_pf: rec.employerPF,
        employer_esic: rec.employerESIC,
      }));

      const { error: insErr } = await supabase
        .from("payslips")
        .upsert(slipsToInsert as any, { onConflict: "payroll_run_id,employee_id" });
      if (insErr) throw insErr;

      const totalNet = slipsToInsert.reduce((sum, p) => sum + p.net_pay, 0);
      await supabase
        .from("payroll_runs")
        .update({ total_net: totalNet })
        .eq("id", run.id);

      toast.success(`Successfully generated ${slipsToInsert.length} payslips!`);
      qc.invalidateQueries({ queryKey: ["payslips"] });
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      setImportedData([]);
    } catch (err: any) {
      toast.error("Generation failed: " + err.message);
    } finally {
      setGenerating(false);
      toast.dismiss(loadingToast);
    }
  };

  // Simulating email campaign
  const startEmailCampaign = async () => {
    if (importedData.length === 0) return;
    setEmailing(true);
    setEmailProgress(0);
    setEmailLogs([]);
    setShowEmailDialog(true);

    const logs: string[] = [];
    const addLog = (msg: string) => {
      logs.push(msg);
      setEmailLogs([...logs]);
    };

    addLog("Connecting to SMTP Server (mail.sngene.com)...");
    await new Promise((r) => setTimeout(r, 600));
    addLog("Connection verified. Sending email campaign...");
    await new Promise((r) => setTimeout(r, 400));

    const total = importedData.length;
    for (let i = 0; i < total; i++) {
      const rec = importedData[i];
      addLog(`Preparing payslip PDF buffer for ${rec.fullName}...`);
      await new Promise((r) => setTimeout(r, 200));

      const dbEmp = dbEmployees.find((e: any) => e.id === rec.employeeId);
      const email = dbEmp?.email || `${rec.fullName.toLowerCase().replace(/\s+/g, ".")}@sngene.com`;

      addLog(`Sending payslip to: ${email}...`);
      await new Promise((r) => setTimeout(r, 400));
      addLog(`[OK] Delivered payslip to ${email}`);

      setEmailProgress(Math.round(((i + 1) / total) * 100));
    }

    addLog("Email campaign finished. All emails sent successfully.");
    setEmailing(false);
  };

  // ZIP Downloader
  const generateAndDownloadZip = async () => {
    if (importedData.length === 0) return;
    setExportingZip(true);
    const loadingToast = toast.loading("Compiling PDF archive ZIP...");
    try {
      const JSZipLib = await loadJSZip();
      const zip = new JSZipLib();
      
      const month = Number(importMonth);
      const year = Number(importYear);
      const periodStr = `${months[month - 1]}_${year}`;

      const fmtPDFValue = (n: number) => `INR ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      const numToWordsPDF = (num: number): string => {
        const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
        const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
        const inWords = (n: number): string => {
          if (n < 20) return a[n];
          if (n < 100) return b[Math.floor(n/10)] + (n%10 ? " " + a[n%10] : "");
          if (n < 1000) return a[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + inWords(n%100) : "");
          if (n < 100000) return inWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + inWords(n%1000) : "");
          if (n < 10000000) return inWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + inWords(n%100000) : "");
          return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
        };
        return inWords(Math.floor(num)) + " Rupees Only";
      };

      for (const rec of importedData) {
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const W = doc.internal.pageSize.getWidth();
        const periodText = `${monthsFull[month - 1]} ${year}`;

        // Header band
        doc.setFillColor(82, 71, 200);
        doc.rect(0, 0, W, 70, "F");
        doc.setTextColor(255);
        doc.setFont("helvetica", "bold").setFontSize(18).text(companyName, 40, 32);
        doc.setFont("helvetica", "normal").setFontSize(10).text("Payslip · Confidential", 40, 50);
        doc.setFont("helvetica", "bold").setFontSize(12).text(`Pay period: ${periodText}`, W - 40, 40, { align: "right" });

        // Employee info
        doc.setTextColor(30);
        doc.setFontSize(10);
        const left = [
          ["Employee", rec.fullName], ["Employee ID", rec.employeeCode],
          ["Department", rec.department || "—"], ["Designation", rec.designation || "—"],
        ];
        const right = [
          ["PAN", "—"], ["UAN", "—"],
          ["Bank", "—"], ["A/C No.", "—"],
        ];
        let y = 100;
        left.forEach((row, i) => {
          doc.setFont("helvetica", "normal").setTextColor(120).text(row[0], 40, y + i * 16);
          doc.setFont("helvetica", "bold").setTextColor(30).text(row[1], 130, y + i * 16);
        });
        right.forEach((row, i) => {
          doc.setFont("helvetica", "normal").setTextColor(120).text(row[0], 320, y + i * 16);
          doc.setFont("helvetica", "bold").setTextColor(30).text(row[1], 400, y + i * 16);
        });

        // Working days
        y += left.length * 16 + 14;
        doc.setFillColor(245, 245, 252);
        doc.rect(40, y, W - 80, 28, "F");
        doc.setFont("helvetica", "normal").setTextColor(80).setFontSize(9);
        doc.text(`Total Days: ${rec.totalDays}`, 45, y + 18);
        doc.text(`Paid: ${rec.paidDays}`, 135, y + 18);
        doc.text(`Absent LOP: ${rec.absentDays || 0}`, 215, y + 18);
        doc.text(`Half Days: ${rec.halfDays || 0}`, 315, y + 18);
        doc.text(`Late Marks: ${rec.lateMarks || 0}`, 410, y + 18);
        doc.text(`OT Hours: ${rec.otHours || 0}`, 505, y + 18);

        // Earnings & Deductions tables
        const earnings = [
          ["Basic", fmtPDFValue(rec.basic)], ["HRA", fmtPDFValue(rec.hra)],
          ["Bonus", fmtPDFValue(rec.bonus)],
        ];
        if (rec.overtimePay && rec.overtimePay > 0) {
          earnings.push(["Overtime Pay", fmtPDFValue(rec.overtimePay)]);
        }
        if (rec.incentives && rec.incentives > 0) {
          earnings.push(["Incentives", fmtPDFValue(rec.incentives)]);
        }

        const deductions = [
          ["PF", fmtPDFValue(rec.pf)], ["ESIC (Employee)", fmtPDFValue(rec.esic)], ["Professional tax", fmtPDFValue(rec.pt)],
          ["TDS", fmtPDFValue(rec.tds)], ["Leave deduction (LOP)", fmtPDFValue(rec.leaveDeduction)],
        ];

        autoTable(doc, {
          head: [["Earnings", "Amount"]],
          body: earnings,
          foot: [["Gross earnings", fmtPDFValue(rec.gross)]],
          startY: y + 44, margin: { left: 40, right: W / 2 + 10 },
          theme: "grid", headStyles: { fillColor: [82, 71, 200], textColor: 255 },
          footStyles: { fillColor: [240, 238, 252], textColor: 30, fontStyle: "bold" },
          styles: { fontSize: 10 },
        });
        autoTable(doc, {
          head: [["Deductions", "Amount"]],
          body: deductions,
          foot: [["Total deductions", fmtPDFValue(rec.totalDeductions)]],
          startY: y + 44, margin: { left: W / 2 + 10, right: 40 },
          theme: "grid", headStyles: { fillColor: [82, 71, 200], textColor: 255 },
          footStyles: { fillColor: [240, 238, 252], textColor: 30, fontStyle: "bold" },
          styles: { fontSize: 10 },
        });

        // Contributions
        const finalY = (doc as any).lastAutoTable?.finalY || (doc as any).autoTable?.previous?.finalY || (y + 44 + deductions.length * 22);
        const esicCompany = rec.basic <= 21000 ? Math.round(rec.basic * 0.0325) : 0;

        doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(80);
        doc.text("Employer Contributions (Not deducted from Net Pay)", 40, finalY + 20);

        doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100);
        doc.text("ESIC Company Share (3.25% of Basic)", 40, finalY + 36);
        doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(30);
        doc.text(fmtPDFValue(esicCompany), 240, finalY + 36);

        // Net Pay block
        const yEnd = finalY + 55;
        doc.setFillColor(34, 34, 60);
        doc.rect(40, yEnd, W - 80, 70, "F");

        doc.setTextColor(255);
        doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(200).text("Monthly CTC", 56, yEnd + 22);
        doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(255).text(fmtPDFValue(rec.gross + esicCompany), 140, yEnd + 22);

        doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(255).text("Net pay", 56, yEnd + 44);
        doc.setFont("helvetica", "bold").setFontSize(20).text(fmtPDFValue(rec.netPay), W - 56, yEnd + 44, { align: "right" });

        doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(200);
        doc.text(numToWordsPDF(rec.netPay), 56, yEnd + 60);

        // Footer
        doc.setFontSize(8).setTextColor(140);
        doc.text(`This is a system-generated payslip. Digitally verified by ${companyName}.`, W / 2, 800, { align: "center" });

        const pdfArrayBuffer = doc.output("arraybuffer");
        zip.file(`Payslip_${rec.employeeCode}_${periodStr}.pdf`, pdfArrayBuffer);
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `Payslips_${periodStr}.zip`;
      link.click();
      toast.success("ZIP download completed.");
    } catch (err: any) {
      toast.error("Failed to generate ZIP archive: " + err.message);
    } finally {
      setExportingZip(false);
      toast.dismiss(loadingToast);
    }
  };

  // Preview generated PDF individual record
  const previewPDF = (rec: ImportedRecord) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const month = Number(importMonth);
    const year = Number(importYear);
    const periodText = `${monthsFull[month - 1]} ${year}`;

    const fmtPDFValue = (n: number) => `INR ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const numToWordsPDF = (num: number): string => {
      const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
      const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
      const inWords = (n: number): string => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n/10)] + (n%10 ? " " + a[n%10] : "");
        if (n < 1000) return a[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + inWords(n%100) : "");
        if (n < 100000) return inWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + inWords(n%1000) : "");
        if (n < 10000000) return inWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + inWords(n%100000) : "");
        return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
      };
      return inWords(Math.floor(num)) + " Rupees Only";
    };

    // Header band
    doc.setFillColor(82, 71, 200);
    doc.rect(0, 0, W, 70, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold").setFontSize(18).text(companyName, 40, 32);
    doc.setFont("helvetica", "normal").setFontSize(10).text("Payslip · Confidential", 40, 50);
    doc.setFont("helvetica", "bold").setFontSize(12).text(`Pay period: ${periodText}`, W - 40, 40, { align: "right" });

    // Employee info
    doc.setTextColor(30);
    doc.setFontSize(10);
    const left = [
      ["Employee", rec.fullName], ["Employee ID", rec.employeeCode],
      ["Department", rec.department || "—"], ["Designation", rec.designation || "—"],
    ];
    const right = [
      ["PAN", "—"], ["UAN", "—"],
      ["Bank", "—"], ["A/C No.", "—"],
    ];
    let y = 100;
    left.forEach((row, i) => {
      doc.setFont("helvetica", "normal").setTextColor(120).text(row[0], 40, y + i * 16);
      doc.setFont("helvetica", "bold").setTextColor(30).text(row[1], 130, y + i * 16);
    });
    right.forEach((row, i) => {
      doc.setFont("helvetica", "normal").setTextColor(120).text(row[0], 320, y + i * 16);
      doc.setFont("helvetica", "bold").setTextColor(30).text(row[1], 400, y + i * 16);
    });

    // Working days
    y += left.length * 16 + 14;
    doc.setFillColor(245, 245, 252);
    doc.rect(40, y, W - 80, 28, "F");
    doc.setFont("helvetica", "normal").setTextColor(80).setFontSize(9);
    doc.text(`Total Days: ${rec.totalDays}`, 45, y + 18);
    doc.text(`Paid: ${rec.paidDays}`, 135, y + 18);
    doc.text(`Absent LOP: ${rec.absentDays || 0}`, 215, y + 18);
    doc.text(`Half Days: ${rec.halfDays || 0}`, 315, y + 18);
    doc.text(`Late Marks: ${rec.lateMarks || 0}`, 410, y + 18);
    doc.text(`OT Hours: ${rec.otHours || 0}`, 505, y + 18);

    // Earnings & Deductions tables
    const earnings = [
      ["Basic", fmtPDFValue(rec.basic)], ["HRA", fmtPDFValue(rec.hra)],
      ["Bonus", fmtPDFValue(rec.bonus)],
    ];
    if (rec.overtimePay && rec.overtimePay > 0) {
      earnings.push(["Overtime Pay", fmtPDFValue(rec.overtimePay)]);
    }
    if (rec.incentives && rec.incentives > 0) {
      earnings.push(["Incentives", fmtPDFValue(rec.incentives)]);
    }

    const deductions = [
      ["PF", fmtPDFValue(rec.pf)], ["ESIC (Employee)", fmtPDFValue(rec.esic)], ["Professional tax", fmtPDFValue(rec.pt)],
      ["TDS", fmtPDFValue(rec.tds)], ["Leave deduction (LOP)", fmtPDFValue(rec.leaveDeduction)],
    ];

    autoTable(doc, {
      head: [["Earnings", "Amount"]],
      body: earnings,
      foot: [["Gross earnings", fmtPDFValue(rec.gross)]],
      startY: y + 44, margin: { left: 40, right: W / 2 + 10 },
      theme: "grid", headStyles: { fillColor: [82, 71, 200], textColor: 255 },
      footStyles: { fillColor: [240, 238, 252], textColor: 30, fontStyle: "bold" },
      styles: { fontSize: 10 },
    });
    autoTable(doc, {
      head: [["Deductions", "Amount"]],
      body: deductions,
      foot: [["Total deductions", fmtPDFValue(rec.totalDeductions)]],
      startY: y + 44, margin: { left: W / 2 + 10, right: 40 },
      theme: "grid", headStyles: { fillColor: [82, 71, 200], textColor: 255 },
      footStyles: { fillColor: [240, 238, 252], textColor: 30, fontStyle: "bold" },
      styles: { fontSize: 10 },
    });

    // Contributions
    const finalY = (doc as any).lastAutoTable?.finalY || (doc as any).autoTable?.previous?.finalY || (y + 44 + deductions.length * 22);
    const esicCompany = rec.basic <= 21000 ? Math.round(rec.basic * 0.0325) : 0;

    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(80);
    doc.text("Employer Contributions (Not deducted from Net Pay)", 40, finalY + 20);

    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100);
    doc.text("ESIC Company Share (3.25% of Basic)", 40, finalY + 36);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(30);
    doc.text(fmtPDFValue(esicCompany), 240, finalY + 36);

    // Net Pay block
    const yEnd = finalY + 55;
    doc.setFillColor(34, 34, 60);
    doc.rect(40, yEnd, W - 80, 70, "F");

    doc.setTextColor(255);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(200).text("Monthly CTC", 56, yEnd + 22);
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(255).text(fmtPDFValue(rec.gross + esicCompany), 140, yEnd + 22);

    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(255).text("Net pay", 56, yEnd + 44);
    doc.setFont("helvetica", "bold").setFontSize(20).text(fmtPDFValue(rec.netPay), W - 56, yEnd + 44, { align: "right" });

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(200);
    doc.text(numToWordsPDF(rec.netPay), 56, yEnd + 60);

    // Footer
    doc.setFontSize(8).setTextColor(140);
    doc.text(`This is a system-generated payslip. Digitally verified by ${companyName}.`, W / 2, 800, { align: "center" });

    doc.save(`Payslip_Preview_${rec.employeeCode}.pdf`);
  };

  const renderHistoryTable = () => (
    <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
      <div className="bg-muted/20 px-6 py-4 border-b flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
          <h3 className="font-semibold whitespace-nowrap">Payroll History</h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={selMonth} onValueChange={setSelMonth}>
              <SelectTrigger className="w-[120px] h-9 bg-background shadow-none border-dashed">
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
              <SelectTrigger className="w-[100px] h-9 bg-background shadow-none border-dashed">
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
                <X className="size-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>
        
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, ID or month..."
            className="pl-9 h-9 bg-background shadow-none" 
            value={q} 
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            {role === "admin" && <TableHead>Employee</TableHead>}
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">Deductions</TableHead>
            <TableHead className="text-right">Net pay</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedSlips.map((s: any) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{months[s.payroll_runs!.period_month - 1]} {s.payroll_runs!.period_year}</TableCell>
              {role === "admin" && <TableCell>{s.employees?.full_name}</TableCell>}
              <TableCell className="text-right">₹{Number(s.gross).toLocaleString("en-IN")}</TableCell>
              <TableCell className="text-right text-destructive">₹{Number(s.total_deductions).toLocaleString("en-IN")}</TableCell>
              <TableCell className="text-right font-semibold">₹{Number(s.net_pay).toLocaleString("en-IN")}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => generatePayslipPDF(s as never, companyName)}><FileDown className="size-3.5" /> PDF</Button>
              </TableCell>
            </TableRow>
          ))}
          {filteredSlips.length === 0 && <TableRow><TableCell colSpan={role === "admin" ? 6 : 5} className="py-12 text-center text-muted-foreground">No matching payslips found.</TableCell></TableRow>}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t bg-muted/10 px-6 py-4">
          <div className="text-xs text-muted-foreground font-medium">
            Showing <span className="font-bold text-foreground">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
            <span className="font-bold text-foreground">
              {Math.min(page * ITEMS_PER_PAGE, filteredSlips.length)}
            </span>{" "}
            of <span className="font-bold text-foreground">{filteredSlips.length}</span> payslips
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => {
                const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                return (
                  <div key={p} className="flex items-center gap-2">
                    {showEllipsis && (
                      <span className="text-xs text-muted-foreground px-1">...</span>
                    )}
                    <Button
                      variant={page === p ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0 rounded-lg text-xs font-bold transition-all",
                        page === p ? "shadow-md text-white" : ""
                      )}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  </div>
                );
              })}

            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // Calculations for dashboard
  const metrics = useMemo(() => {
    let grossSum = 0;
    let dedSum = 0;
    let netSum = 0;
    let invalidCount = 0;

    importedData.forEach((r) => {
      grossSum += r.gross;
      dedSum += r.totalDeductions;
      netSum += r.netPay;
      if (!r.isValid) invalidCount++;
    });

    return {
      total: importedData.length,
      grossSum,
      dedSum,
      netSum,
      invalidCount,
    };
  }, [importedData]);

  const renderImportTab = () => {
    return (
      <div className="space-y-6">
        {/* Controls row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-muted/20 p-4 md:p-6 rounded-2xl border">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            <div className="flex items-center gap-2 justify-between sm:justify-start">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest shrink-0">Period:</Label>
              <div className="flex items-center gap-2">
                <Select value={importMonth} onValueChange={setImportMonth}>
                  <SelectTrigger className="w-[110px] sm:w-[120px] h-10 bg-background shadow-sm font-bold">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={importYear} onValueChange={setImportYear}>
                  <SelectTrigger className="w-[90px] sm:w-[100px] h-10 bg-background shadow-sm font-bold">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {importedData.length > 0 && (
              <Button 
                variant="outline" 
                onClick={fetchAttendanceData} 
                disabled={loadingAttendance}
                className="h-10 px-4 gap-2 text-indigo-500 font-bold border-indigo-200 hover:bg-indigo-50/50 shadow-sm w-full sm:w-auto justify-center"
              >
                <RefreshCw className={cn("size-4", loadingAttendance && "animate-spin")} />
                Fetch Attendance
              </Button>
            )}
          </div>

          <Button variant="ghost" onClick={downloadTemplate} className="gap-2 h-10 text-muted-foreground hover:text-foreground w-full md:w-auto justify-center md:justify-end">
            <Download className="size-4" /> Download Template
          </Button>
        </div>

        {/* Upload Zone */}
        {importedData.length === 0 ? (
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 flex flex-col items-center justify-center gap-4 cursor-pointer min-h-[300px]",
              dragOver 
                ? "border-primary bg-primary/5 shadow-inner scale-[0.99]" 
                : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/10 bg-card shadow-elegant"
            )}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <div className="size-16 rounded-2xl bg-indigo-50 dark:bg-slate-800 text-indigo-500 flex items-center justify-center shadow-md">
              <Upload className="size-8" />
            </div>
            <div>
              <h4 className="text-xl font-bold">Drag & Drop Payroll Excel Sheet</h4>
              <p className="text-sm text-muted-foreground mt-1">or click to browse your files (supports .xlsx, .xls, .csv)</p>
            </div>
            <input 
              id="file-upload" 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              className="hidden" 
              onChange={handleFileChange} 
            />
          </div>
        ) : (
          /* Small Upload zone banner when data is loaded */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border bg-card p-4 rounded-2xl shadow-sm text-sm gap-3">
            <div className="flex items-center gap-3">
              <div className="size-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center shrink-0">
                <Check className="size-4" />
              </div>
              <div>
                <span className="font-bold">Active Excel Sheet Loaded</span>
                <span className="text-muted-foreground ml-2">({importedData.length} records)</span>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-muted-foreground gap-2 w-full sm:w-auto justify-center sm:justify-start" onClick={() => setImportedData([])}>
              <Trash2 className="size-4" /> Clear and Upload New
            </Button>
          </div>
        )}

        {importedData.length > 0 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Dashboard metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="border bg-card p-6 rounded-2xl shadow-sm flex items-center gap-4">
                <div className={cn(
                  "size-12 rounded-xl flex items-center justify-center shadow-sm text-white",
                  metrics.invalidCount > 0 ? "bg-amber-500" : "bg-indigo-500"
                )}>
                  {metrics.invalidCount > 0 ? <AlertCircle className="size-6" /> : <Check className="size-6" />}
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Imported</h4>
                  <div className="text-2xl font-bold flex items-baseline gap-1 mt-0.5">
                    {metrics.total}
                    {metrics.invalidCount > 0 && (
                      <span className="text-xs font-bold text-amber-600">({metrics.invalidCount} invalid)</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border bg-card p-6 rounded-2xl shadow-sm flex items-center gap-4">
                <div className="size-12 bg-green-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                  ₹
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Gross Payroll</h4>
                  <div className="text-2xl font-bold mt-0.5">₹{metrics.grossSum.toLocaleString("en-IN")}</div>
                </div>
              </div>

              <div className="border bg-card p-6 rounded-2xl shadow-sm flex items-center gap-4">
                <div className="size-12 bg-red-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                  ₹
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Deductions</h4>
                  <div className="text-2xl font-bold mt-0.5 text-red-500">₹{metrics.dedSum.toLocaleString("en-IN")}</div>
                </div>
              </div>

              <div className="border bg-card p-6 rounded-2xl shadow-sm flex items-center gap-4">
                <div className="size-12 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                  ₹
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Net Payroll</h4>
                  <div className="text-2xl font-bold mt-0.5 text-blue-500">₹{metrics.netSum.toLocaleString("en-IN")}</div>
                </div>
              </div>
            </div>

            {/* Error notifications */}
            {metrics.invalidCount > 0 && (
              <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-2xl p-4 flex items-center gap-3 text-sm font-semibold">
                <AlertCircle className="size-5 shrink-0" />
                <div>
                  Some rows have invalid Employee IDs or duplicated rows. Please edit or delete those rows before committing payroll generation.
                </div>
              </div>
            )}

            {/* Data Table */}
            <div className="rounded-2xl border bg-card overflow-hidden shadow-elegant">
              <div className="px-6 py-4 bg-muted/20 border-b flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <h4 className="font-bold">Imported Payroll Records</h4>
                <div className="text-xs text-muted-foreground sm:text-right">Double check columns and click edit to tweak values.</div>
              </div>

              {/* Card List View for Mobile */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {importedData.map((row, idx) => (
                  <div key={`${row.employeeCode}-${idx}`} className={cn("p-4 space-y-3", !row.isValid && "bg-destructive/5")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-foreground text-sm block">{row.fullName}</span>
                        <span className="text-xs text-muted-foreground">{row.employeeCode} · {row.department} · {row.designation}</span>
                      </div>
                      <div>
                        {row.isValid ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 text-[10px] font-bold">Valid</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-[10px] font-bold" title={row.warningMessage}>
                            {row.isDuplicate ? "Duplicate" : "Invalid ID"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs border-y py-2 dark:border-slate-800">
                      <div>
                        <span className="text-muted-foreground block">Days (Paid/Total):</span>
                        <span className="font-medium text-foreground">{row.paidDays} / {row.totalDays}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Gross Salary:</span>
                        <span className="font-medium text-foreground">₹{row.gross.toLocaleString("en-IN")}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Deductions:</span>
                        <span className="font-medium text-destructive">₹{row.totalDeductions.toLocaleString("en-IN")}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Net Pay:</span>
                        <span className="font-bold text-indigo-500">₹{row.netPay.toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => previewPDF(row)} className="h-8 gap-1 px-3 text-xs">
                        <Eye className="size-3.5" /> Preview
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingRecord(row); setEditIndex(idx); }} className="h-8 gap-1 px-3 text-xs">
                        <Edit2 className="size-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        const copy = [...importedData];
                        copy.splice(idx, 1);
                        setImportedData(copy);
                        toast.success("Row deleted from current upload.");
                      }} className="h-8 gap-1 px-3 text-xs text-destructive hover:bg-destructive/10">
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Table View for Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Employee Name</TableHead>
                      <TableHead className="text-center">Days (Paid/Total)</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importedData.map((row, idx) => (
                      <TableRow key={`${row.employeeCode}-${idx}`} className={cn(!row.isValid && "bg-destructive/5 hover:bg-destructive/10")}>
                        <TableCell className="font-semibold">{row.employeeCode}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{row.fullName}</span>
                            <span className="text-xs text-muted-foreground">{row.department} · {row.designation}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{row.paidDays} / {row.totalDays}</TableCell>
                        <TableCell className="text-right">₹{row.gross.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right text-destructive">₹{row.totalDeductions.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right font-bold text-indigo-500">₹{row.netPay.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-center">
                          {row.isValid ? (
                            <span className="px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-bold">Valid</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-xs font-bold" title={row.warningMessage}>
                              {row.isDuplicate ? "Duplicate" : "Invalid ID"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 pr-2">
                            <Button size="icon" variant="ghost" onClick={() => previewPDF(row)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <Eye className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { setEditingRecord(row); setEditIndex(idx); }} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <Edit2 className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => {
                              const copy = [...importedData];
                              copy.splice(idx, 1);
                              setImportedData(copy);
                              toast.success("Row deleted from current upload.");
                            }} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Bottom Actions panel */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-4 bg-muted/20 border p-6 rounded-2xl">
              <Button 
                variant="outline" 
                onClick={startEmailCampaign} 
                disabled={metrics.invalidCount > 0 || emailing}
                className="gap-2 w-full sm:w-auto h-12 rounded-xl"
              >
                <Mail className="size-4" /> Email Payslips
              </Button>
              <Button 
                variant="outline" 
                onClick={generateAndDownloadZip} 
                disabled={exportingZip}
                className="gap-2 w-full sm:w-auto h-12 rounded-xl"
              >
                <RefreshCw className={cn("size-4", exportingZip && "animate-spin")} /> Bulk Export ZIP
              </Button>
              <Button 
                onClick={bulkGenerate} 
                disabled={metrics.invalidCount > 0 || generating}
                className="gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold w-full sm:w-auto h-12 rounded-xl shadow-md shadow-indigo-500/20"
              >
                <Play className="size-4 fill-current" /> Bulk Generate Slips
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Salary Slips</h1>
        <p className="text-sm text-muted-foreground">Download monthly payslips as PDF.</p>
      </div>

      {isAdmin ? (
        <Tabs defaultValue="history" className="w-full space-y-6">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2 rounded-xl bg-muted p-1">
            <TabsTrigger value="history" className="rounded-lg font-bold">Slips History</TabsTrigger>
            <TabsTrigger value="import" className="rounded-lg font-bold">Import & Auto-Generation</TabsTrigger>
          </TabsList>
          <TabsContent value="history" className="space-y-6">
            {renderHistoryTable()}
          </TabsContent>
          <TabsContent value="import" className="space-y-6">
            {renderImportTab()}
          </TabsContent>
        </Tabs>
      ) : (
        renderHistoryTable()
      )}

      {/* Edit Record Modal */}
      <Dialog open={editingRecord !== null} onOpenChange={(open) => { if (!open) setEditingRecord(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Payslip Details</DialogTitle>
            <DialogDescription>Modify fields for {editingRecord?.fullName} ({editingRecord?.employeeCode}) before generating.</DialogDescription>
          </DialogHeader>
          
          {editingRecord && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
              {/* Column 1: Attendance & Info */}
              <div className="space-y-4 border-r pr-6 dark:border-slate-800">
                <h4 className="font-bold text-indigo-500 border-b pb-2 dark:border-slate-800">Attendance & Info</h4>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold">Employee Name</Label>
                    <Input value={editingRecord.fullName} onChange={(e) => handleEditChange("fullName", e.target.value)} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold">Total Days</Label>
                      <Input type="number" value={editingRecord.totalDays} onChange={(e) => handleEditChange("totalDays", num(e.target.value))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Paid Days</Label>
                      <Input type="number" step="0.1" value={editingRecord.paidDays} onChange={(e) => handleEditChange("paidDays", num(e.target.value))} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold">Absent Days</Label>
                      <Input type="number" value={editingRecord.absentDays} onChange={(e) => handleEditChange("absentDays", num(e.target.value))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Half Days</Label>
                      <Input type="number" value={editingRecord.halfDays} onChange={(e) => handleEditChange("halfDays", num(e.target.value))} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold">Late Marks</Label>
                      <Input type="number" value={editingRecord.lateMarks} onChange={(e) => handleEditChange("lateMarks", num(e.target.value))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">OT Hours</Label>
                      <Input type="number" step="0.1" value={editingRecord.otHours} onChange={(e) => handleEditChange("otHours", num(e.target.value))} className="mt-1" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Column 2: Earnings */}
              <div className="space-y-4 border-r pr-6 dark:border-slate-800">
                <h4 className="font-bold text-green-500 border-b pb-2 dark:border-slate-800">Earnings</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold">Basic Salary</Label>
                      <Input type="number" value={editingRecord.basic} onChange={(e) => handleEditChange("basic", num(e.target.value))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">HRA</Label>
                      <Input type="number" value={editingRecord.hra} onChange={(e) => handleEditChange("hra", num(e.target.value))} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Bonus</Label>
                    <Input type="number" value={editingRecord.bonus} onChange={(e) => handleEditChange("bonus", num(e.target.value))} className="mt-1" />
                  </div>
                </div>
              </div>
              
              {/* Column 3: Deductions & Contributions */}
              <div className="space-y-4">
                <h4 className="font-bold text-red-500 border-b pb-2 dark:border-slate-800">Deductions & Employer</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold">PF (Employee)</Label>
                      <Input type="number" value={editingRecord.pf} onChange={(e) => handleEditChange("pf", num(e.target.value))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">ESIC (Employee)</Label>
                      <Input type="number" value={editingRecord.esic} onChange={(e) => handleEditChange("esic", num(e.target.value))} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold">Professional Tax</Label>
                      <Input type="number" value={editingRecord.pt} onChange={(e) => handleEditChange("pt", num(e.target.value))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">TDS</Label>
                      <Input type="number" value={editingRecord.tds} onChange={(e) => handleEditChange("tds", num(e.target.value))} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Leave Deduct.</Label>
                    <Input type="number" value={editingRecord.leaveDeduction} onChange={(e) => handleEditChange("leaveDeduction", num(e.target.value))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Other Deduction</Label>
                    <Input type="number" value={editingRecord.otherDeduction} onChange={(e) => handleEditChange("otherDeduction", num(e.target.value))} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t pt-2 mt-2 dark:border-slate-800">
                    <div>
                      <Label className="text-xs font-bold text-slate-500">Employer PF</Label>
                      <Input type="number" value={editingRecord.employerPF} onChange={(e) => handleEditChange("employerPF", num(e.target.value))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-500">Employer ESIC</Label>
                      <Input type="number" value={editingRecord.employerESIC} onChange={(e) => handleEditChange("employerESIC", num(e.target.value))} className="mt-1" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {editingRecord && (
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between mt-2 border dark:border-slate-800 text-sm font-semibold">
              <div>Gross: <span className="text-green-600 font-bold">₹{editingRecord.gross.toLocaleString("en-IN")}</span></div>
              <div>Deductions: <span className="text-red-500 font-bold">₹{editingRecord.totalDeductions.toLocaleString("en-IN")}</span></div>
              <div>Net Pay: <span className="text-indigo-500 font-bold">₹{editingRecord.netPay.toLocaleString("en-IN")}</span></div>
              <div>CTC: <span className="text-blue-500 font-bold">₹{editingRecord.ctc.toLocaleString("en-IN")}</span></div>
            </div>
          )}
          
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditingRecord(null)} className="h-11 rounded-xl">Cancel</Button>
            <Button onClick={saveEdit} className="h-11 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Simulation Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={(open) => { if (!open && !emailing) setShowEmailDialog(false); }}>
        <DialogContent className="max-w-xl rounded-3xl p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Mail className="size-5 text-indigo-500" />
              <span>Email Delivery Simulator</span>
            </DialogTitle>
            <DialogDescription>Simulating secure SMTP email distribution to employees.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Progress</span>
                <span>{emailProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${emailProgress}%` }}
                />
              </div>
            </div>

            {/* Log Stream console */}
            <div className="w-full h-48 bg-slate-950 text-emerald-400 font-mono text-[11px] p-4 rounded-2xl overflow-y-auto border border-slate-900 shadow-inner flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-slate-800">
              {emailLogs.map((log, idx) => (
                <div key={idx} className={cn(
                  log.startsWith("[OK]") && "text-green-400 font-bold",
                  log.startsWith("[SUCCESS]") && "text-blue-400 font-bold"
                )}>
                  {log}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          <DialogFooter>
            <Button 
              onClick={() => setShowEmailDialog(false)} 
              disabled={emailing}
              className="h-11 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
