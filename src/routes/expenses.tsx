import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Receipt, Plus, Clock, CheckCircle2, XCircle, Wallet, FileText, IndianRupee,
  Upload, ExternalLink, Eye, Search, TrendingUp, Building2, X, Users as UsersIcon,
  ListFilter, LayoutGrid, Pencil, Trash2, Mail, Download, FileSpreadsheet,
  AlertTriangle, ShieldCheck, Calendar, Filter, Check, Plane, Train, Fuel,
  Car, Utensils, Hotel, MoreHorizontal, Sparkles, RefreshCw, Paperclip, ArrowUpDown
} from "lucide-react";
import { useState, useRef, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { cn } from "../lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { normalizeDepartment } from "@/lib/departments";
import {
  EmployeeMasterDARecord,
  DailyExpenseClaimRow,
  BatchExpenseClaim,
  ExpenseAttachment,
  DARuleType,
  loadEmployeeMasterDA,
  saveEmployeeMasterDA,
  findEmployeeInMaster,
  calculateDailyDA,
  evaluateRowExpenses,
  generate20DayBatch,
  recalculateBatch,
  loadAllBatches,
  saveBatch,
  deleteBatch,
  exportBatchToExcel,
  exportMasterToExcel,
  parseMasterFromExcel,
  DEFAULT_EMPLOYEE_MASTER_DA,
  OUTSTATION_DOCUMENT_REQUIREMENTS,
  isPhlebotomist,
  determineDARule,
} from "@/lib/expense-da";

export const Route = createFileRoute("/expenses")({
  component: () => (
    <AppShell>
      <ExpensesPage />
    </AppShell>
  ),
});

const getEmailUrl = (email: string, employeeName: string, title: string, amount: number) => {
  const subject = encodeURIComponent(`Inquiry regarding expense claim: ${title}`);
  const body = encodeURIComponent(
    `Hi ${employeeName},\n\nI have a question/clarification regarding your expense claim "${title}" of amount ₹${Number(amount).toLocaleString('en-IN')}.\n\nBest regards,\nHR & Operations`
  );
  return `mailto:${email || ''}?subject=${subject}&body=${body}`;
};

function ExpensesPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  // View mode switcher: allows admins to preview and test the exact employee experience
  const [viewMode, setViewMode] = useState<"admin" | "employee">(isAdmin ? "admin" : "employee");
  const isAuthorized = isAdmin && viewMode === "admin";
  const { myEmployee } = useMyEmployee();

  // Navigation tab (Strict RBAC: non-authorized users only have access to "batches" and "individual")
  const [activeTab, setActiveTab] = useState<"batches" | "master" | "summaries" | "individual">("batches");

  // Prevent non-authorized employees from staying on Master or Summaries tab
  useEffect(() => {
    if (!isAuthorized && (activeTab === "master" || activeTab === "summaries")) {
      setActiveTab("batches");
    }
  }, [isAuthorized, activeTab]);

  // Master Data State (Available to Admins/Managers)
  const [masterList, setMasterList] = useState<EmployeeMasterDARecord[]>(() => loadEmployeeMasterDA());
  const [masterSearch, setMasterSearch] = useState("");
  const [editingMasterRecord, setEditingMasterRecord] = useState<EmployeeMasterDARecord | null>(null);
  const [isAddMasterOpen, setIsAddMasterOpen] = useState(false);
  const masterFileInputRef = useRef<HTMLInputElement>(null);

  // 20-Day Batch States
  const [batches, setBatches] = useState<BatchExpenseClaim[]>(() => loadAllBatches());
  const [selectedBatch, setSelectedBatch] = useState<BatchExpenseClaim | null>(null);
  const [isBatchEditorOpen, setIsBatchEditorOpen] = useState(false);
  const [isCreateBatchOpen, setIsCreateBatchOpen] = useState(false);
  const [batchSearch, setBatchSearch] = useState("");
  const [batchStatusFilter, setBatchStatusFilter] = useState("all");

  // New Batch Form State
  const [newBatchEmployeeId, setNewBatchEmployeeId] = useState<string>("");
  const [newBatchStartDate, setNewBatchStartDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

  // Row Attachments Dialog State
  const [attachmentRowIndex, setAttachmentRowIndex] = useState<number | null>(null);
  const [attachmentExpenseType, setAttachmentExpenseType] = useState<string>("otherExpenses");
  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const billFileInputRef = useRef<HTMLInputElement>(null);

  // Multi-Level Approval Dialogs
  const [approvingBatch, setApprovingBatch] = useState<{
    batch: BatchExpenseClaim;
    stage: "manager" | "hr";
    action: "approve" | "reject";
  } | null>(null);
  const [approvalNote, setApprovalNote] = useState("");

  // Legacy / Ad-hoc Claims states
  const [openLegacyClaim, setOpenLegacyClaim] = useState(false);
  const [legacyBusy, setLegacyBusy] = useState(false);
  const [singleExpenseType, setSingleExpenseType] = useState<string>("AIR FARE (₹)");
  const [singleClaimFileName, setSingleClaimFileName] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Query employees for selection (Admins/Managers see all; employees see only themselves)
  const { data: allEmployees = [] } = useQuery({
    queryKey: ["all-employees-for-expenses", isAuthorized, myEmployee?.id],
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select("id, full_name, designation, department, employee_code, email, phone")
        .order("full_name");

      // Non-authorized employees can only retrieve their own record
      if (!isAuthorized) {
        if (!myEmployee) return [];
        query = query.eq("id", myEmployee.id);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
    enabled: !!user && (isAuthorized || !!myEmployee),
  });

  // Query Department Employees for Managers
  const { data: departmentEmployees = [] } = useQuery({
    queryKey: ["department-employees-expenses", myEmployee?.department],
    enabled: role === "manager" && !!myEmployee?.department,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id")
        .eq("department", myEmployee!.department);
      if (error) throw error;
      return (data || []).map((e) => e.id);
    },
  });

  // Query Claims from Supabase strictly filtered by permission
  const { data: dbClaims = [] as any[] } = useQuery({
    queryKey: ["expense-claims", role, viewMode, myEmployee?.id, departmentEmployees],
    queryFn: async () => {
      let query = supabase
        .from("expense_claims" as any)
        .select("*, employees(full_name, department, designation, phone, email)")
        .order("created_at", { ascending: false });

      if (!isAdmin || viewMode === "employee") {
        if (!myEmployee) return [];
        // Strict employee isolation: only own claims!
        query = query.eq("employee_id", myEmployee.id);
      }

      const { data, error } = await query;
      if (error) return [];
      return (data as any[]) || [];
    },
    enabled: !!user && (role === "admin" || !!myEmployee),
  });

  // Sync Supabase batch claims into local batches state
  useEffect(() => {
    if (dbClaims.length > 0) {
      const dbBatches: BatchExpenseClaim[] = [];
      dbClaims.forEach((c: any) => {
        if (c.category === "travel_da_batch" && c.notes) {
          try {
            const parsed = JSON.parse(c.notes);
            if (parsed && parsed.rows && Array.isArray(parsed.rows)) {
              dbBatches.push({
                ...parsed,
                id: c.id,
                status: c.status === "approved"
                  ? "approved"
                  : c.status === "rejected"
                  ? "rejected"
                  : c.status === "draft"
                  ? "draft"
                  : parsed.status || "pending_manager",
              });
            }
          } catch {
            // not a batch JSON
          }
        }
      });

      if (dbBatches.length > 0) {
        const local = loadAllBatches();
        const mergedMap = new Map<string, BatchExpenseClaim>();
        local.forEach((b) => mergedMap.set(b.batchNumber || b.id, b));
        dbBatches.forEach((b) => mergedMap.set(b.batchNumber || b.id, b));
        const mergedList = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setBatches(mergedList);
      }
    }
  }, [dbClaims]);

  // Auto-sync any unsynced local batches to Supabase cloud
  useEffect(() => {
    if (!myEmployee) return;
    const local = loadAllBatches();
    const myLocal = local.filter((b) => b.employeeId === myEmployee.id);
    if (myLocal.length === 0) return;

    myLocal.forEach(async (b) => {
      const existsInDb = dbClaims.some(
        (c: any) => c.id === b.id || (c.notes && c.notes.includes(b.batchNumber))
      );
      if (!existsInDb) {
        try {
          const title = `20-Day Expense Claim (${b.batchNumber}) - ${b.employeeName}`;
          const { data: inserted } = await supabase
            .from("expense_claims" as any)
            .insert({
              employee_id: b.employeeId,
              title,
              amount: b.totalClaimAmount,
              category: "travel_da_batch",
              notes: JSON.stringify(b),
              status: b.status === "approved" ? "approved" : b.status === "pending_manager" ? "pending" : "draft",
            })
            .select()
            .single();

          if (inserted) {
            b.id = inserted.id;
            saveBatch(b);
            qc.invalidateQueries({ queryKey: ["expense-claims"] });
          }
        } catch (err) {
          console.warn("Auto-syncing local batch to cloud:", err);
        }
      }
    });
  }, [myEmployee, dbClaims]);

  // Set default employee for new batch
  useEffect(() => {
    if (myEmployee?.id && !newBatchEmployeeId) {
      setNewBatchEmployeeId(myEmployee.id);
    }
  }, [myEmployee, newBatchEmployeeId]);

  // ==========================================
  // STRICT DATA ISOLATION / RBAC FILTERING
  // ==========================================
  const accessibleBatches = useMemo(() => {
    if (isAdmin && viewMode === "admin") return batches;
    if (myEmployee) {
      // Regular employees (or admin in employee view) can ONLY see their own batches!
      return batches.filter((b) => b.employeeId === myEmployee.id);
    }
    return [];
  }, [batches, isAdmin, viewMode, myEmployee]);

  // Filtered Batches List based on user search and status
  const filteredBatches = useMemo(() => {
    return accessibleBatches.filter((b) => {
      const q = batchSearch.toLowerCase();
      const matchesSearch =
        b.employeeName.toLowerCase().includes(q) ||
        b.batchNumber.toLowerCase().includes(q) ||
        b.designation.toLowerCase().includes(q) ||
        b.department.toLowerCase().includes(q);

      const matchesStatus = batchStatusFilter === "all" || b.status === batchStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [accessibleBatches, batchSearch, batchStatusFilter]);

  // Batch Aggregates computed strictly from ACCESSIBLE batches
  const batchAggregates = useMemo(() => {
    let totalEligibleDA = 0;
    let totalOtherExpenses = 0;
    let totalClaimVolume = 0;
    let totalMissingBills = 0;
    let totalExceptions = 0;
    let pendingRM = 0;
    let pendingHR = 0;
    let approvedTotal = 0;

    accessibleBatches.forEach((b) => {
      totalEligibleDA += b.totalEligibleDA;
      totalOtherExpenses += b.totalOtherExpenses;
      totalClaimVolume += b.totalClaimAmount;
      totalMissingBills += b.missingBillsCount;
      totalExceptions += b.exceptionsCount;
      if (b.status === "pending_manager") pendingRM += 1;
      if (b.status === "manager_approved") pendingHR += 1;
      if (b.status === "approved") approvedTotal += b.totalClaimAmount;
    });

    return {
      totalEligibleDA,
      totalOtherExpenses,
      totalClaimVolume,
      totalMissingBills,
      totalExceptions,
      pendingRM,
      pendingHR,
      approvedTotal,
    };
  }, [accessibleBatches]);

  // Employee-wise Summary for Tab 3 (Authorized only)
  const employeeWiseSummary = useMemo(() => {
    if (!isAuthorized) return [];
    const map: Record<string, any> = {};
    accessibleBatches.forEach((b) => {
      if (!map[b.employeeId]) {
        map[b.employeeId] = {
          employeeId: b.employeeId,
          name: b.employeeName,
          designation: b.designation,
          department: b.department,
          batchesCount: 0,
          totalDA: 0,
          totalOther: 0,
          totalClaim: 0,
          missingBills: 0,
          approvedAmount: 0,
        };
      }
      map[b.employeeId].batchesCount += 1;
      map[b.employeeId].totalDA += b.totalEligibleDA;
      map[b.employeeId].totalOther += b.totalOtherExpenses;
      map[b.employeeId].totalClaim += b.totalClaimAmount;
      map[b.employeeId].missingBills += b.missingBillsCount;
      if (b.status === "approved") {
        map[b.employeeId].approvedAmount += b.totalClaimAmount;
      }
    });
    return Object.values(map).sort((a: any, b: any) => b.totalClaim - a.totalClaim);
  }, [accessibleBatches, isAuthorized]);

  // Date-wise Summary for Tab 3 (Authorized only)
  const dateWiseSummary = useMemo(() => {
    if (!isAuthorized) return [];
    const dateMap: Record<string, { date: string; totalDA: number; totalExpenses: number; totalClaim: number; count: number }> = {};
    accessibleBatches.forEach((b) => {
      b.rows.forEach((r) => {
        if (!dateMap[r.date]) {
          dateMap[r.date] = { date: r.date, totalDA: 0, totalExpenses: 0, totalClaim: 0, count: 0 };
        }
        dateMap[r.date].totalDA += r.daPayable;
        dateMap[r.date].totalExpenses += r.totalExpense - r.daPayable;
        dateMap[r.date].totalClaim += r.totalExpense;
        dateMap[r.date].count += 1;
      });
    });
    return Object.values(dateMap).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  }, [accessibleBatches, isAuthorized]);

  // Filtered Master List (Authorized only)
  const filteredMaster = useMemo(() => {
    if (!isAuthorized) return [];
    return masterList.filter((m) => {
      const q = masterSearch.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.designation.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q) ||
        m.location.toLowerCase().includes(q)
      );
    });
  }, [masterList, masterSearch, isAuthorized]);

  // Save Master changes to localStorage
  const handleSaveMasterRecord = (rec: EmployeeMasterDARecord) => {
    const updated = masterList.map((m) => (m.srNo === rec.srNo ? rec : m));
    setMasterList(updated);
    saveEmployeeMasterDA(updated);
    setEditingMasterRecord(null);
    toast.success(`Updated Master record for ${rec.name}`);
  };

  const handleAddNewMasterRecord = (rec: Omit<EmployeeMasterDARecord, "srNo">) => {
    const nextSr = masterList.length > 0 ? Math.max(...masterList.map((m) => m.srNo)) + 1 : 1;
    const newRecord: EmployeeMasterDARecord = { ...rec, srNo: nextSr };
    const updated = [...masterList, newRecord];
    setMasterList(updated);
    saveEmployeeMasterDA(updated);
    setIsAddMasterOpen(false);
    toast.success(`Added ${newRecord.name} to Employee Master`);
  };

  const handleResetMaster = () => {
    if (confirm("Reset Employee Master to default 41 records from the image? Any custom edits will be reverted.")) {
      setMasterList(DEFAULT_EMPLOYEE_MASTER_DA);
      saveEmployeeMasterDA(DEFAULT_EMPLOYEE_MASTER_DA);
      toast.success("Employee Master reset to default 41 employees");
    }
  };

  const handleUploadMasterExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.info("Reading Excel Master...");
      const parsed = await parseMasterFromExcel(file);
      if (parsed.length === 0) throw new Error("No employee records found in file.");
      setMasterList(parsed);
      saveEmployeeMasterDA(parsed);
      toast.success(`Successfully imported ${parsed.length} employees into Master!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to parse Excel file.");
    } finally {
      if (masterFileInputRef.current) masterFileInputRef.current.value = "";
    }
  };

  // Create New 20-Day Batch
  const handleGenerateBatch = async () => {
    const targetEmpId = isAuthorized ? newBatchEmployeeId : myEmployee?.id;
    if (!targetEmpId) {
      return toast.error("Please select an employee.");
    }
    const emp = isAuthorized
      ? allEmployees.find((e) => e.id === targetEmpId)
      : myEmployee;

    if (!emp) {
      return toast.error("Employee profile not found.");
    }

    setIsGeneratingBatch(true);
    toast.info(`Fetching attendance and doctor visits for 20-day period starting ${newBatchStartDate}...`);

    try {
      const start = new Date(newBatchStartDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 20);
      const startStr = newBatchStartDate;
      const endStr = end.toISOString().split("T")[0];

      // 1. Fetch attendance for this employee in this range
      const { data: attData } = await supabase
        .from("attendance")
        .select("date, check_in, check_out, status")
        .eq("employee_id", emp.id)
        .gte("date", startStr)
        .lte("date", endStr);

      const attendanceMap: Record<string, any> = {};
      (attData || []).forEach((a) => {
        attendanceMap[a.date] = a;
      });

      // 2. Fetch doctor visits for this employee
      const { data: dvData } = await (supabase as any)
        .from("doctor_visits")
        .select("id, visit_date, created_at, status")
        .eq("employee_id", emp.id);

      const doctorVisitsMap: Record<string, number> = {};
      (dvData || []).forEach((v: any) => {
        let vDate = v.visit_date;
        if (!vDate && v.created_at) {
          vDate = v.created_at.split("T")[0];
        }
        if (vDate) {
          doctorVisitsMap[vDate] = (doctorVisitsMap[vDate] || 0) + 1;
        }
      });

      // 3. Generate 20-day batch
      const newBatch = generate20DayBatch({
        employee: emp,
        startDate: newBatchStartDate,
        masterList,
        attendanceMap,
        doctorVisitsMap,
      });

      // Save locally
      let updatedBatches = saveBatch(newBatch);
      setBatches(updatedBatches);
      setSelectedBatch(newBatch);
      setIsCreateBatchOpen(false);
      setIsBatchEditorOpen(true);
      toast.success("20-Day Daily Expense Claim Sheet generated!");

      // Sync immediately to Supabase database so Admin and all devices can access it
      try {
        const title = `20-Day Expense Claim (${newBatch.batchNumber}) - ${newBatch.employeeName}`;
        const { data: inserted } = await supabase
          .from("expense_claims" as any)
          .insert({
            employee_id: newBatch.employeeId,
            title,
            amount: newBatch.totalClaimAmount,
            category: "travel_da_batch",
            notes: JSON.stringify(newBatch),
            status: "draft",
          })
          .select()
          .single();

        if (inserted) {
          const synced = { ...newBatch, id: inserted.id };
          updatedBatches = saveBatch(synced);
          setBatches(updatedBatches);
          setSelectedBatch(synced);
          qc.invalidateQueries({ queryKey: ["expense-claims"] });
        }
      } catch (cloudErr) {
        console.warn("Could not immediately sync new draft batch to Supabase:", cloudErr);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate batch claim.");
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  // Submit Batch for Approval
  const handleSubmitBatch = async (batchToSubmit: BatchExpenseClaim) => {
    // Check missing bill explanations
    const unaddressedMissing = batchToSubmit.rows.filter((r) => r.remarksRequired);
    if (unaddressedMissing.length > 0) {
      return toast.error(
        `Cannot submit: ${unaddressedMissing.length} line item(s) have missing bills without required explanation in Remarks.`
      );
    }

    const updated: BatchExpenseClaim = {
      ...batchToSubmit,
      status: "pending_manager",
      updatedAt: new Date().toISOString(),
    };

    try {
      // Save locally
      const allUpdated = saveBatch(updated);
      setBatches(allUpdated);
      setSelectedBatch(updated);

      // Save/update in Supabase `expense_claims` table
      const title = `20-Day Expense Claim (${updated.batchNumber}) - ${updated.employeeName}`;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updated.id);
      let syncSuccess = false;

      if (isUuid) {
        const { error: updateError } = await supabase
          .from("expense_claims" as any)
          .update({
            amount: updated.totalClaimAmount,
            notes: JSON.stringify(updated),
            status: "pending",
          })
          .eq("id", updated.id);
        if (!updateError) syncSuccess = true;
      }

      if (!syncSuccess) {
        const { data: inserted, error: insertError } = await supabase
          .from("expense_claims" as any)
          .insert({
            employee_id: updated.employeeId,
            title,
            amount: updated.totalClaimAmount,
            category: "travel_da_batch",
            notes: JSON.stringify(updated),
            status: "pending",
          })
          .select()
          .single();

        if (insertError) {
          console.warn("Could not sync batch claim to Supabase table, cached locally:", insertError);
        } else if (inserted) {
          updated.id = inserted.id;
          saveBatch(updated);
        }
      }

      // Notify Managers & Admins
      try {
        const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
        if (admins && admins.length > 0) {
          const notifs = admins.map((admin) => ({
            user_id: admin.user_id,
            title: "New 20-Day Expense Batch Submitted",
            message: `${updated.employeeName} submitted a 20-day claim of ₹${updated.totalClaimAmount.toLocaleString(
              "en-IN"
            )} (${updated.startDate} to ${updated.endDate}).`,
            is_read: false,
            link: "/expenses",
          }));
          await supabase.from("notifications" as any).insert(notifs);
        }
      } catch (notifErr) {
        console.error(notifErr);
      }

      toast.success("20-Day Travel & Expense Claim submitted successfully!");
      qc.invalidateQueries({ queryKey: ["expense-claims"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit batch.");
    }
  };

  // Multi-Level Approval Process
  const handleConfirmApproval = async () => {
    if (!approvingBatch) return;
    const { batch, stage, action } = approvingBatch;
    const note = approvalNote;

    let newStatus: BatchExpenseClaim["status"] = batch.status;
    let managerApproval = batch.managerApproval;
    let hrApproval = batch.hrApproval;

    if (stage === "manager") {
      if (action === "approve") {
        newStatus = "manager_approved";
        managerApproval = {
          approvedBy: myEmployee?.full_name || "Reporting Manager",
          approvedAt: new Date().toISOString(),
          notes: note,
        };
      } else {
        newStatus = "rejected";
        managerApproval = {
          approvedBy: myEmployee?.full_name || "Reporting Manager",
          approvedAt: new Date().toISOString(),
          notes: `Returned: ${note}`,
        };
      }
    } else if (stage === "hr") {
      if (action === "approve") {
        newStatus = "approved";
        hrApproval = {
          approvedBy: myEmployee?.full_name || "HR Admin",
          approvedAt: new Date().toISOString(),
          notes: note,
        };
      } else {
        newStatus = "rejected";
        hrApproval = {
          approvedBy: myEmployee?.full_name || "HR Admin",
          approvedAt: new Date().toISOString(),
          notes: `Rejected: ${note}`,
        };
      }
    }

    const updatedBatch: BatchExpenseClaim = {
      ...batch,
      status: newStatus,
      managerApproval,
      hrApproval,
      updatedAt: new Date().toISOString(),
    };

    // Save locally
    const all = saveBatch(updatedBatch);
    setBatches(all);
    setSelectedBatch(updatedBatch);

    // Sync to Supabase
    try {
      await supabase
        .from("expense_claims" as any)
        .update({
          status: newStatus === "approved" ? "approved" : newStatus === "rejected" ? "rejected" : "pending",
          admin_notes: note || null,
          approved_by: myEmployee?.full_name || "HR/Manager",
          notes: JSON.stringify(updatedBatch),
        })
        .eq("id", batch.id);

      // Notify Employee
      const emp = allEmployees.find((e) => e.id === batch.employeeId);
      if (emp?.email) {
        const { data: uData } = await supabase.from("employees").select("user_id").eq("id", emp.id).single();
        if (uData?.user_id) {
          await supabase.from("notifications" as any).insert({
            user_id: uData.user_id,
            title: `Expense Batch ${action === "approve" ? "Approved" : "Returned"}`,
            message: `Your 20-day expense claim ${batch.batchNumber} was ${
              stage === "manager" ? "verified by Reporting Manager" : "processed by HR"
            } (${action}).`,
            is_read: false,
            link: "/expenses",
          });
        }
      }
    } catch (dbErr) {
      console.warn("DB update error:", dbErr);
    }

    setApprovingBatch(null);
    setApprovalNote("");
    toast.success(`Batch ${action === "approve" ? "approved" : "returned"} successfully!`);
    qc.invalidateQueries({ queryKey: ["expense-claims"] });
  };

  // Upload Bill for a row
  const handleUploadBillForRow = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || attachmentRowIndex === null || !selectedBatch) return;

    setIsUploadingBill(true);
    toast.info("Uploading supporting document...");

    try {
      let publicUrl = "";
      const fileExt = file.name.split(".").pop();
      const fileName = `${selectedBatch.employeeId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("expense_receipts")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (!uploadError) {
        const { data } = supabase.storage.from("expense_receipts").getPublicUrl(fileName);
        publicUrl = data.publicUrl;
      } else {
        publicUrl = URL.createObjectURL(file);
      }

      const newAttachment: ExpenseAttachment = {
        name: file.name,
        url: publicUrl,
        type: file.type,
        expenseType: attachmentExpenseType,
        uploadedAt: new Date().toISOString(),
      };

      const updatedRows = [...selectedBatch.rows];
      const targetRow = { ...updatedRows[attachmentRowIndex] };
      targetRow.attachments = [...(targetRow.attachments || []), newAttachment];

      updatedRows[attachmentRowIndex] = targetRow;

      const recalculated = recalculateBatch({
        ...selectedBatch,
        rows: updatedRows,
      });

      setSelectedBatch(recalculated);
      saveBatch(recalculated);
      setBatches(loadAllBatches());
      toast.success(`Attached "${file.name}" to ${attachmentExpenseType}!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file.");
    } finally {
      setIsUploadingBill(false);
      if (billFileInputRef.current) billFileInputRef.current.value = "";
    }
  };

  // Legacy single claim submit
  const submitLegacyClaim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!myEmployee) return toast.error("Profile not linked.");
    setLegacyBusy(true);
    const fd = new FormData(e.currentTarget);
    const file = fileRef.current?.files?.[0];
    let receiptUrl = null;

    try {
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${myEmployee.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("expense_receipts")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("expense_receipts").getPublicUrl(fileName);
        receiptUrl = publicUrl;
      }

      const expenseType = singleExpenseType || "AIR FARE (₹)";
      const customDetail = fd.get("customDetail") ? String(fd.get("customDetail")).trim() : "";
      const finalTitle = customDetail ? `${expenseType} - ${customDetail}` : expenseType;

      const { error: insertError } = await supabase.from("expense_claims" as any).insert({
        employee_id: myEmployee.id,
        title: finalTitle,
        amount: Number(fd.get("amount")),
        category: expenseType,
        receipt_url: receiptUrl,
        notes: fd.get("notes") ? String(fd.get("notes")) : null,
        status: "pending",
      });

      if (insertError) throw insertError;

      toast.success("Single expense claim submitted!");
      setOpenLegacyClaim(false);
      setSingleClaimFileName("");
      qc.invalidateQueries({ queryKey: ["expense-claims"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit claim.");
    } finally {
      setLegacyBusy(false);
    }
  };

  // Status badge styling helper
  const renderBatchStatusBadge = (status: BatchExpenseClaim["status"]) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-black text-[10px] uppercase">Draft</Badge>;
      case "pending_manager":
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-black text-[10px] uppercase">Pending RM Approval</Badge>;
      case "manager_approved":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 font-black text-[10px] uppercase">RM Verified • Pending HR</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 font-black text-[10px] uppercase">HR Approved • Reimbursed</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 font-black text-[10px] uppercase">Returned / Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
      {/* Header Banner - Daylight / Clean Theme */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6 bg-white dark:bg-slate-900 p-5 sm:p-7 md:p-8 rounded-3xl sm:rounded-[2.5rem] text-foreground shadow-card border-2 border-primary/10 relative overflow-hidden transition-colors">
        <div className="absolute right-0 top-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex items-center gap-3 sm:gap-3.5">
            <div className="size-11 sm:size-12 rounded-2xl bg-primary/10 dark:bg-primary/20 border border-primary/20 flex items-center justify-center text-primary shadow-sm shrink-0">
              <IndianRupee className="size-5 sm:size-6 text-primary" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                  {isAuthorized ? "Travel & DA Expense Automation Hub" : "My Travel & Expense Hub"}
                </h1>
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/70 font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 shadow-none">
                  Automated DA
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium mt-1">
                {isAuthorized
                  ? "Designation-wise daily allowances, 20-day batch sheets & comprehensive audit workflows."
                  : "Submit your 20-day travel batches, track daily DA eligibility, and upload supporting bills."}
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          {isAdmin && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-border text-xs font-bold shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode("admin")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl transition-all",
                  viewMode === "admin"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-black"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Admin Hub
              </button>
              <button
                type="button"
                onClick={() => setViewMode("employee")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl transition-all",
                  viewMode === "employee"
                    ? "bg-emerald-600 text-white shadow-sm font-black"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                My Employee View
              </button>
            </div>
          )}

          <Button
            onClick={() => setIsCreateBatchOpen(true)}
            className="h-11 sm:h-12 px-5 sm:px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black gap-2 shadow-lg shadow-emerald-600/20 hover:scale-105 transition-all text-xs sm:text-sm w-full sm:w-auto"
          >
            <Plus className="size-4 sm:size-5" /> New 20-Day Batch Claim
          </Button>
          {isAuthorized && (
            <Button
              variant="outline"
              onClick={() => exportMasterToExcel(masterList)}
              className="h-11 sm:h-12 px-4 sm:px-5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-muted text-foreground border-2 border-border font-bold gap-2 text-xs sm:text-sm shadow-sm w-full sm:w-auto"
            >
              <FileSpreadsheet className="size-4 text-emerald-600" /> Export Master (.xlsx)
            </Button>
          )}
        </div>
      </div>

      {/* Notice Banner when Admin is viewing in Employee Mode */}
      {isAdmin && viewMode === "employee" && (
        <div className="p-4 px-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-5 text-emerald-600 shrink-0" />
            <span>
              <strong>Employee Portal Active:</strong> Showing only your personal claims ({myEmployee?.full_name || "Self"}). All other employees' DA rates, claim batches, and Master Excel records are hidden.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setViewMode("admin")}
            className="h-8 rounded-xl font-black text-xs border-emerald-400 bg-white dark:bg-slate-900 hover:bg-emerald-100 shrink-0"
          >
            Switch to Admin Hub
          </Button>
        </div>
      )}

      {/* Primary KPI Ribbon - Strict Role Scoping */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        <Card className="p-5 rounded-3xl border-2 border-primary/5 bg-card shadow-sm hover:shadow-md transition-all">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Wallet className="size-3.5 text-indigo-500" /> {isAuthorized ? "Total Claim Volume" : "My Total Claims"}
          </p>
          <p className="text-2xl font-black mt-2 text-foreground">₹{batchAggregates.totalClaimVolume.toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {accessibleBatches.length} {isAuthorized ? "submitted batches" : "batches submitted"}
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border-2 border-primary/5 bg-card shadow-sm hover:shadow-md transition-all">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500" /> {isAuthorized ? "Eligible Daily DA" : "My Eligible DA"}
          </p>
          <p className="text-2xl font-black mt-2 text-emerald-600 dark:text-emerald-400">
            ₹{batchAggregates.totalEligibleDA.toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {isAuthorized ? "Rule A & B automated allowance" : "Calculated daily allowance"}
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border-2 border-primary/5 bg-card shadow-sm hover:shadow-md transition-all">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Plane className="size-3.5 text-blue-500" /> {isAuthorized ? "Outstation Travel & Hotel" : "My Outstation Expenses"}
          </p>
          <p className="text-2xl font-black mt-2 text-foreground">
            ₹{batchAggregates.totalOtherExpenses.toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Air, Rail, Fuel, Hotel & Food</p>
        </Card>

        <Card className="p-5 rounded-3xl border-2 border-primary/5 bg-card shadow-sm hover:shadow-md transition-all">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-500" /> {isAuthorized ? "Missing Bills" : "My Missing Bills"}
          </p>
          <p className={cn("text-2xl font-black mt-2", batchAggregates.totalMissingBills > 0 ? "text-amber-600" : "text-foreground")}>
            {batchAggregates.totalMissingBills}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {isAuthorized ? "Subject to remarks approval" : "Requires remarks explanation"}
          </p>
        </Card>

        <Card className="p-5 rounded-3xl border-2 border-primary/5 bg-card shadow-sm hover:shadow-md transition-all col-span-2 md:col-span-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-indigo-500" /> {isAuthorized ? "Approvals Pending" : "Claim Status"}
          </p>
          {isAuthorized ? (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm font-black px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800">
                RM: {batchAggregates.pendingRM}
              </span>
              <span className="text-sm font-black px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800">
                HR: {batchAggregates.pendingHR}
              </span>
            </div>
          ) : (
            <div className="mt-2">
              {batchAggregates.pendingRM > 0 ? (
                <span className="text-sm font-black px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 inline-block">
                  Under RM Review ({batchAggregates.pendingRM})
                </span>
              ) : batchAggregates.pendingHR > 0 ? (
                <span className="text-sm font-black px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 inline-block">
                  Under HR Review ({batchAggregates.pendingHR})
                </span>
              ) : (
                <span className="text-sm font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 inline-block">
                  Up-to-Date
                </span>
              )}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {isAuthorized ? "Multi-stage review queue" : "Current submission workflow"}
          </p>
        </Card>
      </div>

      {/* Tabs Navigation - Strict RBAC */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="w-full sm:w-auto overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            <TabsList className="bg-muted/50 p-1.5 rounded-2xl border inline-flex w-max flex-nowrap shrink-0">
              <TabsTrigger value="batches" className="rounded-xl font-black text-xs gap-2 py-2 px-3.5 whitespace-nowrap">
                <Calendar className="size-4" /> {isAuthorized ? "20-Day Batch Claims" : "My 20-Day Claims"}
                <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-primary/10 text-primary">
                  {filteredBatches.length}
                </span>
              </TabsTrigger>

              {/* ONLY Admins and Managers can see the Employee Master DA Sheet */}
              {isAuthorized && (
                <TabsTrigger value="master" className="rounded-xl font-black text-xs gap-2 py-2 px-3.5 whitespace-nowrap">
                  <UsersIcon className="size-4" /> Employee Master DA Sheet
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-primary/10 text-primary">
                    {masterList.length}
                  </span>
                </TabsTrigger>
              )}

              {/* ONLY Admins and Managers can see company-wide Summaries & Analytics */}
              {isAuthorized && (
                <TabsTrigger value="summaries" className="rounded-xl font-black text-xs gap-2 py-2 px-3.5 whitespace-nowrap">
                  <TrendingUp className="size-4" /> Summaries & Analytics
                </TabsTrigger>
              )}

              <TabsTrigger value="individual" className="rounded-xl font-black text-xs gap-2 py-2 px-3.5 whitespace-nowrap">
                <Receipt className="size-4" /> {isAuthorized ? "Single Ad-Hoc Claims" : "My Single Claims"}
              </TabsTrigger>
            </TabsList>
          </div>

          {activeTab === "batches" && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search batches..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  className="h-10 pl-9 rounded-xl text-xs font-bold w-full"
                />
              </div>
              <Select value={batchStatusFilter} onValueChange={setBatchStatusFilter}>
                <SelectTrigger className="h-10 w-full sm:w-44 rounded-xl text-xs font-bold">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_manager">Pending RM</SelectItem>
                  <SelectItem value="manager_approved">Pending HR</SelectItem>
                  <SelectItem value="approved">Approved & Reimbursed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* TAB 1: 20-DAY BATCH CLAIMS (Strictly Scoped) */}
        <TabsContent value="batches" className="space-y-4 sm:space-y-6">
          {filteredBatches.length === 0 ? (
            <Card className="rounded-2xl sm:rounded-[2.5rem] border-2 border-primary/5 shadow-card p-8 sm:p-14 text-center">
              <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                <div className="size-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Calendar className="size-7" />
                </div>
                <p className="font-black text-base text-foreground">No 20-Day Batch Claims Found</p>
                <p className="text-xs text-muted-foreground">
                  {isAuthorized
                    ? "No matching batch claims in this view."
                    : "You have not submitted any 20-day batch claims yet. Click below to generate your first batch."}
                </p>
                <Button onClick={() => setIsCreateBatchOpen(true)} className="rounded-xl font-bold gap-2 mt-2 w-full sm:w-auto">
                  <Plus className="size-4" /> Create 20-Day Batch Claim
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {/* Mobile View: Responsive Touch Cards (block md:hidden) */}
              <div className="block md:hidden space-y-3.5">
                {filteredBatches.map((b) => (
                  <Card key={b.id} className="p-4 rounded-2xl border-2 border-primary/5 bg-card shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="size-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0">
                          20D
                        </div>
                        <div>
                          <p className="font-black text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                            {isAuthorized ? b.employeeName : b.batchNumber}
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {isAuthorized ? `(${b.batchNumber})` : `(${b.designation})`}
                            </span>
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {b.designation} • {b.department}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">{renderBatchStatusBadge(b.status)}</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/40 text-xs flex items-center justify-between">
                      <span className="text-muted-foreground font-medium">Period (20 Days):</span>
                      <span className="font-bold text-foreground">{b.startDate} to {b.endDate}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-border/60 text-center">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Eligible DA</span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          ₹{b.totalEligibleDA.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Outstation</span>
                        <span className="text-xs font-bold text-foreground">
                          ₹{b.totalOtherExpenses.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Total Claim</span>
                        <span className="text-sm font-black text-foreground">
                          ₹{b.totalClaimAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    {(b.missingBillsCount > 0 || b.exceptionsCount > 0) && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {b.missingBillsCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            {b.missingBillsCount} Bill(s) Missing
                          </span>
                        )}
                        {b.exceptionsCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300">
                            {b.exceptionsCount} Exceptions
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-9 rounded-xl font-bold text-xs gap-1.5 border-primary/20 hover:bg-primary/10"
                        onClick={() => {
                          setSelectedBatch(b);
                          setIsBatchEditorOpen(true);
                        }}
                      >
                        <Eye className="size-3.5" /> Open Sheet
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-9 rounded-xl text-emerald-600 hover:bg-emerald-50 shrink-0"
                        onClick={() => exportBatchToExcel(b)}
                        title="Download Excel (.xlsx)"
                      >
                        <Download className="size-4" />
                      </Button>
                      {isAuthorized && b.status === "pending_manager" && (
                        <Button
                          size="sm"
                          className="h-9 rounded-xl font-black text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1 shrink-0"
                          onClick={() => setApprovingBatch({ batch: b, stage: "manager", action: "approve" })}
                        >
                          Verify RM
                        </Button>
                      )}
                      {isAdmin && b.status === "manager_approved" && (
                        <Button
                          size="sm"
                          className="h-9 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shrink-0"
                          onClick={() => setApprovingBatch({ batch: b, stage: "hr", action: "approve" })}
                        >
                          Approve HR
                        </Button>
                      )}
                      {b.status === "draft" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9 rounded-xl text-rose-500 hover:bg-rose-50 shrink-0"
                          onClick={() => {
                            if (confirm("Delete this draft batch?")) {
                              const updated = deleteBatch(b.id);
                              setBatches(updated);
                              toast.success("Draft batch deleted.");
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop View: Full Spreadsheet Table (hidden md:block) */}
              <Card className="hidden md:block rounded-[2.5rem] border-2 border-primary/5 shadow-card overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[850px]">
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                      <TableRow>
                        <TableHead className="pl-6 font-black uppercase text-[10px] tracking-widest">
                          {isAuthorized ? "Batch & Employee" : "My Batch Number"}
                        </TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest">Period (20 Days)</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Eligible DA</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Outstation Exp</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Total Claim</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status & Flags</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBatches.map((b) => (
                        <TableRow key={b.id} className="hover:bg-primary/5 transition-colors group">
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0">
                                20D
                              </div>
                              <div>
                                <p className="font-black text-sm text-foreground flex items-center gap-2">
                                  {isAuthorized ? b.employeeName : b.batchNumber}
                                  <span className="text-[10px] font-bold text-muted-foreground/60">
                                    {isAuthorized ? b.batchNumber : `(${b.designation})`}
                                  </span>
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                  {b.designation} • {b.department}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs font-bold text-foreground block">{b.startDate} to {b.endDate}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">20 Calendar Days</span>
                          </TableCell>

                          <TableCell className="text-right">
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              ₹{b.totalEligibleDA.toLocaleString("en-IN")}
                            </span>
                          </TableCell>

                          <TableCell className="text-right">
                            <span className="text-sm font-bold text-foreground">
                              ₹{b.totalOtherExpenses.toLocaleString("en-IN")}
                            </span>
                          </TableCell>

                          <TableCell className="text-right">
                            <span className="text-base font-black text-foreground">
                              ₹{b.totalClaimAmount.toLocaleString("en-IN")}
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              {renderBatchStatusBadge(b.status)}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {b.missingBillsCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800" title="Missing bills">
                                    {b.missingBillsCount} Bill Missing
                                  </span>
                                )}
                                {b.exceptionsCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-800" title="Exceptions">
                                    {b.exceptionsCount} Exceptions
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-xl font-bold text-xs gap-1.5 border-primary/20 hover:bg-primary/10"
                                onClick={() => {
                                  setSelectedBatch(b);
                                  setIsBatchEditorOpen(true);
                                }}
                              >
                                <Eye className="size-3.5" /> Open Sheet
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 rounded-xl text-emerald-600 hover:bg-emerald-50"
                                onClick={() => exportBatchToExcel(b)}
                                title="Download Excel (.xlsx)"
                              >
                                <Download className="size-4" />
                              </Button>

                              {/* Approval Actions for Managers & Admins */}
                              {isAuthorized && b.status === "pending_manager" && (
                                <Button
                                  size="sm"
                                  className="h-8 rounded-xl font-black text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                                  onClick={() => setApprovingBatch({ batch: b, stage: "manager", action: "approve" })}
                                >
                                  Verify RM
                                </Button>
                              )}

                              {isAdmin && b.status === "manager_approved" && (
                                <Button
                                  size="sm"
                                  className="h-8 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                  onClick={() => setApprovingBatch({ batch: b, stage: "hr", action: "approve" })}
                                >
                                  Approve HR
                                </Button>
                              )}

                              {b.status === "draft" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-8 rounded-xl text-rose-500 hover:bg-rose-50"
                                  onClick={() => {
                                    if (confirm("Delete this draft batch?")) {
                                      const updated = deleteBatch(b.id);
                                      setBatches(updated);
                                      toast.success("Draft batch deleted.");
                                    }
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        {/* TAB 2: EMPLOYEE MASTER DA SHEET (AUTHORIZED ONLY) */}
        {isAuthorized && (
          <TabsContent value="master" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30 p-5 rounded-3xl border">
              <div>
                <h3 className="font-black text-lg tracking-tight flex items-center gap-2">
                  <UsersIcon className="size-5 text-indigo-500" /> Excel Employee Master Data (Admin / HR View)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Designation-wise daily allowance rules and fixed DA rates. Restricted to management & HR only.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search master..."
                    value={masterSearch}
                    onChange={(e) => setMasterSearch(e.target.value)}
                    className="h-9 pl-9 rounded-xl text-xs font-bold"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold text-xs gap-1.5"
                  onClick={() => masterFileInputRef.current?.click()}
                >
                  <Upload className="size-3.5" /> Upload Excel
                </Button>
                <input
                  type="file"
                  ref={masterFileInputRef}
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleUploadMasterExcel}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold text-xs gap-1.5"
                  onClick={() => exportMasterToExcel(masterList)}
                >
                  <Download className="size-3.5" /> Export Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold text-xs gap-1.5 text-rose-600 hover:bg-rose-50"
                  onClick={handleResetMaster}
                >
                  <RefreshCw className="size-3.5" /> Reset Default (41)
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl font-black text-xs gap-1.5"
                  onClick={() => setIsAddMasterOpen(true)}
                >
                  <Plus className="size-3.5" /> Add Employee
                </Button>
              </div>
            </div>

            <Card className="rounded-[2.5rem] border-2 border-primary/5 shadow-card overflow-hidden">
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[760px]">
                  <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead className="pl-6 font-black uppercase text-[10px] tracking-widest">SR NO</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">Employee Name</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">Department</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">Designation</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">Location</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Fixed Daily DA</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">Applicable DA Rule</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaster.map((m) => {
                      const isPhleb = isPhlebotomist(m.designation);
                      const isMissingDA = m.fixedDailyDA === null || m.fixedDailyDA === undefined;
                      const isZeroDA = m.fixedDailyDA === 0;

                      return (
                        <TableRow key={m.srNo} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="pl-6 font-bold text-xs text-muted-foreground">{m.srNo}</TableCell>
                          <TableCell className="font-black text-sm text-foreground">
                            {m.name}
                            {isMissingDA && (
                              <Badge variant="destructive" className="ml-2 text-[8px] font-black uppercase">
                                DA Rate Missing
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-muted-foreground">{m.department}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-black text-[10px] uppercase",
                                isPhleb ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-indigo-50 text-indigo-800 border-indigo-200"
                              )}
                            >
                              {m.designation}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-muted-foreground">{m.location}</TableCell>
                          <TableCell className="text-right">
                            {isMissingDA ? (
                              <span className="text-xs font-bold text-rose-500 italic">Rate Missing</span>
                            ) : isZeroDA ? (
                              <span className="text-xs font-bold text-muted-foreground">₹0</span>
                            ) : (
                              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                ₹{m.fixedDailyDA}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                m.daRule === "Check-In/Check-Out"
                                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                                  : "bg-blue-100 text-blue-900 border border-blue-200"
                              )}
                            >
                              {m.daRule === "Check-In/Check-Out" ? "Check-In/Check-Out" : "Doctor Visit"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 rounded-xl text-indigo-600 hover:bg-indigo-50"
                              onClick={() => setEditingMasterRecord(m)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        )}

        {/* TAB 3: SUMMARIES & ANALYTICS (AUTHORIZED ONLY) */}
        {isAuthorized && (
          <TabsContent value="summaries" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="rounded-[2.5rem] border-2 border-primary/5 shadow-card p-6">
                <h3 className="font-black text-base tracking-tight mb-4 flex items-center gap-2">
                  <UsersIcon className="size-4 text-indigo-500" /> Employee-Wise Expense Summary
                </h3>
                <div className="overflow-x-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase">Employee</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right">Eligible DA</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right">Other Exp</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right">Total Claim</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeWiseSummary.map((emp) => (
                        <TableRow key={emp.employeeId}>
                          <TableCell>
                            <p className="font-bold text-xs text-foreground">{emp.name}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">{emp.designation}</p>
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-emerald-600">
                            ₹{emp.totalDA.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-foreground">
                            ₹{emp.totalOther.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right text-xs font-black text-foreground">
                            ₹{emp.totalClaim.toLocaleString("en-IN")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-2 border-primary/5 shadow-card p-6">
                <h3 className="font-black text-base tracking-tight mb-4 flex items-center gap-2">
                  <Calendar className="size-4 text-emerald-500" /> Date-Wise Expense Summary
                </h3>
                <div className="overflow-x-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right">Daily DA</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right">Outstation</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dateWiseSummary.map((d) => (
                        <TableRow key={d.date}>
                          <TableCell className="text-xs font-bold text-foreground">{d.date}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-emerald-600">
                            ₹{d.totalDA.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-foreground">
                            ₹{d.totalExpenses.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right text-xs font-black text-foreground">
                            ₹{d.totalClaim.toLocaleString("en-IN")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* TAB 4: INDIVIDUAL AD-HOC CLAIMS */}
        <TabsContent value="individual" className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/30 p-4 rounded-2xl border">
            <div>
              <h3 className="font-black text-sm tracking-tight">
                {isAuthorized ? "Ad-hoc Individual Claim Records" : "My Ad-hoc Claims"}
              </h3>
              <p className="text-xs text-muted-foreground">Single receipts and miscellaneous non-batch expense vouchers.</p>
            </div>
            {myEmployee && (
              <Button onClick={() => setOpenLegacyClaim(true)} className="rounded-xl font-bold text-xs gap-1.5 w-full sm:w-auto">
                <Plus className="size-4" /> Submit Single Claim
              </Button>
            )}
          </div>

          {/* Mobile View: Clean Cards for Small Screens (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {dbClaims.filter((c: any) => c.category !== "travel_da_batch").length === 0 ? (
              <Card className="p-8 rounded-2xl text-center text-xs text-muted-foreground border">
                No ad-hoc claims found. Use the 20-Day Batch Claims tab for travel and daily DA.
              </Card>
            ) : (
              dbClaims
                .filter((c: any) => c.category !== "travel_da_batch")
                .map((c: any) => (
                  <Card key={c.id} className="p-4 rounded-2xl border bg-card shadow-sm space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-sm text-foreground">{c.title}</p>
                        {isAuthorized && (
                          <p className="text-xs text-muted-foreground font-medium">{c.employees?.full_name}</p>
                        )}
                      </div>
                      <Badge
                        className={cn(
                          "text-[10px] uppercase font-black shrink-0",
                          c.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : c.status === "rejected"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        )}
                      >
                        {c.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">{c.category}</Badge>
                      <span className="font-black text-sm text-foreground">₹{Number(c.amount).toLocaleString("en-IN")}</span>
                    </div>

                    {c.receipt_url && (
                      <div className="pt-1">
                        <Button size="sm" variant="outline" className="w-full h-8 text-xs font-bold gap-1.5" asChild>
                          <a href={c.receipt_url} target="_blank" rel="noreferrer"><Eye className="size-3.5" /> View Receipt</a>
                        </Button>
                      </div>
                    )}
                  </Card>
                ))
            )}
          </div>

          {/* Desktop View: Full Table (hidden md:block) */}
          <Card className="hidden md:block rounded-[2.5rem] border-2 border-primary/5 shadow-card overflow-hidden">
            <div className="overflow-x-auto w-full">
              <Table className="min-w-[650px]">
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="pl-6 font-black uppercase text-[10px] tracking-widest">Title</TableHead>
                    {isAuthorized && (
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">Employee</TableHead>
                    )}
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Category</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Amount</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-6">Proof</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbClaims.filter((c: any) => c.category !== "travel_da_batch").length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAuthorized ? 6 : 5} className="py-16 text-center text-xs text-muted-foreground">
                        No ad-hoc claims found. Use the 20-Day Batch Claims tab for travel and daily DA.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dbClaims
                      .filter((c: any) => c.category !== "travel_da_batch")
                      .map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="pl-6 font-bold text-sm">{c.title}</TableCell>
                          {isAuthorized && (
                            <TableCell className="text-xs font-bold text-muted-foreground">{c.employees?.full_name}</TableCell>
                          )}
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold">{c.category}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={cn(
                                "text-[10px] uppercase font-black",
                                c.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : c.status === "rejected"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-800"
                              )}
                            >
                              {c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-black text-sm">₹{Number(c.amount).toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-right pr-6">
                            {c.receipt_url ? (
                              <Button size="icon" variant="ghost" className="size-8" asChild>
                                <a href={c.receipt_url} target="_blank" rel="noreferrer"><Eye className="size-4" /></a>
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">No Bill</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE 20-DAY BATCH MODAL */}
      <Dialog open={isCreateBatchOpen} onOpenChange={setIsCreateBatchOpen}>
        <DialogContent className="rounded-3xl p-8 border-2 border-primary/5 shadow-elegant max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Calendar className="size-6 text-indigo-500" /> New 20-Day Batch Claim
            </DialogTitle>
            <DialogDescription>
              {isAuthorized
                ? "Select employee and start date. The system auto-populates attendance, doctor visits, and designation-wise DA calculations."
                : "Submit your 20-day travel & daily expense claim. Attendance and doctor visit records will be automatically verified."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Employee
              </Label>
              {isAuthorized ? (
                <Select value={newBatchEmployeeId} onValueChange={setNewBatchEmployeeId}>
                  <SelectTrigger className="h-12 rounded-xl border-2">
                    <SelectValue placeholder="Select Employee..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {allEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.designation || "No Designation"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-12 rounded-xl border-2 px-4 flex items-center bg-muted/40 font-black text-sm text-foreground justify-between">
                  <span>{myEmployee?.full_name || "Current Employee"}</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold">{myEmployee?.designation || "Employee"}</Badge>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Period Start Date (20 Consecutive Days)
              </Label>
              <Input
                type="date"
                value={newBatchStartDate}
                onChange={(e) => setNewBatchStartDate(e.target.value)}
                className="h-12 rounded-xl border-2 font-bold"
              />
            </div>

            {(isAuthorized ? newBatchEmployeeId : myEmployee?.id) && (
              <div className="p-4 rounded-2xl bg-muted/40 border text-xs space-y-1">
                {(() => {
                  const emp = isAuthorized
                    ? allEmployees.find((e) => e.id === newBatchEmployeeId)
                    : myEmployee;
                  const m = emp ? findEmployeeInMaster(emp.full_name, emp.designation, masterList) : null;
                  if (!m) {
                    return (
                      <p className="text-amber-600 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="size-4 shrink-0" />
                        Employee Master Data Missing: Not in Excel Master table. Defaulting to doctor visit rule.
                      </p>
                    );
                  }
                  return (
                    <div>
                      <p className="font-black text-foreground">{m.name} • {m.designation}</p>
                      <p className="text-muted-foreground mt-0.5">
                        Fixed Daily DA: <span className="font-bold text-emerald-600">₹{m.fixedDailyDA ?? "Missing"}</span> • DA Rule: <span className="font-bold text-indigo-600">{m.daRule}</span>
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <DialogFooter className="gap-3">
            <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setIsCreateBatchOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isGeneratingBatch}
              onClick={handleGenerateBatch}
              className="rounded-xl font-black px-8 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isGeneratingBatch ? "Auto-Populating..." : "Generate Batch Sheet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 20-DAY DAILY EXPENSE CLAIM SHEET DIALOG (FULL-SCREEN SPREADSHEET EDITOR) */}
      <Dialog open={isBatchEditorOpen} onOpenChange={setIsBatchEditorOpen}>
        <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] rounded-[2rem] p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-card">
          {selectedBatch && (
            !isAuthorized && myEmployee && selectedBatch.employeeId !== myEmployee.id ? (
              <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4">
                <AlertTriangle className="size-12 text-rose-500" />
                <h3 className="font-black text-xl text-foreground">Access Restricted</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  You are only permitted to view and manage your own expense claims. Another employee's claim details cannot be displayed.
                </p>
                <Button onClick={() => setIsBatchEditorOpen(false)} className="rounded-xl font-bold">
                  Return to My Expenses
                </Button>
              </div>
            ) : (
            <div className="flex flex-col h-full">
              {/* Header - Daylight Theme */}
              <div className="p-6 bg-white dark:bg-slate-900 text-foreground shrink-0 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                      <FileSpreadsheet className="size-6 text-emerald-600" />
                      Daily Expense Claim Sheet (20 Days)
                    </h2>
                    {renderBatchStatusBadge(selectedBatch.status)}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mt-1">
                    Employee: <span className="font-black text-foreground">{selectedBatch.employeeName}</span> ({selectedBatch.designation}) • Period: {selectedBatch.startDate} to {selectedBatch.endDate}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-xl bg-white dark:bg-slate-800 hover:bg-muted text-foreground border-2 border-border font-bold gap-2 text-xs shadow-sm"
                    onClick={() => exportBatchToExcel(selectedBatch)}
                  >
                    <Download className="size-4 text-emerald-600" /> Export Excel (.xlsx)
                  </Button>

                  {selectedBatch.status === "draft" && (
                    <Button
                      size="sm"
                      className="h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black gap-2 text-xs"
                      onClick={() => handleSubmitBatch(selectedBatch)}
                    >
                      <Check className="size-4" /> Submit Batch
                    </Button>
                  )}

                  {isAuthorized && selectedBatch.status === "pending_manager" && (
                    <Button
                      size="sm"
                      className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-1.5"
                      onClick={() => setApprovingBatch({ batch: selectedBatch, stage: "manager", action: "approve" })}
                    >
                      <ShieldCheck className="size-4" /> Reporting Manager Review
                    </Button>
                  )}

                  {isAdmin && selectedBatch.status === "manager_approved" && (
                    <Button
                      size="sm"
                      className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5"
                      onClick={() => setApprovingBatch({ batch: selectedBatch, stage: "hr", action: "approve" })}
                    >
                      <ShieldCheck className="size-4" /> HR Reimbursement Review
                    </Button>
                  )}
                </div>
              </div>

              {/* KPI Strip */}
              <div className="bg-muted/40 p-3 px-6 border-b flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Eligible DA</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      ₹{selectedBatch.totalEligibleDA.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="h-6 w-[1px] bg-border" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Outstation Expenses</span>
                    <span className="text-base font-black text-foreground">
                      ₹{selectedBatch.totalOtherExpenses.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="h-6 w-[1px] bg-border" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Claim Amount</span>
                    <span className="text-base font-black text-foreground">
                      ₹{selectedBatch.totalClaimAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedBatch.missingBillsCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5" />
                      {selectedBatch.missingBillsCount} Bill(s) Missing – Remarks Required
                    </span>
                  )}
                  {selectedBatch.exceptionsCount > 0 && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-900 border border-rose-300">
                      {selectedBatch.exceptionsCount} Exceptions Flagged
                    </span>
                  )}
                </div>
              </div>

              {/* Editable Spreadsheet Table */}
              <div className="flex-1 overflow-auto">
                <Table className="min-w-[1300px]">
                  <TableHeader className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 z-20 shadow-sm text-[10px]">
                    <TableRow>
                      <TableHead className="font-black uppercase w-24">Date</TableHead>
                      <TableHead className="font-black uppercase text-center w-28">Check-In / Out</TableHead>
                      <TableHead className="font-black uppercase text-center w-24">Doctor Visits</TableHead>
                      <TableHead className="font-black uppercase text-center w-28">DA Rule & Rate</TableHead>
                      <TableHead className="font-black uppercase text-center w-24">DA Payable</TableHead>
                      <TableHead className="font-black uppercase text-right w-24">Air Fare (₹)</TableHead>
                      <TableHead className="font-black uppercase text-right w-24">Rail Fare (₹)</TableHead>
                      <TableHead className="font-black uppercase text-right w-24">Petrol (₹)</TableHead>
                      <TableHead className="font-black uppercase text-right w-24">Local (₹)</TableHead>
                      <TableHead className="font-black uppercase text-right w-24">Food (₹)</TableHead>
                      <TableHead className="font-black uppercase text-right w-24">Lodging (₹)</TableHead>
                      <TableHead className="font-black uppercase text-right w-24">Other (₹)</TableHead>
                      <TableHead className="font-black uppercase text-right w-28">Total Exp (₹)</TableHead>
                      <TableHead className="font-black uppercase text-center w-24">Bills Attached</TableHead>
                      <TableHead className="font-black uppercase w-48">Remarks / Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedBatch.rows.map((r, rowIdx) => {
                      const isEligible = r.daEligibility === "Eligible";
                      const isBatchEditable = selectedBatch.status === "draft";
                      return (
                        <TableRow key={r.date} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-black text-xs whitespace-nowrap">{r.date}</TableCell>

                          <TableCell className="text-center text-xs">
                            <div className="flex flex-col items-center">
                              <span className={cn("font-bold text-[11px]", r.checkInValid ? "text-emerald-600" : "text-rose-500")}>
                                In: {r.checkIn || "✗"}
                              </span>
                              <span className={cn("font-bold text-[11px]", r.checkOutValid ? "text-emerald-600" : "text-rose-500")}>
                                Out: {r.checkOut || "✗"}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <span
                              className={cn(
                                "inline-flex size-6 items-center justify-center rounded-full text-xs font-black",
                                r.doctorVisits >= 1 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                              )}
                            >
                              {r.doctorVisits}
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-muted-foreground uppercase">{r.daRule}</span>
                              <span className="text-xs font-bold text-foreground">
                                {r.fixedDA !== null ? `₹${r.fixedDA}` : "Rate Missing"}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex flex-col items-center">
                              <span
                                className={cn(
                                  "font-black text-xs px-2 py-0.5 rounded-lg",
                                  isEligible ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                                )}
                              >
                                ₹{r.daPayable}
                              </span>
                              <span className="text-[8px] font-bold text-muted-foreground uppercase mt-0.5">
                                {r.daEligibility}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="text-right p-1">
                            <Input
                              type="number"
                              min="0"
                              disabled={!isBatchEditable}
                              value={r.airFare || ""}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const updatedRows = [...selectedBatch.rows];
                                updatedRows[rowIdx] = { ...r, airFare: val };
                                const recalculated = recalculateBatch({ ...selectedBatch, rows: updatedRows });
                                setSelectedBatch(recalculated);
                                saveBatch(recalculated);
                              }}
                              placeholder="0"
                              className="h-8 text-right text-xs font-bold rounded-lg"
                            />
                          </TableCell>

                          <TableCell className="text-right p-1">
                            <Input
                              type="number"
                              min="0"
                              disabled={!isBatchEditable}
                              value={r.railFare || ""}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const updatedRows = [...selectedBatch.rows];
                                updatedRows[rowIdx] = { ...r, railFare: val };
                                const recalculated = recalculateBatch({ ...selectedBatch, rows: updatedRows });
                                setSelectedBatch(recalculated);
                                saveBatch(recalculated);
                              }}
                              placeholder="0"
                              className="h-8 text-right text-xs font-bold rounded-lg"
                            />
                          </TableCell>

                          <TableCell className="text-right p-1">
                            <Input
                              type="number"
                              min="0"
                              disabled={!isBatchEditable}
                              value={r.petrolRoad || ""}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const updatedRows = [...selectedBatch.rows];
                                updatedRows[rowIdx] = { ...r, petrolRoad: val };
                                const recalculated = recalculateBatch({ ...selectedBatch, rows: updatedRows });
                                setSelectedBatch(recalculated);
                                saveBatch(recalculated);
                              }}
                              placeholder="0"
                              className="h-8 text-right text-xs font-bold rounded-lg"
                            />
                          </TableCell>

                          <TableCell className="text-right p-1">
                            <Input
                              type="number"
                              min="0"
                              disabled={!isBatchEditable}
                              value={r.localTravel || ""}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const updatedRows = [...selectedBatch.rows];
                                updatedRows[rowIdx] = { ...r, localTravel: val };
                                const recalculated = recalculateBatch({ ...selectedBatch, rows: updatedRows });
                                setSelectedBatch(recalculated);
                                saveBatch(recalculated);
                              }}
                              placeholder="0"
                              className="h-8 text-right text-xs font-bold rounded-lg"
                            />
                          </TableCell>

                          <TableCell className="text-right p-1">
                            <Input
                              type="number"
                              min="0"
                              disabled={!isBatchEditable}
                              value={r.lunchDinner || ""}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const updatedRows = [...selectedBatch.rows];
                                updatedRows[rowIdx] = { ...r, lunchDinner: val };
                                const recalculated = recalculateBatch({ ...selectedBatch, rows: updatedRows });
                                setSelectedBatch(recalculated);
                                saveBatch(recalculated);
                              }}
                              placeholder="0"
                              className="h-8 text-right text-xs font-bold rounded-lg"
                            />
                          </TableCell>

                          <TableCell className="text-right p-1">
                            <Input
                              type="number"
                              min="0"
                              disabled={!isBatchEditable}
                              value={r.lodging || ""}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const updatedRows = [...selectedBatch.rows];
                                updatedRows[rowIdx] = { ...r, lodging: val };
                                const recalculated = recalculateBatch({ ...selectedBatch, rows: updatedRows });
                                setSelectedBatch(recalculated);
                                saveBatch(recalculated);
                              }}
                              placeholder="0"
                              className="h-8 text-right text-xs font-bold rounded-lg"
                            />
                          </TableCell>

                          <TableCell className="text-right p-1">
                            <Input
                              type="number"
                              min="0"
                              disabled={!isBatchEditable}
                              value={r.otherExpenses || ""}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const updatedRows = [...selectedBatch.rows];
                                updatedRows[rowIdx] = { ...r, otherExpenses: val };
                                const recalculated = recalculateBatch({ ...selectedBatch, rows: updatedRows });
                                setSelectedBatch(recalculated);
                                saveBatch(recalculated);
                              }}
                              placeholder="0"
                              className="h-8 text-right text-xs font-bold rounded-lg"
                            />
                          </TableCell>

                          <TableCell className="text-right font-black text-sm text-foreground whitespace-nowrap">
                            ₹{r.totalExpense}
                          </TableCell>

                          <TableCell className="text-center p-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={cn(
                                "h-8 px-2 rounded-lg text-xs gap-1 font-bold",
                                (r.attachments || []).length > 0
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : r.billMissing
                                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "text-muted-foreground"
                              )}
                              onClick={() => {
                                setAttachmentRowIndex(rowIdx);
                              }}
                            >
                              <Paperclip className="size-3.5" />
                              {(r.attachments || []).length}
                            </Button>
                          </TableCell>

                          <TableCell className="p-1">
                            <div className="space-y-1">
                              <Input
                                disabled={!isBatchEditable}
                                value={r.remarks || ""}
                                onChange={(e) => {
                                  const updatedRows = [...selectedBatch.rows];
                                  updatedRows[rowIdx] = { ...r, remarks: e.target.value };
                                  const recalculated = recalculateBatch({ ...selectedBatch, rows: updatedRows });
                                  setSelectedBatch(recalculated);
                                  saveBatch(recalculated);
                                }}
                                placeholder={r.billMissing ? "Explain missing bill..." : "Optional remarks..."}
                                className={cn(
                                  "h-8 text-xs rounded-lg",
                                  r.remarksRequired ? "border-amber-400 bg-amber-50/40 text-amber-900" : ""
                                )}
                              />
                              {r.exceptions.length > 0 && (
                                <p className="text-[9px] font-bold text-rose-600 line-clamp-1" title={r.exceptions.join("; ")}>
                                  {r.exceptions[0]}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </DialogContent>
      </Dialog>

      {/* BILL ATTACHMENT DIALOG FOR A SPECIFIC ROW */}
      <Dialog
        open={attachmentRowIndex !== null}
        onOpenChange={(v) => !v && setAttachmentRowIndex(null)}
      >
        <DialogContent className="rounded-3xl p-6 border-2 border-primary/5 shadow-elegant max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
              <Paperclip className="size-5 text-indigo-500" /> Supporting Bills & Receipts
            </DialogTitle>
            <DialogDescription>
              {selectedBatch && attachmentRowIndex !== null && (
                <>Attach bills for {selectedBatch.rows[attachmentRowIndex]?.date}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedBatch && attachmentRowIndex !== null && (
            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Expense Category
                </Label>
                <Select value={attachmentExpenseType} onValueChange={setAttachmentExpenseType}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="airFare">Air Fare ({OUTSTATION_DOCUMENT_REQUIREMENTS.airFare})</SelectItem>
                    <SelectItem value="railFare">Rail Fare ({OUTSTATION_DOCUMENT_REQUIREMENTS.railFare})</SelectItem>
                    <SelectItem value="petrolRoad">Road Fare / Petrol ({OUTSTATION_DOCUMENT_REQUIREMENTS.petrolRoad})</SelectItem>
                    <SelectItem value="localTravel">Local Travel ({OUTSTATION_DOCUMENT_REQUIREMENTS.localTravel})</SelectItem>
                    <SelectItem value="lunchDinner">Lunch / Dinner ({OUTSTATION_DOCUMENT_REQUIREMENTS.lunchDinner})</SelectItem>
                    <SelectItem value="lodging">Lodging / Hotel ({OUTSTATION_DOCUMENT_REQUIREMENTS.lodging})</SelectItem>
                    <SelectItem value="otherExpenses">Other Expenses ({OUTSTATION_DOCUMENT_REQUIREMENTS.otherExpenses})</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Upload Dropzone */}
              <div
                className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => billFileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={billFileInputRef}
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={handleUploadBillForRow}
                />
                <Upload className="size-8 text-muted-foreground mb-1" />
                <p className="text-xs font-bold text-foreground">Click to upload bill / receipt</p>
                <p className="text-[10px] text-muted-foreground/60">Image or PDF (Flight ticket, hotel invoice, train ticket, etc.)</p>
              </div>

              {/* Existing Attachments */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  Attached Documents ({(selectedBatch.rows[attachmentRowIndex]?.attachments || []).length})
                </p>
                {(selectedBatch.rows[attachmentRowIndex]?.attachments || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 italic">No documents attached yet.</p>
                ) : (
                  (selectedBatch.rows[attachmentRowIndex]?.attachments || []).map((att, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border text-xs">
                      <div className="flex items-center gap-2 truncate flex-1">
                        <FileText className="size-4 text-primary shrink-0" />
                        <span className="font-bold truncate">{att.name}</span>
                        <Badge variant="outline" className="text-[8px] uppercase">{att.expenseType}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {att.url && (
                          <Button size="icon" variant="ghost" className="size-7" asChild>
                            <a href={att.url} target="_blank" rel="noreferrer"><Eye className="size-3.5" /></a>
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-rose-500 hover:bg-rose-50"
                          onClick={() => {
                            const updatedRows = [...selectedBatch.rows];
                            const curAtts = updatedRows[attachmentRowIndex].attachments || [];
                            updatedRows[attachmentRowIndex].attachments = curAtts.filter((_, idx) => idx !== i);
                            const recalculated = recalculateBatch({ ...selectedBatch, rows: updatedRows });
                            setSelectedBatch(recalculated);
                            saveBatch(recalculated);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button className="w-full rounded-xl font-bold" onClick={() => setAttachmentRowIndex(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* APPROVAL DIALOG FOR MANAGERS / HR */}
      <Dialog open={!!approvingBatch} onOpenChange={(v) => !v && setApprovingBatch(null)}>
        <DialogContent className="rounded-3xl p-6 border-2 border-primary/5 shadow-elegant max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">
              {approvingBatch?.stage === "manager" ? "Reporting Manager Verification" : "HR Reimbursement Approval"}
            </DialogTitle>
            <DialogDescription>
              {approvingBatch?.action === "approve"
                ? `Confirm ${approvingBatch.stage === "manager" ? "RM verification" : "HR approval"} for ${approvingBatch.batch.employeeName}`
                : `Return claim back to ${approvingBatch?.batch.employeeName} with remarks`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-4 rounded-2xl bg-muted/40 border text-xs space-y-1">
              <p><span className="font-bold">Total Claim:</span> ₹{approvingBatch?.batch.totalClaimAmount.toLocaleString("en-IN")}</p>
              <p><span className="font-bold">Eligible DA:</span> ₹{approvingBatch?.batch.totalEligibleDA.toLocaleString("en-IN")}</p>
              <p><span className="font-bold">Missing Bills:</span> {approvingBatch?.batch.missingBillsCount}</p>
              <p><span className="font-bold">Exceptions:</span> {approvingBatch?.batch.exceptionsCount}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Verification Remarks / Reason
              </Label>
              <Textarea
                placeholder="Add verification notes, approval confirmation, or reason for returning..."
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                className="rounded-xl border-2 min-h-[90px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setApprovingBatch(null)}>
              Cancel
            </Button>
            <Button
              className={cn(
                "rounded-xl font-black px-6",
                approvingBatch?.action === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
              )}
              onClick={handleConfirmApproval}
            >
              Confirm {approvingBatch?.action === "approve" ? "Approval" : "Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT MASTER RECORD DIALOG (AUTHORIZED ONLY) */}
      {isAuthorized && (
        <Dialog open={!!editingMasterRecord} onOpenChange={(v) => !v && setEditingMasterRecord(null)}>
          <DialogContent className="rounded-3xl p-6 border-2 border-primary/5 shadow-elegant max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                Edit Master DA Record
              </DialogTitle>
              <DialogDescription>
                Update Fixed Daily DA rate or applicable DA rule for this employee.
              </DialogDescription>
            </DialogHeader>

            {editingMasterRecord && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const rawDA = fd.get("fixedDailyDA");
                  const fixedDAVal = rawDA === "" ? null : Number(rawDA);
                  handleSaveMasterRecord({
                    ...editingMasterRecord,
                    department: String(fd.get("department")),
                    designation: String(fd.get("designation")),
                    location: String(fd.get("location")),
                    fixedDailyDA: fixedDAVal,
                    daRule: fd.get("daRule") as DARuleType,
                  });
                }}
                className="space-y-4 py-3"
              >
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Employee Name</Label>
                  <Input defaultValue={editingMasterRecord.name} disabled className="rounded-xl bg-muted" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Designation</Label>
                    <Input name="designation" defaultValue={editingMasterRecord.designation} required className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Location</Label>
                    <Input name="location" defaultValue={editingMasterRecord.location} required className="rounded-xl" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Department</Label>
                  <Input name="department" defaultValue={editingMasterRecord.department} required className="rounded-xl" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Fixed Daily DA (₹)</Label>
                    <Input
                      name="fixedDailyDA"
                      type="number"
                      defaultValue={editingMasterRecord.fixedDailyDA ?? ""}
                      placeholder="Rate missing"
                      className="rounded-xl font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">DA Rule</Label>
                    <Select name="daRule" defaultValue={editingMasterRecord.daRule}>
                      <SelectTrigger className="rounded-xl text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Doctor Visit">Doctor Visit</SelectItem>
                        <SelectItem value="Check-In/Check-Out">Check-In/Check-Out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter className="gap-2 pt-2">
                  <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => setEditingMasterRecord(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 text-white">
                    Save Master Record
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* ADD MASTER EMPLOYEE DIALOG (AUTHORIZED ONLY) */}
      {isAuthorized && (
        <Dialog open={isAddMasterOpen} onOpenChange={setIsAddMasterOpen}>
          <DialogContent className="rounded-3xl p-6 border-2 border-primary/5 shadow-elegant max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                Add Employee to Master DA Sheet
              </DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const desig = String(fd.get("designation"));
                const rule = fd.get("daRule") as DARuleType || determineDARule(desig);
                const rawDA = fd.get("fixedDailyDA");
                handleAddNewMasterRecord({
                  name: String(fd.get("name")),
                  department: String(fd.get("department")),
                  designation: desig,
                  location: String(fd.get("location")),
                  fixedDailyDA: rawDA === "" ? null : Number(rawDA),
                  daRule: rule,
                });
              }}
              className="space-y-4 py-3"
            >
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Employee Name</Label>
                <Input name="name" required placeholder="Full Name..." className="rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Designation</Label>
                  <Input name="designation" required placeholder="ASM, Phlebotomist..." className="rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Location</Label>
                  <Input name="location" required placeholder="MUMBAI, DELHI..." className="rounded-xl" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Department</Label>
                <Input name="department" defaultValue="Sales & Marketing" required className="rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Fixed Daily DA (₹)</Label>
                  <Input name="fixedDailyDA" type="number" placeholder="400" className="rounded-xl font-bold" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">DA Rule</Label>
                  <Select name="daRule" defaultValue="Doctor Visit">
                    <SelectTrigger className="rounded-xl text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Doctor Visit">Doctor Visit</SelectItem>
                      <SelectItem value="Check-In/Check-Out">Check-In/Check-Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => setIsAddMasterOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 text-white">
                  Add to Master
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* AD-HOC SINGLE CLAIM MODAL */}
      <Dialog open={openLegacyClaim} onOpenChange={(v) => {
        setOpenLegacyClaim(v);
        if (!v) setSingleClaimFileName("");
      }}>
        <DialogContent className="rounded-3xl p-6 border-2 border-primary/5 shadow-elegant max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">Submit Single Expense Claim</DialogTitle>
            <DialogDescription>Submit an ad-hoc expense receipt for approval.</DialogDescription>
          </DialogHeader>

          <form onSubmit={submitLegacyClaim} className="space-y-4 py-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Expense Title / Category
              </Label>
              <Select value={singleExpenseType} onValueChange={setSingleExpenseType}>
                <SelectTrigger className="h-12 rounded-xl text-xs font-bold border-2">
                  <SelectValue placeholder="Select Expense Type..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="AIR FARE (₹)" className="font-bold">
                    <div className="flex items-center gap-2">
                      <Plane className="size-4 text-blue-500" />
                      <span>AIR FARE (₹)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="RAIL FARE (₹)" className="font-bold">
                    <div className="flex items-center gap-2">
                      <Train className="size-4 text-emerald-500" />
                      <span>RAIL FARE (₹)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="PETROL (₹)" className="font-bold">
                    <div className="flex items-center gap-2">
                      <Fuel className="size-4 text-amber-500" />
                      <span>PETROL (₹)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="LOCAL (₹)" className="font-bold">
                    <div className="flex items-center gap-2">
                      <Car className="size-4 text-purple-500" />
                      <span>LOCAL (₹)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="FOOD (₹)" className="font-bold">
                    <div className="flex items-center gap-2">
                      <Utensils className="size-4 text-orange-500" />
                      <span>FOOD (₹)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="LODGING (₹)" className="font-bold">
                    <div className="flex items-center gap-2">
                      <Hotel className="size-4 text-indigo-500" />
                      <span>LODGING (₹)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="OTHER (₹)" className="font-bold">
                    <div className="flex items-center gap-2">
                      <Receipt className="size-4 text-slate-500" />
                      <span>OTHER (₹)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Amount (₹)
                </Label>
                <Input
                  name="amount"
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="0.00"
                  className="h-12 rounded-xl font-bold border-2"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Detail / Note (Optional)
                </Label>
                <Input
                  name="customDetail"
                  placeholder="e.g. Flight, Hotel info"
                  className="h-12 rounded-xl text-xs font-bold border-2"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Notes / Remarks
              </Label>
              <Textarea
                name="notes"
                placeholder="Describe the expense reason or justification..."
                className="rounded-xl border-2 min-h-[70px]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Receipt / Bill Copy
              </Label>
              <div
                className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileRef}
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSingleClaimFileName(f.name);
                  }}
                />
                <Upload className="size-6 text-muted-foreground mb-1" />
                <p className="text-xs font-bold text-foreground">
                  {singleClaimFileName ? singleClaimFileName : "Click to upload bill copy"}
                </p>
                <p className="text-[10px] text-muted-foreground">Supported: Image, PDF</p>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl font-bold"
                onClick={() => setOpenLegacyClaim(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={legacyBusy}
                className="rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {legacyBusy ? "Submitting..." : "Submit Claim"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
