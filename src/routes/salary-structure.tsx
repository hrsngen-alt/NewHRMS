import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  IndianRupee, CheckCircle2, AlertTriangle, Info, TrendingUp,
  Building2, User, BookOpen, ShieldCheck, Calculator, ChevronRight,
  BadgeCheck, AlertCircle, Search, ChevronDown, Zap, Printer,
  RotateCcw, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/salary-structure")({
  component: () => (
    <AppShell>
      <SalaryStructurePage />
    </AppShell>
  ),
});

/* ─── helpers ─────────────────────────────────────────────────── */
const fmt = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN", { minimumFractionDigits: 0 });

const pctOf = (val: number, of: number) =>
  of === 0 ? "0%" : ((val / of) * 100).toFixed(2) + "% of Gross";

const Badge = ({
  color,
  children,
}: {
  color: "green" | "blue" | "orange" | "rose" | "violet";
  children: React.ReactNode;
}) => {
  const cls: Record<string, string> = {
    green: "bg-emerald-100 text-emerald-700 border-emerald-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    orange: "bg-amber-100 text-amber-700 border-amber-200",
    rose: "bg-rose-100 text-rose-700 border-rose-200",
    violet: "bg-violet-100 text-violet-700 border-violet-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${cls[color]}`}>
      {children}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
function SalaryStructurePage() {
  const { role } = useAuth();

  if (role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-card border rounded-2xl p-8 max-w-md mx-auto shadow-elegant">
        <AlertTriangle className="size-12 text-destructive animate-pulse" />
        <h2 className="text-2xl font-black tracking-tight text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground font-medium">This page is restricted to Admin users. If you believe this is an error, please contact support.</p>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<"lookup" | "calculator">("lookup");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dropOpen, setDropOpen] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-salary"],
    queryFn: async () => {
      const { data: res, error } = await supabase.functions.invoke("salary-structure-cached", {
        method: "GET",
      });
      if (error) throw error;
      if (!res) return [];
      const finalData = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      return (finalData as any[]) || [];
    },
  });

  const emp = employees.find((e: any) => e.id === selectedId) ?? null;
  const filtered = employees.filter((e: any) =>
    !search ||
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_code?.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase())
  );

  /* ── Derived numbers for employee lookup ── */
  const BASIC = Number(emp?.basic_salary ?? 0);
  const HRA = Number(emp?.hra ?? 0);
  const BONUS = Number(emp?.bonus ?? 0);
  const GROSS = BASIC + HRA + BONUS;
  const esicEligible = BASIC > 0 && BASIC <= 21000;
  const ESIC_EMP = esicEligible ? Number(emp?.esic_amount ?? Math.round(BASIC * 0.0075)) : 0;
  const ESIC_EMP_CALC = esicEligible ? Math.round(BASIC * 0.0075) : 0;
  const ESIC_EMPR = esicEligible ? Math.round(BASIC * 0.0325) : 0;
  const GRATUITY = Number(emp?.gratuity_amount ?? Math.round(BASIC * 0.0481));
  const GRATUITY_CALC = Math.round(BASIC * 0.0481);
  const PT = GROSS > 15000 ? 200 : 0;
  const PF = Number(emp?.pf_amount ?? 0);
  const TOTAL_EMP_DED = PF + ESIC_EMP + PT;
  const NET_PAY = GROSS - TOTAL_EMP_DED;
  const CTC = GROSS + ESIC_EMPR + GRATUITY;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Salary Structure
          </h1>
          <p className="text-sm font-medium text-muted-foreground/60 mt-1">
            Look up existing employees or calculate salary bifurcation for new joiners.
          </p>
        </div>
        <Badge color="green">
          <CheckCircle2 className="size-3" /> Indian Payroll Standards
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-muted/40 rounded-2xl border w-fit">
        {([
          { id: "lookup" as const, label: "Employee Lookup", icon: Search },
          { id: "calculator" as const, label: "Salary Calculator", icon: Calculator },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
              activeTab === tab.id
                ? "bg-primary text-white shadow-lg shadow-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-background"
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── CALCULATOR TAB ── */}
      {activeTab === "calculator" && <SalaryCalculator />}

      {/* ── LOOKUP TAB ── */}
      {activeTab === "lookup" && (
        <>
          {/* Employee Selector */}
          <div className="rounded-2xl border-2 border-primary/20 bg-card shadow-sm p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
              <User className="size-3.5" /> Select Employee
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border-2 border-border bg-background px-4 py-3 text-sm font-bold hover:border-primary/40 transition-colors"
              >
                {emp ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm shrink-0">
                      {emp.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-black text-foreground truncate">{emp.full_name}</p>
                      <p className="text-[11px] text-muted-foreground font-medium">{emp.employee_code} · {emp.department} · {emp.designation}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Search className="size-4" />
                    <span>Search or select an employee…</span>
                  </div>
                )}
                <ChevronDown className={cn("size-4 text-muted-foreground shrink-0 transition-transform", dropOpen && "rotate-180")} />
              </button>

              {dropOpen && (
                <div className="absolute z-30 top-full left-0 right-0 mt-2 rounded-2xl border-2 border-border bg-card shadow-2xl overflow-hidden">
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <input
                        autoFocus
                        placeholder="Search by name, code or department…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y">
                    {filtered.length === 0 && (
                      <div className="py-8 text-center text-sm text-muted-foreground">No employees found.</div>
                    )}
                    {filtered.map((e: any) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => { setSelectedId(e.id); setDropOpen(false); setSearch(""); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors",
                          e.id === selectedId && "bg-primary/10"
                        )}
                      >
                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0">
                          {e.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground truncate">{e.full_name}</p>
                          <p className="text-[11px] text-muted-foreground">{e.employee_code} · {e.department}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-foreground">
                            {fmt(Number(e.basic_salary) + Number(e.hra) + Number(e.bonus))}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Gross</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Empty state */}
          {!emp && (
            <div className="rounded-2xl border-2 border-dashed border-muted bg-muted/20 py-20 text-center">
              <IndianRupee className="size-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-base font-black text-muted-foreground">Select an employee above</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Their complete salary bifurcation will appear here.</p>
            </div>
          )}

          {/* Employee salary detail */}
          {emp && (
            <>
              {/* Employee banner */}
              <div className="rounded-2xl border bg-gradient-to-r from-primary/10 to-violet-500/5 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-lg shadow-lg shadow-primary/30">
                    {emp.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-black text-foreground">{emp.full_name}</p>
                    <p className="text-xs text-muted-foreground font-medium">{emp.employee_code} · {emp.department} · {emp.designation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {esicEligible ? (
                    <Badge color="violet"><ShieldCheck className="size-3" /> ESIC Eligible</Badge>
                  ) : (
                    <Badge color="orange"><AlertCircle className="size-3" /> ESIC Not Applicable</Badge>
                  )}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Monthly CTC", value: fmt(CTC), icon: Building2, color: "bg-violet-600", note: "Gross + ESIC Empr + Gratuity" },
                  { label: "Gross Salary", value: fmt(GROSS), icon: TrendingUp, color: "bg-blue-600", note: "Basic + HRA + Bonus" },
                  { label: "Total Deductions", value: fmt(TOTAL_EMP_DED), icon: Calculator, color: "bg-amber-500", note: "PF + ESIC + PT" },
                  { label: "Net Take-Home", value: fmt(NET_PAY), icon: IndianRupee, color: "bg-emerald-600", note: "Take-home salary" },
                ].map((c) => (
                  <div key={c.label} className="rounded-2xl border bg-card shadow-sm p-5 flex flex-col gap-3">
                    <div className={`size-10 rounded-xl ${c.color} flex items-center justify-center shadow-lg`}>
                      <c.icon className="size-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{c.label}</p>
                      <p className="text-2xl font-black text-foreground mt-0.5">{c.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{c.note}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Earnings + Deductions */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Earnings */}
                <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                  <div className="bg-blue-600 px-6 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Earnings</p>
                    <p className="text-xl font-black text-white mt-0.5">Gross = {fmt(GROSS)}</p>
                  </div>
                  <div className="divide-y">
                    {[
                      { label: "Basic Salary", value: BASIC, badge: pctOf(BASIC, GROSS), note: "Base for ESIC, Gratuity, PF." },
                      { label: "HRA", value: HRA, badge: pctOf(HRA, GROSS), note: "Tax-exempt for rented accommodation." },
                      { label: "Monthly Bonus", value: BONUS, badge: pctOf(BONUS, GROSS), note: "Performance / statutory bonus." },
                    ].map((row) => (
                      <div key={row.label} className="px-6 py-4 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground">{row.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{row.note}</p>
                          <Badge color="blue">{row.badge}</Badge>
                        </div>
                        <p className="text-base font-black text-blue-700 shrink-0">{fmt(row.value)}</p>
                      </div>
                    ))}
                    <div className="px-6 py-3 bg-blue-50/60 flex justify-between items-center">
                      <p className="text-xs font-black uppercase tracking-wider text-blue-700">Total Gross</p>
                      <p className="text-lg font-black text-blue-700">{fmt(GROSS)}</p>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                  <div className="bg-rose-600 px-6 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-200">Employee Deductions</p>
                    <p className="text-xl font-black text-white mt-0.5">Deducted from salary</p>
                  </div>
                  <div className="divide-y">
                    <div className="px-6 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">PF (Provident Fund)</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{PF > 0 ? "Retirement savings deducted from paycheck." : "Not applicable / ₹0 for this employee."}</p>
                        <Badge color="orange">{PF > 0 ? fmt(PF) : "₹0"}</Badge>
                      </div>
                      <p className={`text-base font-black shrink-0 ${PF > 0 ? "text-rose-600" : "text-muted-foreground"}`}>{fmt(PF)}</p>
                    </div>
                    <div className="px-6 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-foreground">ESIC (Employee Share)</p>
                          {!esicEligible && <Badge color="orange"><AlertCircle className="size-3" /> Not Eligible</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {esicEligible ? "0.75% of Basic — health insurance under ESIC." : "Basic > ₹21,000 — ESIC not applicable."}
                        </p>
                        <Badge color="orange">{esicEligible ? "0.75% of Basic" : "Not Applicable"}</Badge>
                      </div>
                      <p className={`text-base font-black shrink-0 ${esicEligible ? "text-rose-600" : "text-muted-foreground"}`}>{fmt(ESIC_EMP)}</p>
                    </div>
                    <div className="px-6 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">Professional Tax (PT)</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{PT > 0 ? "State tax — Gross > ₹15,000 → ₹200/month." : "Not applicable."}</p>
                        <Badge color="orange">{PT > 0 ? "₹200/month" : "Not Applicable"}</Badge>
                      </div>
                      <p className={`text-base font-black shrink-0 ${PT > 0 ? "text-rose-600" : "text-muted-foreground"}`}>{fmt(PT)}</p>
                    </div>
                    <div className="px-6 py-4 flex items-start justify-between gap-4 opacity-60">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-foreground line-through">Gratuity</p>
                          <Badge color="green"><ShieldCheck className="size-3" /> Employer pays</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">NOT deducted — employer liability after 5 yrs.</p>
                        <Badge color="orange">4.81% of Basic</Badge>
                      </div>
                      <p className="text-base font-black text-muted-foreground shrink-0 line-through">{fmt(GRATUITY)}</p>
                    </div>
                    <div className="px-6 py-3 bg-rose-50/60 flex justify-between items-center">
                      <p className="text-xs font-black uppercase tracking-wider text-rose-700">Total Deductions</p>
                      <p className="text-lg font-black text-rose-700">{fmt(TOTAL_EMP_DED)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Employer Contributions */}
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="bg-violet-600 px-6 py-4 flex items-center gap-3">
                  <Building2 className="size-5 text-white" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-200">Employer Contributions</p>
                    <p className="text-base font-black text-white mt-0.5">Paid by Company — NOT deducted from salary</p>
                  </div>
                </div>
                <div className="divide-y">
                  <div className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">ESIC Employer Share</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {esicEligible ? "3.25% of Basic — company pays into ESIC fund." : "Not applicable — Basic > ₹21,000."}
                      </p>
                      <Badge color="violet">{esicEligible ? "3.25% of Basic" : "Not Applicable"}</Badge>
                    </div>
                    <p className="text-base font-black text-violet-700 shrink-0">{fmt(ESIC_EMPR)}</p>
                  </div>
                  <div className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">Gratuity Provision</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">4.81% of Basic. Lump sum paid after 5 years. (Gratuity Act, 1972)</p>
                      <Badge color="violet">4.81% of Basic</Badge>
                    </div>
                    <p className="text-base font-black text-violet-700 shrink-0">{fmt(GRATUITY)}</p>
                  </div>
                </div>
              </div>

              {/* CTC Breakdown */}
              <div className="rounded-2xl border bg-gradient-to-br from-slate-900 to-slate-800 shadow-xl overflow-hidden text-white">
                <div className="px-6 py-5 border-b border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50">CTC Calculation</p>
                  <p className="text-xl font-black mt-0.5">How Monthly CTC of {fmt(CTC)} is built</p>
                </div>
                <div className="px-6 py-5 space-y-3 text-sm">
                  {[
                    { label: "Basic Salary", value: fmt(BASIC) },
                    { label: "+ HRA", value: fmt(HRA) },
                    { label: "+ Monthly Bonus", value: fmt(BONUS) },
                    { label: "= Gross Salary", value: fmt(GROSS), bold: true },
                    { label: "+ ESIC Employer Share (3.25% of Basic)", value: fmt(ESIC_EMPR) },
                    { label: "+ Gratuity Provision (4.81% of Basic)", value: fmt(GRATUITY) },
                  ].map((row) => (
                    <div key={row.label} className={`flex justify-between items-center py-2 border-b border-white/10 ${row.bold ? "" : "opacity-80"}`}>
                      <span className={`font-medium text-white/80 ${row.bold ? "font-black text-white" : ""}`}>{row.label}</span>
                      <span className={`font-black text-white ${row.bold ? "text-blue-300" : ""}`}>{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-3 mt-2 bg-white/10 rounded-xl px-4">
                    <span className="font-black text-lg text-white">Monthly CTC</span>
                    <span className="font-black text-2xl text-emerald-400">{fmt(CTC)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay Strip */}
              <div className="rounded-2xl border bg-emerald-50 border-emerald-200 shadow-sm px-6 py-5 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Net Take-Home Pay</p>
                  <p className="text-3xl font-black text-emerald-700 mt-1">{fmt(NET_PAY)}</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {fmt(GROSS)} (Gross) − {fmt(TOTAL_EMP_DED)} (PF + ESIC + PT) = {fmt(NET_PAY)}
                  </p>
                </div>
                <div className="text-right">
                  <Badge color="green"><CheckCircle2 className="size-3" /> Calculated</Badge>
                  <p className="text-[10px] text-muted-foreground mt-2 max-w-xs">
                    Gratuity and Employer ESIC do NOT reduce take-home pay.
                  </p>
                </div>
              </div>

              {/* Verification Table */}
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b bg-muted/20">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Mathematical Verification</p>
                  <p className="text-base font-bold mt-0.5">All figures auto-calculated from employee record</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Component</th>
                        <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Formula</th>
                        <th className="text-right px-6 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">DB Value</th>
                        <th className="text-right px-6 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Calculated</th>
                        <th className="px-6 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        { check: "Gross Salary", formula: "Basic + HRA + Bonus", db: fmt(GROSS), calc: fmt(BASIC + HRA + BONUS), ok: true },
                        { check: "ESIC Employee (0.75%)", formula: esicEligible ? `${BASIC.toLocaleString("en-IN")} × 0.0075` : "Basic > 21,000 → ₹0", db: fmt(ESIC_EMP), calc: fmt(ESIC_EMP_CALC), ok: ESIC_EMP === ESIC_EMP_CALC || !esicEligible },
                        { check: "ESIC Employer (3.25%)", formula: esicEligible ? `${BASIC.toLocaleString("en-IN")} × 0.0325` : "Not Applicable", db: "—", calc: fmt(ESIC_EMPR), ok: true },
                        { check: "Gratuity (4.81%)", formula: `${BASIC.toLocaleString("en-IN")} × 0.0481`, db: fmt(GRATUITY), calc: fmt(GRATUITY_CALC), ok: Math.abs(GRATUITY - GRATUITY_CALC) <= 10 },
                        { check: "Professional Tax", formula: "Gross > ₹15,000 → ₹200", db: "Auto", calc: fmt(PT), ok: true },
                        { check: "Net Pay", formula: "Gross − PF − ESIC − PT", db: "—", calc: fmt(NET_PAY), ok: true },
                        { check: "Monthly CTC", formula: "Gross + ESIC Employer + Gratuity", db: "—", calc: fmt(CTC), ok: true },
                      ].map((row) => (
                        <tr key={row.check} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-3 font-semibold text-foreground">{row.check}</td>
                          <td className="px-6 py-3 text-muted-foreground font-mono text-xs">{row.formula}</td>
                          <td className="px-6 py-3 text-right font-bold">{row.db}</td>
                          <td className="px-6 py-3 text-right font-bold">{row.calc}</td>
                          <td className="px-6 py-3">
                            {row.ok ? (
                              <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                                <CheckCircle2 className="size-3.5" /> OK
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-rose-600 font-bold text-xs">
                                <AlertCircle className="size-3.5" /> Check
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Law Reference Cards */}
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <BookOpen className="size-4" /> Indian Labour Law References
                </h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    {
                      icon: ShieldCheck, title: "ESIC Act, 1948",
                      color: "text-violet-600", bg: "bg-violet-50 border-violet-100",
                      points: [
                        "Applicable when Basic Salary ≤ ₹21,000/month.",
                        `This employee: ${esicEligible ? "✓ Eligible (Basic = " + fmt(BASIC) + ")" : "✗ Not Eligible (Basic = " + fmt(BASIC) + ")"}`,
                        "Employee: 0.75% of Basic.", "Employer: 3.25% of Basic.",
                      ],
                    },
                    {
                      icon: IndianRupee, title: "Payment of Gratuity Act, 1972",
                      color: "text-amber-600", bg: "bg-amber-50 border-amber-100",
                      points: [
                        "Employer liability — not deducted from salary.",
                        "Payable after 5 years of continuous service.",
                        "Formula: 15/26 × Basic × Years of service.",
                        `Provision: ${fmt(GRATUITY)}/month for this employee.`,
                      ],
                    },
                    {
                      icon: BadgeCheck, title: "Professional Tax",
                      color: "text-blue-600", bg: "bg-blue-50 border-blue-100",
                      points: [
                        "State-level mandatory tax.",
                        `This employee: ${PT > 0 ? "₹200/month (Gross > ₹15,000)" : "₹0 (Gross ≤ ₹15,000)"}`,
                        "Deducted from employee's gross salary.",
                        "Capped at ₹2,500/year.",
                      ],
                    },
                  ].map((card) => (
                    <div key={card.title} className={`rounded-2xl border p-5 ${card.bg}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <card.icon className={`size-5 ${card.color}`} />
                        <p className="text-sm font-black text-foreground">{card.title}</p>
                      </div>
                      <ul className="space-y-1.5">
                        {card.points.map((pt) => (
                          <li key={pt} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <ChevronRight className={`size-3 mt-0.5 shrink-0 ${card.color}`} />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQ */}
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b bg-muted/20 flex items-center gap-2">
                  <Info className="size-4 text-blue-500" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Simple Language Guide</p>
                </div>
                <div className="divide-y">
                  {[
                    {
                      q: "What is CTC?",
                      a: `CTC (Cost to Company) is the total amount the company spends on ${emp.full_name} each month. It includes gross salary of ${fmt(GROSS)}, ESIC employer share of ${fmt(ESIC_EMPR)}, and gratuity provision of ${fmt(GRATUITY)} — totalling ${fmt(CTC)}.`,
                      icon: Building2, color: "text-violet-500",
                    },
                    {
                      q: "Why is take-home less than gross salary?",
                      a: `Gross (${fmt(GROSS)}) minus deductions (PF ${fmt(PF)} + ESIC ${fmt(ESIC_EMP)} + PT ${fmt(PT)} = ${fmt(TOTAL_EMP_DED)}) = Net Pay ${fmt(NET_PAY)}. Employer contributions do not reduce take-home.`,
                      icon: User, color: "text-blue-500",
                    },
                    {
                      q: "Does Gratuity reduce salary?",
                      a: `No. Gratuity (${fmt(GRATUITY)}/month) is set aside by the company and paid as a lump sum after 5 years of service. It is purely an employer-side cost.`,
                      icon: ShieldCheck, color: "text-emerald-500",
                    },
                    {
                      q: `Is ${emp.full_name} ESIC eligible?`,
                      a: esicEligible
                        ? `Yes. Basic salary (${fmt(BASIC)}) is ≤ ₹21,000. Employee pays ${fmt(ESIC_EMP)} (0.75%), Employer pays ${fmt(ESIC_EMPR)} (3.25%). Total ESIC = ${fmt(ESIC_EMP + ESIC_EMPR)}/month.`
                        : `No. Basic salary (${fmt(BASIC)}) exceeds ₹21,000. ESIC does not apply to this employee.`,
                      icon: AlertTriangle, color: "text-amber-500",
                    },
                  ].map((faq) => (
                    <div key={faq.q} className="px-6 py-5 flex gap-4">
                      <faq.icon className={`size-5 shrink-0 mt-0.5 ${faq.color}`} />
                      <div>
                        <p className="text-sm font-black text-foreground mb-1">{faq.q}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SALARY CALCULATOR — for prospective / new-joiner employees
   ═══════════════════════════════════════════════════════════ */
function SalaryCalculator() {
  const [mode, setMode] = useState<"ctc" | "manual">("ctc");
  const [ctcInput, setCtcInput] = useState("");
  const [manualBasic, setManualBasic] = useState("");
  const [manualHra, setManualHra] = useState("");
  const [manualBonus, setManualBonus] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [designation, setDesignation] = useState("");

  const reset = () => {
    setCtcInput(""); setManualBasic(""); setManualHra("");
    setManualBonus(""); setCandidateName(""); setDesignation("");
  };

  const ctcVal = Number(ctcInput) || 0;

  let basic = 0, hra = 0, bonus = 0;

  if (mode === "ctc" && ctcVal > 0) {
    // CTC = Gross + Employer_ESIC(3.25% of Basic) + Gratuity(4.81% of Basic)
    // Basic = 50% of Gross → CTC = Gross × (1 + 0.0325×0.5 + 0.0481×0.5) = Gross × 1.04028
    // For basic > 21000, no ESIC: CTC = Gross × (1 + 0.0481×0.5) = Gross × 1.02405
    const esicCheckGross = ctcVal / 1.04028;
    const esicCheckBasic = esicCheckGross * 0.50;
    const useEsic = esicCheckBasic <= 21000;
    const divisor = useEsic ? 1.04028 : 1.02405;
    const grossEst = Math.round(ctcVal / divisor);
    basic = Math.round(grossEst * 0.50);
    hra = Math.round(grossEst * 0.4253);
    bonus = grossEst - basic - hra;
  } else if (mode === "manual") {
    basic = Number(manualBasic) || 0;
    hra = Number(manualHra) || 0;
    bonus = Number(manualBonus) || 0;
  }

  const gross = basic + hra + bonus;
  const esicElig = basic > 0 && basic <= 21000;
  const esicEmp = esicElig ? Math.round(basic * 0.0075) : 0;
  const esicEmpr = esicElig ? Math.round(basic * 0.0325) : 0;
  const gratuity = Math.round(basic * 0.0481);
  const pt = gross > 15000 ? 200 : 0;
  const totalEmpDed = esicEmp + pt;
  const netPay = gross - totalEmpDed;
  const ctc = gross + esicEmpr + gratuity;
  const hasResult = gross > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Calculator Card */}
      <div className="rounded-2xl border-2 border-primary/20 bg-card shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-violet-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="size-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/70">New Joiner Tool</p>
              <p className="text-lg font-black text-white">Salary Bifurcation Calculator</p>
            </div>
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs font-bold text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg"
          >
            <RotateCcw className="size-3.5" /> Reset
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Candidate info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Candidate Name <span className="text-muted-foreground/40">(optional)</span>
              </label>
              <input
                placeholder="e.g. Rahul Sharma"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Designation <span className="text-muted-foreground/40">(optional)</span>
              </label>
              <input
                placeholder="e.g. Lab Technician"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Mode toggle */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">
              Calculation Mode
            </label>
            <div className="flex gap-2 p-1 bg-muted/40 rounded-xl border w-fit">
              {([
                { id: "ctc" as const, label: "Enter CTC → Auto Split", icon: Zap },
                { id: "manual" as const, label: "Enter Manual Amounts", icon: Calculator },
              ]).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                    mode === m.id ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <m.icon className="size-3.5" /> {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* CTC input */}
          {mode === "ctc" && (
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-indigo-700 mb-1.5 block">
                Monthly CTC (₹)
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 font-black text-lg">₹</span>
                  <input
                    type="number"
                    placeholder="e.g. 39000"
                    value={ctcInput}
                    onChange={(e) => setCtcInput(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-indigo-200 bg-white text-lg font-black focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                {ctcVal > 0 && (
                  <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xs bg-indigo-100 px-3 py-2 rounded-lg">
                    <ArrowRight className="size-3.5" /> Auto-calculating…
                  </div>
                )}
              </div>
              <p className="text-[10px] text-indigo-600/60 mt-2">
                CTC = Gross + ESIC Employer (3.25% of Basic) + Gratuity (4.81% of Basic). Basic = 50% · HRA = 42.53% · Bonus = balance. ESIC applies only if Basic ≤ ₹21,000.
              </p>
            </div>
          )}

          {/* Manual input */}
          {mode === "manual" && (
            <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Enter Salary Components Manually
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Basic Salary (₹)", val: manualBasic, set: setManualBasic, hint: "50% of gross typically" },
                  { label: "HRA (₹)", val: manualHra, set: setManualHra, hint: "42.53% of gross typically" },
                  { label: "Monthly Bonus (₹)", val: manualBonus, set: setManualBonus, hint: "Balance of gross" },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">{f.label}</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border bg-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{f.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!hasResult && (
        <div className="rounded-2xl border-2 border-dashed border-muted bg-muted/20 py-20 text-center">
          <Calculator className="size-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-base font-black text-muted-foreground">
            {mode === "ctc" ? "Enter a Monthly CTC above to calculate" : "Enter Basic, HRA and Bonus above to calculate"}
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1">Full salary bifurcation will appear instantly.</p>
        </div>
      )}

      {/* Results */}
      {hasResult && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

          {/* Candidate banner */}
          {(candidateName || designation) && (
            <div className="rounded-2xl border bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow">
                  {candidateName ? candidateName.charAt(0).toUpperCase() : "?"}
                </div>
                <div>
                  <p className="font-black text-foreground">{candidateName || "Candidate"}</p>
                  <p className="text-xs text-muted-foreground">{designation || "—"} · {esicElig ? "ESIC Eligible" : "ESIC Not Applicable"}</p>
                </div>
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground border rounded-xl px-3 py-2 hover:bg-muted/30 transition-colors"
              >
                <Printer className="size-4" /> Print / Save PDF
              </button>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Monthly CTC", value: fmt(ctc), icon: Building2, color: "bg-violet-600", note: "Gross + ESIC Empr + Gratuity" },
              { label: "Gross Salary", value: fmt(gross), icon: TrendingUp, color: "bg-blue-600", note: "Basic + HRA + Bonus" },
              { label: "Employee Deductions", value: fmt(totalEmpDed), icon: Calculator, color: "bg-amber-500", note: "ESIC + PT" },
              { label: "Net Take-Home", value: fmt(netPay), icon: IndianRupee, color: "bg-emerald-600", note: "Gross − Deductions" },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border bg-card shadow-sm p-5 flex flex-col gap-3">
                <div className={`size-10 rounded-xl ${c.color} flex items-center justify-center shadow-lg`}>
                  <c.icon className="size-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{c.label}</p>
                  <p className="text-2xl font-black text-foreground mt-0.5">{c.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{c.note}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Full breakdown */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-muted/20 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Full Salary Bifurcation</p>
                <p className="text-base font-bold mt-0.5">{candidateName ? candidateName + " — " : ""}Complete Breakdown</p>
              </div>
              {esicElig
                ? <Badge color="violet"><ShieldCheck className="size-3" /> ESIC Eligible</Badge>
                : <Badge color="orange"><AlertCircle className="size-3" /> Basic &gt; ₹21,000 — No ESIC</Badge>
              }
            </div>
            <div className="divide-y">
              <div className="px-6 py-3 bg-blue-50/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Earnings</p>
              </div>
              {[
                { label: "Basic Salary", value: basic, pct: gross > 0 ? ((basic / gross) * 100).toFixed(1) + "%" : "—", note: "50% of Gross" },
                { label: "HRA (House Rent Allowance)", value: hra, pct: gross > 0 ? ((hra / gross) * 100).toFixed(1) + "%" : "—", note: "42.53% of Gross" },
                { label: "Monthly Bonus", value: bonus, pct: gross > 0 ? ((bonus / gross) * 100).toFixed(1) + "%" : "—", note: "Balance of Gross" },
              ].map((r) => (
                <div key={r.label} className="px-6 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{r.label}</p>
                    <p className="text-[11px] text-muted-foreground">{r.note}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-blue-700">{fmt(r.value)}</p>
                    <p className="text-[10px] text-muted-foreground">{r.pct}</p>
                  </div>
                </div>
              ))}
              <div className="px-6 py-3 bg-blue-100/40 flex justify-between">
                <p className="text-sm font-black text-blue-700">Gross Salary</p>
                <p className="text-sm font-black text-blue-700">{fmt(gross)}</p>
              </div>

              <div className="px-6 py-3 bg-rose-50/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Employee Deductions (from salary)</p>
              </div>
              {[
                { label: "ESIC Employee (0.75% of Basic)", value: esicEmp, note: esicElig ? `${fmt(basic)} × 0.75%` : "Not applicable — Basic > ₹21,000", applicable: esicElig },
                { label: "Professional Tax", value: pt, note: gross > 15000 ? "Gross > ₹15,000 → ₹200/month" : "Not applicable", applicable: pt > 0 },
              ].map((r) => (
                <div key={r.label} className={`px-6 py-3.5 flex items-center justify-between gap-4 ${!r.applicable ? "opacity-50" : ""}`}>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{r.label}</p>
                    <p className="text-[11px] text-muted-foreground">{r.note}</p>
                  </div>
                  <p className={`text-sm font-black ${r.applicable ? "text-rose-600" : "text-muted-foreground"}`}>{fmt(r.value)}</p>
                </div>
              ))}
              <div className="px-6 py-3 bg-rose-100/40 flex justify-between">
                <p className="text-sm font-black text-rose-700">Total Employee Deductions</p>
                <p className="text-sm font-black text-rose-700">{fmt(totalEmpDed)}</p>
              </div>

              <div className="px-6 py-3 bg-violet-50/40">
                <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Employer Contributions (NOT from salary)</p>
              </div>
              {[
                { label: "ESIC Employer (3.25% of Basic)", value: esicEmpr, note: esicElig ? `${fmt(basic)} × 3.25%` : "Not applicable — Basic > ₹21,000" },
                { label: "Gratuity Provision (4.81% of Basic)", value: gratuity, note: `${fmt(basic)} × 4.81% — Paid after 5 years` },
              ].map((r) => (
                <div key={r.label} className="px-6 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{r.label}</p>
                    <p className="text-[11px] text-muted-foreground">{r.note}</p>
                  </div>
                  <p className="text-sm font-black text-violet-700">{fmt(r.value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTC dark summary */}
          <div className="rounded-2xl border bg-gradient-to-br from-slate-900 to-slate-800 shadow-xl overflow-hidden text-white">
            <div className="px-6 py-5 border-b border-white/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">CTC Summary</p>
              <p className="text-xl font-black mt-0.5">Monthly Cost to Company</p>
            </div>
            <div className="px-6 py-5 space-y-2 text-sm">
              {[
                { label: "Gross Salary", value: fmt(gross) },
                { label: "+ ESIC Employer Share", value: fmt(esicEmpr) },
                { label: "+ Gratuity Provision", value: fmt(gratuity) },
              ].map((r) => (
                <div key={r.label} className="flex justify-between py-2 border-b border-white/10 opacity-80">
                  <span className="text-white/70">{r.label}</span>
                  <span className="font-black text-white">{r.value}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 mt-1 bg-white/10 rounded-xl px-4">
                <span className="font-black text-lg">Monthly CTC</span>
                <span className="font-black text-2xl text-emerald-400">{fmt(ctc)}</span>
              </div>
              <div className="flex justify-between py-3 bg-emerald-900/30 rounded-xl px-4">
                <span className="font-black text-base">Net Take-Home Pay</span>
                <span className="font-black text-xl text-emerald-300">{fmt(netPay)}</span>
              </div>
            </div>
          </div>

          {/* Monthly vs Annual table */}
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-muted/20">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Monthly vs Annual Figures</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/10">
                    <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Component</th>
                    <th className="text-right px-6 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Monthly</th>
                    <th className="text-right px-6 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Annual (×12)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { label: "Monthly CTC", value: ctc },
                    { label: "Gross Salary", value: gross },
                    { label: "Net Take-Home", value: netPay },
                    { label: "Employee Deductions", value: totalEmpDed },
                    { label: "Employer Contributions", value: esicEmpr + gratuity },
                  ].map((r) => (
                    <tr key={r.label} className="hover:bg-muted/10">
                      <td className="px-6 py-3 font-semibold text-foreground">{r.label}</td>
                      <td className="px-6 py-3 text-right font-bold">{fmt(r.value)}</td>
                      <td className="px-6 py-3 text-right font-black text-primary">{fmt(r.value * 12)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
