import * as XLSX from "xlsx";

export type DARuleType = "Check-In/Check-Out" | "Doctor Visit";

export interface EmployeeMasterDARecord {
  srNo: number;
  name: string;
  department: string;
  designation: string;
  location: string;
  fixedDailyDA: number | null; // null represents missing DA rate
  daRule: DARuleType;
  employeeCode?: string;
  employeeId?: string;
}

export interface ExpenseAttachment {
  name: string;
  url: string;
  type: string;
  expenseType: string;
  uploadedAt: string;
}

export interface DailyExpenseClaimRow {
  date: string; // YYYY-MM-DD
  employeeName: string;
  designation: string;
  checkIn: string | null; // formatted time e.g. "09:30 AM" or ISO
  checkOut: string | null; // formatted time e.g. "06:30 PM" or ISO
  checkInValid: boolean;
  checkOutValid: boolean;
  doctorVisits: number; // Count of visits on this date
  fixedDA: number | null; // Fixed Daily DA from master
  daRule: DARuleType;
  daEligibility: "Eligible" | "Not Eligible";
  daPayable: number;
  // Outstation Expense Categories
  airFare: number;
  railFare: number;
  petrolRoad: number;
  localTravel: number;
  lunchDinner: number;
  lodging: number;
  otherExpenses: number;
  totalExpense: number;
  remarks: string;
  // Bill / Proof tracking
  attachments: ExpenseAttachment[];
  // Validation flags & exceptions
  exceptions: string[];
  billMissing: boolean;
  remarksRequired: boolean;
}

export interface BatchExpenseClaim {
  id: string;
  batchNumber: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  startDate: string;
  endDate: string;
  rows: DailyExpenseClaimRow[];
  totalEligibleDA: number;
  totalOtherExpenses: number;
  totalClaimAmount: number;
  missingBillsCount: number;
  exceptionsCount: number;
  status: "draft" | "pending_manager" | "manager_approved" | "approved" | "rejected";
  managerApproval?: {
    approvedBy: string;
    approvedAt: string;
    notes?: string;
  };
  hrApproval?: {
    approvedBy: string;
    approvedAt: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// 41 Employees exactly as defined in the Excel Master Sheet Image
export const DEFAULT_EMPLOYEE_MASTER_DA: EmployeeMasterDARecord[] = [
  { srNo: 1, name: "Avinash Anand", department: "Sales & Marketing", designation: "ASM", location: "BANGALORE", fixedDailyDA: 400, daRule: "Doctor Visit" },
  { srNo: 2, name: "Akshay Yadav", department: "Sales & Marketing", designation: "RBM", location: "MUMBAI", fixedDailyDA: 400, daRule: "Doctor Visit" },
  { srNo: 3, name: "Ankit Baronia", department: "Sales & Marketing", designation: "ASM", location: "INDORE", fixedDailyDA: 300, daRule: "Doctor Visit" },
  { srNo: 4, name: "Anup Dubey", department: "Sales & Marketing", designation: "Key Account Manager", location: "LUCKNOW", fixedDailyDA: 400, daRule: "Doctor Visit" },
  { srNo: 5, name: "Bhavesh D Bhandheri", department: "Sales & Marketing", designation: "ZSM", location: "SURAT", fixedDailyDA: 500, daRule: "Doctor Visit" },
  { srNo: 6, name: "Deepika Suri", department: "Sales & Marketing", designation: "ZSM", location: "DELHI", fixedDailyDA: 450, daRule: "Doctor Visit" },
  { srNo: 7, name: "Dilip M Keluskar", department: "Sales & Marketing", designation: "MARKETING HEAD", location: "MUMBAI", fixedDailyDA: 600, daRule: "Doctor Visit" },
  { srNo: 8, name: "Gautam Patel", department: "Sales & Marketing", designation: "DGM", location: "AHMEDABAD", fixedDailyDA: 500, daRule: "Doctor Visit" },
  { srNo: 9, name: "Mitesh R Bhatt", department: "Sales & Marketing", designation: "RBM", location: "AHMEDABAD", fixedDailyDA: 350, daRule: "Doctor Visit" },
  { srNo: 10, name: "Mohd Avez", department: "Sales & Marketing", designation: "BDM", location: "DELHI", fixedDailyDA: 350, daRule: "Doctor Visit" },
  { srNo: 11, name: "Naveen Kumar Shah", department: "Sales & Marketing", designation: "ASM", location: "MUMBAI", fixedDailyDA: 300, daRule: "Doctor Visit" },
  { srNo: 12, name: "Parth Bhatia", department: "Sales & Marketing", designation: "ASM", location: "SURAT", fixedDailyDA: 300, daRule: "Doctor Visit" },
  { srNo: 13, name: "Prafulla Kumar Gouda", department: "Sales & Marketing", designation: "General Manager", location: "HYDERBAD", fixedDailyDA: 600, daRule: "Doctor Visit" },
  { srNo: 14, name: "Pravinkumar Ray", department: "Sales & Marketing", designation: "BDM", location: "DELHI", fixedDailyDA: 275, daRule: "Doctor Visit" },
  { srNo: 15, name: "Pratik Dave", department: "Sales & Marketing", designation: "ASM", location: "AHMEDABAD", fixedDailyDA: 300, daRule: "Doctor Visit" },
  { srNo: 16, name: "Rahul Ranjan", department: "Sales & Marketing", designation: "ASM", location: "DELHI", fixedDailyDA: 350, daRule: "Doctor Visit" },
  { srNo: 17, name: "Rakesh Kumar", department: "Sales & Marketing", designation: "ASM", location: "VARANASI", fixedDailyDA: 300, daRule: "Doctor Visit" },
  { srNo: 18, name: "Sagar D Dudakiya", department: "Sales & Marketing", designation: "ASM", location: "RAJKOT", fixedDailyDA: 300, daRule: "Doctor Visit" },
  { srNo: 19, name: "Sandhya Singh", department: "Sales & Marketing", designation: "ASM", location: "MUMBAI", fixedDailyDA: 300, daRule: "Doctor Visit" },
  { srNo: 20, name: "Shrobhit Parmar", department: "Sales & Marketing", designation: "ASM", location: "VADODRA", fixedDailyDA: 300, daRule: "Doctor Visit" },
  { srNo: 21, name: "Saurav Pravin Aher", department: "Sales & Marketing", designation: "BDM", location: "NASHIK", fixedDailyDA: 250, daRule: "Doctor Visit" },
  { srNo: 22, name: "Yogesh Sharma", department: "Sales & Marketing", designation: "RBM", location: "JAIPUR", fixedDailyDA: 350, daRule: "Doctor Visit" },
  { srNo: 23, name: "Arravelli Nagesh", department: "Marketing", designation: "phlebotomist", location: "HYDERBAD", fixedDailyDA: 175, daRule: "Check-In/Check-Out" },
  { srNo: 24, name: "Calvin Joseph", department: "Marketing", designation: "phlebotomist", location: "CHENNAI", fixedDailyDA: 175, daRule: "Check-In/Check-Out" },
  { srNo: 25, name: "Krishna D Ghag", department: "Marketing", designation: "phlebotomist", location: "MUMBAI", fixedDailyDA: 250, daRule: "Check-In/Check-Out" },
  { srNo: 26, name: "Manjunath", department: "Marketing", designation: "phlebotomist", location: "BANGALORE", fixedDailyDA: 185, daRule: "Check-In/Check-Out" },
  { srNo: 27, name: "Rahul Kumar", department: "Marketing", designation: "phlebotomist", location: "DELHI", fixedDailyDA: 350, daRule: "Check-In/Check-Out" },
  { srNo: 28, name: "Rupali Vichare", department: "Marketing", designation: "phlebotomist", location: "MUMBAI", fixedDailyDA: 250, daRule: "Check-In/Check-Out" },
  { srNo: 29, name: "Sagar Vijender", department: "Marketing", designation: "phlebotomist", location: "DELHI", fixedDailyDA: 200, daRule: "Check-In/Check-Out" },
  { srNo: 30, name: "Santosh Kumar M C", department: "Marketing", designation: "phlebotomist", location: "DELHI", fixedDailyDA: 350, daRule: "Check-In/Check-Out" },
  { srNo: 31, name: "Saurabh Kumar Yadav", department: "Marketing", designation: "phlebotomist", location: "MUMBAI", fixedDailyDA: 250, daRule: "Check-In/Check-Out" },
  { srNo: 32, name: "Sumit Arkade", department: "Marketing", designation: "phlebotomist", location: "MUMBAI", fixedDailyDA: 250, daRule: "Check-In/Check-Out" },
  { srNo: 33, name: "Tushar Parmar", department: "Marketing", designation: "phlebotomist", location: "VADODRA", fixedDailyDA: 200, daRule: "Check-In/Check-Out" },
  { srNo: 34, name: "Vikas Kumar", department: "Marketing", designation: "phlebotomist", location: "DELHI", fixedDailyDA: 350, daRule: "Check-In/Check-Out" },
  { srNo: 35, name: "Yashvant Nagar", department: "Marketing", designation: "phlebotomist", location: "JAIPUR", fixedDailyDA: 50, daRule: "Check-In/Check-Out" },
  { srNo: 36, name: "Prashanth Kothoju", department: "Marketing", designation: "phlebotomist", location: "HYDERBAD", fixedDailyDA: null, daRule: "Check-In/Check-Out" },
  { srNo: 37, name: "Dharmendra Kumar Yadav", department: "Sales & Marketing", designation: "BDM", location: "LUCKNOW", fixedDailyDA: null, daRule: "Doctor Visit" },
  { srNo: 38, name: "Partha Mukherjee", department: "Sales & Marketing", designation: "RBM", location: "KOLKATA", fixedDailyDA: 0, daRule: "Doctor Visit" },
  { srNo: 39, name: "Raish Khan", department: "Sales & Marketing", designation: "BDM", location: "AURANGABAD", fixedDailyDA: 0, daRule: "Doctor Visit" },
  { srNo: 40, name: "Rishin Sura", department: "Sales & Marketing", designation: "Chief Operating Officer", location: "AHMEDABAD", fixedDailyDA: 0, daRule: "Doctor Visit" },
  { srNo: 41, name: "Roshan Nandekar", department: "Sales & Marketing", designation: "ASM", location: "NAGPUR", fixedDailyDA: 0, daRule: "Doctor Visit" },
];

export const OUTSTATION_DOCUMENT_REQUIREMENTS: Record<string, string> = {
  airFare: "Flight ticket and payment receipt",
  railFare: "Train ticket and payment proof",
  petrolRoad: "Petrol bill and trip details, where applicable",
  localTravel: "Rapido, Uber or other transport receipt",
  lunchDinner: "Restaurant bill",
  lodging: "Hotel invoice and payment receipt",
  otherExpenses: "Original bill, such as printing or stationery",
};

const MASTER_STORAGE_KEY = "hrms_employee_da_master_records_v1";
const BATCHES_STORAGE_KEY = "hrms_expense_batches_v1";

export function loadEmployeeMasterDA(): EmployeeMasterDARecord[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(MASTER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to load employee master DA from storage:", err);
  }
  return DEFAULT_EMPLOYEE_MASTER_DA;
}

export function saveEmployeeMasterDA(records: EmployeeMasterDARecord[]) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify(records));
    }
  } catch (err) {
    console.error("Failed to save employee master DA:", err);
  }
}

export function isPhlebotomist(designation?: string | null): boolean {
  if (!designation) return false;
  return designation.toLowerCase().includes("phlebotomist");
}

export function determineDARule(designation?: string | null, explicitRule?: DARuleType): DARuleType {
  if (explicitRule) return explicitRule;
  return isPhlebotomist(designation) ? "Check-In/Check-Out" : "Doctor Visit";
}

export function findEmployeeInMaster(
  employeeName: string,
  designation?: string,
  masterList: EmployeeMasterDARecord[] = loadEmployeeMasterDA()
): EmployeeMasterDARecord | null {
  const cleanName = employeeName.trim().toLowerCase();
  // 1. Exact or normalized full_name match
  let match = masterList.find((m) => m.name.trim().toLowerCase() === cleanName);
  if (match) return match;

  // 2. Contains match (handles slight prefixes/suffixes or middle names)
  match = masterList.find((m) => {
    const mClean = m.name.trim().toLowerCase();
    return cleanName.includes(mClean) || mClean.includes(cleanName);
  });
  if (match) return match;

  // 3. Fallback to name parts
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    match = masterList.find((m) => {
      const mClean = m.name.trim().toLowerCase();
      return mClean.includes(firstName) && mClean.includes(lastName);
    });
    if (match) return match;
  }

  return null;
}

/**
 * Section 8 & 16: Automatic DA Calculation Logic
 */
export function calculateDailyDA(params: {
  employeeName: string;
  designation?: string | null;
  fixedDailyDA?: number | null;
  daRule?: DARuleType;
  checkIn?: string | null;
  checkOut?: string | null;
  doctorVisitsCount?: number;
  date?: string;
  isEmployeeFoundInMaster?: boolean;
}): {
  daEligibility: "Eligible" | "Not Eligible";
  daPayable: number;
  exceptions: string[];
  fixedDAUsed: number | null;
  ruleUsed: DARuleType;
} {
  const exceptions: string[] = [];
  const designation = params.designation || "";
  const isFound = params.isEmployeeFoundInMaster !== false;

  // Master Level Validations
  if (!isFound) {
    exceptions.push("Employee Master Data Missing");
  }

  if (!designation.trim()) {
    exceptions.push("Designation Missing");
  }

  const fixedDA = params.fixedDailyDA;
  if (fixedDA === null || fixedDA === undefined || isNaN(Number(fixedDA))) {
    exceptions.push("DA Rate Missing");
  }

  const daRule = params.daRule || determineDARule(designation);

  const checkInPresent = !!params.checkIn && params.checkIn.trim() !== "" && params.checkIn !== "-";
  const checkOutPresent = !!params.checkOut && params.checkOut.trim() !== "" && params.checkOut !== "-";
  const doctorVisits = Number(params.doctorVisitsCount ?? 0);

  let daEligibility: "Eligible" | "Not Eligible" = "Not Eligible";
  let daPayable = 0;
  const applicableFixedDA = fixedDA !== null && fixedDA !== undefined ? Number(fixedDA) : 0;

  if (daRule === "Check-In/Check-Out") {
    // Rule A – Phlebotomist
    // Valid Check-In + Valid Check-Out = DA Payable
    if (checkInPresent && checkOutPresent) {
      daEligibility = "Eligible";
      daPayable = applicableFixedDA;
    } else {
      daEligibility = "Not Eligible";
      daPayable = 0;
      if (!checkInPresent && checkOutPresent) {
        exceptions.push("Check-In missing / Attendance Exception");
      } else if (checkInPresent && !checkOutPresent) {
        exceptions.push("Check-Out missing / Attendance Exception");
      } else {
        exceptions.push("DA ₹0 / Approval Required (Attendance Missing)");
      }
    }
  } else {
    // Rule B – Other Designations (Doctor Visit Rule)
    // Doctor Visits >= 1 → DA Payable = Applicable Fixed Daily DA
    // Doctor Visits = 0 → DA Payable = ₹0
    if (params.doctorVisitsCount === undefined || params.doctorVisitsCount === null) {
      exceptions.push("Doctor Visit Data Required");
      daEligibility = "Not Eligible";
      daPayable = 0;
    } else if (doctorVisits >= 1) {
      daEligibility = "Eligible";
      daPayable = applicableFixedDA;
    } else {
      daEligibility = "Not Eligible";
      daPayable = 0;
    }
  }

  return {
    daEligibility,
    daPayable,
    exceptions,
    fixedDAUsed: fixedDA !== undefined ? fixedDA : null,
    ruleUsed: daRule,
  };
}

/**
 * Calculates row total and checks missing bills / remarks requirements
 */
export function evaluateRowExpenses(row: Partial<DailyExpenseClaimRow>): {
  totalExpense: number;
  otherExpensesTotal: number;
  billMissing: boolean;
  remarksRequired: boolean;
  rowExceptions: string[];
} {
  const air = Number(row.airFare || 0);
  const rail = Number(row.railFare || 0);
  const petrol = Number(row.petrolRoad || 0);
  const local = Number(row.localTravel || 0);
  const lunch = Number(row.lunchDinner || 0);
  const lodging = Number(row.lodging || 0);
  const other = Number(row.otherExpenses || 0);
  const da = Number(row.daPayable || 0);

  const otherExpensesTotal = air + rail + petrol + local + lunch + lodging + other;
  const totalExpense = da + otherExpensesTotal;

  const attachments = row.attachments || [];
  const attachedExpenseTypes = new Set(attachments.map((a) => a.expenseType.toLowerCase()));

  const missingTypes: string[] = [];

  if (air > 0 && !attachedExpenseTypes.has("airfare") && !attachedExpenseTypes.has("air fare") && attachments.length === 0) {
    missingTypes.push("Air Fare");
  }
  if (rail > 0 && !attachedExpenseTypes.has("railfare") && !attachedExpenseTypes.has("rail fare") && attachments.length === 0) {
    missingTypes.push("Rail Fare");
  }
  if (petrol > 0 && !attachedExpenseTypes.has("petrol") && !attachedExpenseTypes.has("road") && attachments.length === 0) {
    missingTypes.push("Petrol/Road");
  }
  if (local > 0 && !attachedExpenseTypes.has("localtravel") && !attachedExpenseTypes.has("local travel") && attachments.length === 0) {
    missingTypes.push("Local Travel");
  }
  if (lunch > 0 && !attachedExpenseTypes.has("lunchdinner") && !attachedExpenseTypes.has("lunch") && attachments.length === 0) {
    missingTypes.push("Lunch/Dinner");
  }
  if (lodging > 0 && !attachedExpenseTypes.has("lodging") && !attachedExpenseTypes.has("hotel") && attachments.length === 0) {
    missingTypes.push("Lodging");
  }
  if (other > 0 && !attachedExpenseTypes.has("otherexpenses") && !attachedExpenseTypes.has("other") && attachments.length === 0) {
    missingTypes.push("Other Expenses");
  }

  // Any expense claimed with no attachment at all triggers missing bill rule
  const billMissing = otherExpensesTotal > 0 && attachments.length === 0;
  const hasRemarks = !!(row.remarks && row.remarks.trim().length > 0);
  const remarksRequired = billMissing && !hasRemarks;

  const rowExceptions: string[] = [];
  if (billMissing) {
    rowExceptions.push("Bill Missing – Approval Required");
  }
  if (remarksRequired) {
    rowExceptions.push("Remarks Required for Missing Bill");
  }

  return {
    totalExpense,
    otherExpensesTotal,
    billMissing,
    remarksRequired,
    rowExceptions,
  };
}

/**
 * Generate 20-Day Batch
 */
export function generate20DayBatch(params: {
  employee: {
    id: string;
    full_name: string;
    designation?: string;
    department?: string;
  };
  startDate: string; // YYYY-MM-DD
  masterList?: EmployeeMasterDARecord[];
  attendanceMap?: Record<string, { check_in?: string | null; check_out?: string | null; status?: string }>;
  doctorVisitsMap?: Record<string, number>;
}): BatchExpenseClaim {
  const masterList = params.masterList || loadEmployeeMasterDA();
  const masterRecord = findEmployeeInMaster(params.employee.full_name, params.employee.designation, masterList);

  const designation = masterRecord?.designation || params.employee.designation || "";
  const fixedDA = masterRecord ? masterRecord.fixedDailyDA : null;
  const daRule = masterRecord?.daRule || determineDARule(designation);

  const start = new Date(params.startDate);
  const rows: DailyExpenseClaimRow[] = [];

  for (let i = 0; i < 20; i++) {
    const curDate = new Date(start);
    curDate.setDate(start.getDate() + i);
    const dateStr = curDate.toISOString().split("T")[0];

    const att = params.attendanceMap?.[dateStr];
    const visits = params.doctorVisitsMap?.[dateStr] ?? 0;

    let checkInStr: string | null = null;
    let checkOutStr: string | null = null;

    if (att?.check_in) {
      try {
        const d = new Date(att.check_in);
        checkInStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        checkInStr = String(att.check_in);
      }
    }
    if (att?.check_out) {
      try {
        const d = new Date(att.check_out);
        checkOutStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        checkOutStr = String(att.check_out);
      }
    }

    const daResult = calculateDailyDA({
      employeeName: params.employee.full_name,
      designation,
      fixedDailyDA: fixedDA,
      daRule,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      doctorVisitsCount: visits,
      date: dateStr,
      isEmployeeFoundInMaster: !!masterRecord,
    });

    const initialRow: DailyExpenseClaimRow = {
      date: dateStr,
      employeeName: params.employee.full_name,
      designation,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      checkInValid: !!checkInStr,
      checkOutValid: !!checkOutStr,
      doctorVisits: visits,
      fixedDA: daResult.fixedDAUsed,
      daRule: daResult.ruleUsed,
      daEligibility: daResult.daEligibility,
      daPayable: daResult.daPayable,
      airFare: 0,
      railFare: 0,
      petrolRoad: 0,
      localTravel: 0,
      lunchDinner: 0,
      lodging: 0,
      otherExpenses: 0,
      totalExpense: daResult.daPayable,
      remarks: "",
      attachments: [],
      exceptions: daResult.exceptions,
      billMissing: false,
      remarksRequired: false,
    };

    rows.push(initialRow);
  }

  const endDate = rows[rows.length - 1].date;
  const batchId = `BATCH-${params.employee.id.slice(0, 8)}-${params.startDate.replace(/-/g, "")}`;

  let totalDA = 0;
  let totalOther = 0;
  let totalClaim = 0;
  let missingBills = 0;
  let exceptionsCount = 0;

  rows.forEach((r) => {
    totalDA += r.daPayable;
    totalClaim += r.totalExpense;
    if (r.exceptions.length > 0) exceptionsCount += r.exceptions.length;
    if (r.billMissing) missingBills += 1;
  });

  return {
    id: batchId,
    batchNumber: `EXP-${params.startDate.replace(/-/g, "").slice(2)}-${params.employee.full_name.slice(0, 3).toUpperCase()}`,
    employeeId: params.employee.id,
    employeeName: params.employee.full_name,
    designation,
    department: masterRecord?.department || params.employee.department || "Sales & Marketing",
    startDate: params.startDate,
    endDate,
    rows,
    totalEligibleDA: totalDA,
    totalOtherExpenses: totalOther,
    totalClaimAmount: totalClaim,
    missingBillsCount: missingBills,
    exceptionsCount,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Recalculate whole batch totals & row evaluations
 */
export function recalculateBatch(batch: BatchExpenseClaim): BatchExpenseClaim {
  let totalDA = 0;
  let totalOther = 0;
  let totalClaim = 0;
  let missingBills = 0;
  let totalExceptions = 0;

  const updatedRows = batch.rows.map((r) => {
    // Evaluate DA
    const daRes = calculateDailyDA({
      employeeName: r.employeeName,
      designation: r.designation,
      fixedDailyDA: r.fixedDA,
      daRule: r.daRule,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      doctorVisitsCount: r.doctorVisits,
      date: r.date,
      isEmployeeFoundInMaster: true,
    });

    const evaluated = evaluateRowExpenses({
      ...r,
      daPayable: daRes.daPayable,
    });

    const allExceptions = Array.from(new Set([...daRes.exceptions, ...evaluated.rowExceptions]));

    totalDA += daRes.daPayable;
    totalOther += evaluated.otherExpensesTotal;
    totalClaim += evaluated.totalExpense;
    if (evaluated.billMissing) missingBills += 1;
    totalExceptions += allExceptions.length;

    return {
      ...r,
      daEligibility: daRes.daEligibility,
      daPayable: daRes.daPayable,
      totalExpense: evaluated.totalExpense,
      billMissing: evaluated.billMissing,
      remarksRequired: evaluated.remarksRequired,
      exceptions: allExceptions,
    };
  });

  return {
    ...batch,
    rows: updatedRows,
    totalEligibleDA: totalDA,
    totalOtherExpenses: totalOther,
    totalClaimAmount: totalClaim,
    missingBillsCount: missingBills,
    exceptionsCount: totalExceptions,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Batch Storage Helpers
 */
export function loadAllBatches(): BatchExpenseClaim[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(BATCHES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to load batches from storage:", err);
  }
  return [];
}

export function saveBatch(batch: BatchExpenseClaim): BatchExpenseClaim[] {
  const all = loadAllBatches();
  const idx = all.findIndex((b) => b.id === batch.id);
  let updated: BatchExpenseClaim[];
  if (idx >= 0) {
    updated = [...all];
    updated[idx] = batch;
  } else {
    updated = [batch, ...all];
  }
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(BATCHES_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.error("Failed to save batch:", err);
  }
  return updated;
}

export function deleteBatch(batchId: string): BatchExpenseClaim[] {
  const all = loadAllBatches();
  const filtered = all.filter((b) => b.id !== batchId);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(BATCHES_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.error("Failed to delete batch:", err);
  }
  return filtered;
}

/**
 * Excel Export & Import
 */
export function exportBatchToExcel(batch: BatchExpenseClaim) {
<<<<<<< Updated upstream
  // Format matching Section 7 of Master Prompt:
  // Date | Employee Name | Designation | Check-In | Check-Out | Doctor Visits | Fixed DA | DA Rule | DA Eligibility | DA Payable | Air Fare | Rail Fare | Petrol/Road | Local Travel | Lunch/Dinner | Lodging | Other Expenses | Total Expense | Remarks
=======
>>>>>>> Stashed changes
  const claimData = batch.rows.map((r) => ({
    "Date": r.date,
    "Employee Name": r.employeeName,
    "Designation": r.designation,
    "Check-In": r.checkIn || (r.checkInValid ? "✓" : "✗"),
    "Check-Out": r.checkOut || (r.checkOutValid ? "✓" : "✗"),
    "Doctor Visits": r.doctorVisits,
    "Fixed DA": r.fixedDA !== null ? `₹${r.fixedDA}` : "Missing",
    "DA Rule": r.daRule,
    "DA Eligibility": r.daEligibility,
    "DA Payable": r.daPayable,
    "Air Fare": r.airFare || 0,
    "Rail Fare": r.railFare || 0,
    "Petrol/Road": r.petrolRoad || 0,
    "Local Travel": r.localTravel || 0,
    "Lunch/Dinner": r.lunchDinner || 0,
    "Lodging": r.lodging || 0,
    "Other Expenses": r.otherExpenses || 0,
    "Total Expense": r.totalExpense,
    "Remarks": r.remarks || (r.billMissing ? "Bill Missing – Approval Required" : ""),
    "Exceptions / Flags": r.exceptions.join("; "),
  }));

  const summaryData = [
    { "Metric": "Batch Number", "Value": batch.batchNumber },
    { "Metric": "Employee Name", "Value": batch.employeeName },
    { "Metric": "Designation", "Value": batch.designation },
    { "Metric": "Department", "Value": batch.department },
    { "Metric": "Period Start Date", "Value": batch.startDate },
    { "Metric": "Period End Date", "Value": batch.endDate },
    { "Metric": "Total Eligible DA (₹)", "Value": batch.totalEligibleDA },
    { "Metric": "Total Other Outstation Expenses (₹)", "Value": batch.totalOtherExpenses },
    { "Metric": "Total Claim Amount (₹)", "Value": batch.totalClaimAmount },
    { "Metric": "Missing Bills Flagged", "Value": batch.missingBillsCount },
    { "Metric": "Total Exceptions", "Value": batch.exceptionsCount },
    { "Metric": "Approval Status", "Value": batch.status.toUpperCase() },
    { "Metric": "Reporting Manager Approval", "Value": batch.managerApproval ? `${batch.managerApproval.approvedBy} on ${new Date(batch.managerApproval.approvedAt).toLocaleDateString()}` : "Pending" },
    { "Metric": "HR Reimbursement Approval", "Value": batch.hrApproval ? `${batch.hrApproval.approvedBy} on ${new Date(batch.hrApproval.approvedAt).toLocaleDateString()}` : "Pending" },
  ];

  const wb = XLSX.utils.book_new();
  const wsClaims = XLSX.utils.json_to_sheet(claimData);
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);

<<<<<<< Updated upstream
  // Column width formatting
=======
>>>>>>> Stashed changes
  wsClaims["!cols"] = [
    { wch: 12 }, // Date
    { wch: 22 }, // Employee Name
    { wch: 18 }, // Designation
    { wch: 12 }, // Check-In
    { wch: 12 }, // Check-Out
    { wch: 14 }, // Doctor Visits
    { wch: 12 }, // Fixed DA
    { wch: 20 }, // DA Rule
    { wch: 14 }, // DA Eligibility
    { wch: 12 }, // DA Payable
    { wch: 10 }, // Air Fare
    { wch: 10 }, // Rail Fare
    { wch: 12 }, // Petrol/Road
    { wch: 12 }, // Local Travel
    { wch: 14 }, // Lunch/Dinner
    { wch: 10 }, // Lodging
    { wch: 14 }, // Other Expenses
    { wch: 14 }, // Total Expense
    { wch: 30 }, // Remarks
    { wch: 35 }, // Exceptions
  ];

  wsSummary["!cols"] = [{ wch: 30 }, { wch: 35 }];

  XLSX.utils.book_append_sheet(wb, wsClaims, "Daily Expense Claims");
  XLSX.utils.book_append_sheet(wb, wsSummary, "Batch Summary");

  XLSX.writeFile(wb, `${batch.batchNumber}_${batch.employeeName.replace(/\s+/g, "_")}_Expense_Claim.xlsx`);
}

export function exportMasterToExcel(masterList: EmployeeMasterDARecord[] = loadEmployeeMasterDA()) {
  const data = masterList.map((m) => ({
    "SR NO": m.srNo,
    "NAME": m.name,
    "DEPARTMNET": m.department,
    "DESIGNATION": m.designation,
    "LOCATION": m.location,
    "FIXED DAILY DA": m.fixedDailyDA !== null ? m.fixedDailyDA : "",
    "DA RULE": m.daRule,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 26 },
    { wch: 22 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Employee Master DA");
  XLSX.writeFile(wb, "Employee_Master_DA_Rules.xlsx");
}

export async function parseMasterFromExcel(file: File): Promise<EmployeeMasterDARecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: "binary" });
        const firstSheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[firstSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!rows || rows.length < 2) {
          throw new Error("Excel sheet does not contain enough data rows.");
        }

<<<<<<< Updated upstream
        // Header detection
=======
>>>>>>> Stashed changes
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const rowStr = (rows[i] || []).join(" ").toLowerCase();
          if (rowStr.includes("name") || rowStr.includes("designation")) {
            headerRowIndex = i;
            break;
          }
        }

        const headers: string[] = (rows[headerRowIndex] || []).map((h: any) => String(h || "").trim().toUpperCase());
        const nameIdx = headers.findIndex((h) => h.includes("NAME"));
        const deptIdx = headers.findIndex((h) => h.includes("DEPART") || h.includes("DEPT"));
        const desigIdx = headers.findIndex((h) => h.includes("DESIG"));
        const locIdx = headers.findIndex((h) => h.includes("LOC") || h.includes("CITY"));
<<<<<<< Updated upstream
        // 6th column or column containing DA/AMOUNT/RATE
        let daIdx = headers.findIndex((h) => h.includes("DA") || h.includes("RATE") || h.includes("FIXED") || h.includes("DAILY"));
        if (daIdx === -1 && headers.length >= 6) {
          daIdx = 5; // 6th column
=======
        let daIdx = headers.findIndex((h) => h.includes("DA") || h.includes("RATE") || h.includes("FIXED") || h.includes("DAILY"));
        if (daIdx === -1 && headers.length >= 6) {
          daIdx = 5;
>>>>>>> Stashed changes
        }
        const ruleIdx = headers.findIndex((h) => h.includes("RULE"));

        const parsedRecords: EmployeeMasterDARecord[] = [];

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r.length === 0) continue;

          const nameVal = nameIdx >= 0 ? r[nameIdx] : r[1];
          if (!nameVal || String(nameVal).trim() === "") continue;

          const srNoVal = Number(r[0]) || parsedRecords.length + 1;
          const deptVal = deptIdx >= 0 && r[deptIdx] ? String(r[deptIdx]).trim() : "Sales & Marketing";
          const desigVal = desigIdx >= 0 && r[desigIdx] ? String(r[desigIdx]).trim() : "Executive";
          const locVal = locIdx >= 0 && r[locIdx] ? String(r[locIdx]).trim() : "-";

          let fixedDAVal: number | null = null;
          const rawDA = daIdx >= 0 ? r[daIdx] : null;
          if (rawDA !== null && rawDA !== undefined && String(rawDA).trim() !== "") {
            const num = Number(String(rawDA).replace(/[^0-9.]/g, ""));
            if (!isNaN(num)) fixedDAVal = num;
          }

          let ruleVal: DARuleType;
          if (ruleIdx >= 0 && r[ruleIdx]) {
            const rStr = String(r[ruleIdx]).toLowerCase();
            ruleVal = rStr.includes("check") ? "Check-In/Check-Out" : "Doctor Visit";
          } else {
            ruleVal = determineDARule(desigVal);
          }

          parsedRecords.push({
            srNo: srNoVal,
            name: String(nameVal).trim(),
            department: deptVal,
            designation: desigVal,
            location: locVal,
            fixedDailyDA: fixedDAVal,
            daRule: ruleVal,
          });
        }

        resolve(parsedRecords);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}
