import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Lock, Play, FileDown, Wallet } from "lucide-react";
import { generatePayslipPDF } from "@/lib/payslip";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/payroll")({ component: () => <AppShell><PayrollPage /></AppShell> });

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function PayrollPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selDept, setSelDept] = useState<string>("all");

  const { data: runs = [] } = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: async () => (await supabase.from("payroll_runs").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false })).data ?? [],
  });
  
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("department");
      return Array.from(new Set((data ?? []).map(e => e.department).filter(Boolean))) as string[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await (supabase.from("company_settings" as any).select("company_name").maybeSingle() as any)).data,
  });

  const companyName = (settings as any)?.company_name || "SN Gene HR";

  const { data: latestSlips = [] } = useQuery({
    queryKey: ["latest-payslips", month, year],
    queryFn: async () => {
      const { data } = await supabase.from("payslips").select("*, employees(department)").gte("created_at", `${year}-${String(month).padStart(2, '0')}-01`);
      return data ?? [];
    },
  });

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

  const processPayroll = async () => {
    let q = supabase.from("employees").select("*").eq("status", "active");
    if (selDept !== "all") q = q.eq("department", selDept);
    
    const { data: employees } = await q;
    if (!employees || employees.length === 0) return toast.error("No active employees found for selection");

    const { data: run, error: runErr } = await supabase.from("payroll_runs")
      .upsert({ period_month: month, period_year: year, status: "processed", processed_at: new Date().toISOString() }, { onConflict: "period_month,period_year" })
      .select().single();
    if (runErr || !run) return toast.error(runErr?.message ?? "Failed");

    // Compute leave deductions for the month
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);
    const { data: leaves } = await supabase.from("leaves").select("employee_id, days").eq("status", "approved").gte("start_date", monthStart).lte("end_date", monthEnd);
    const leaveMap: Record<string, number> = {};
    (leaves ?? []).forEach((l) => { leaveMap[l.employee_id] = (leaveMap[l.employee_id] ?? 0) + Number(l.days); });

    const workingDays = 30;
    const slips = employees.map((e) => {
      const leaveDays = Math.min(workingDays, leaveMap[e.id] ?? 0);
      const paidDays = workingDays - leaveDays;
      const factor = paidDays / workingDays;
      const basic = Number(e.basic_salary) * factor;
      const hra = Number(e.hra) * factor;
      const conveyance = Number(e.conveyance) * factor;
      const medical = Number(e.medical) * factor;
      const special = Number(e.special_allowance) * factor;
      const bonus = Number((e as any).bonus ?? 0) * factor;
      const gross = basic + hra + conveyance + medical + special + bonus;
      const pf = Math.min(basic * 0.12, 1800);
      const esic = gross < 21000 ? gross * 0.0075 : 0;
      const gratuity = 0;
      const pt = gross > 15000 ? 200 : 0;
      const tds = gross > 50000 ? gross * 0.05 : 0;
      const leaveDeduction = (Number(e.basic_salary) / workingDays) * leaveDays * 0;
      const totalDed = pf + esic + gratuity + pt + tds + leaveDeduction;
      return {
        payroll_run_id: run.id, employee_id: e.id, working_days: workingDays, paid_days: paidDays,
        basic, hra, conveyance, medical, special_allowance: special, bonus,
        pf, esic, pt, tds, leave_deduction: leaveDeduction, gratuity,
        gross, total_deductions: totalDed, net_pay: gross - totalDed,
      };
    });

    const { error: insErr } = await supabase.from("payslips").upsert(slips, { onConflict: "payroll_run_id,employee_id" });
    if (insErr) return toast.error(insErr.message);

    const totalNet = slips.reduce((s, p) => s + p.net_pay, 0);
    await supabase.from("payroll_runs").update({ total_net: totalNet }).eq("id", run.id);
    toast.success(`Processed ${slips.length} payslips`);
    qc.invalidateQueries({ queryKey: ["payroll-runs"] });
  };

  const lockRun = async (id: string) => {
    await supabase.from("payroll_runs").update({ status: "locked" }).eq("id", id);
    toast.success("Payroll locked");
    qc.invalidateQueries({ queryKey: ["payroll-runs"] });
  };

  const downloadAll = async (runId: string) => {
    const { data } = await supabase.from("payslips").select("*, payroll_runs(period_month, period_year), employees(*)").eq("payroll_run_id", runId);
    (data ?? []).forEach((p) => generatePayslipPDF(p as never, companyName));
    toast.success(`Generated ${data?.length ?? 0} slips`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">Payroll</h1>
          <p className="text-sm font-medium text-muted-foreground/60 mt-1">Execute automated payroll processing, distribute payslips, and manage compensation compliance.</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm border-l-4 border-l-primary">
        <div className="flex items-center gap-3 mb-4">
          <Play className="size-5 text-primary" />
          <h3 className="font-semibold text-lg">Run Payroll</h3>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40 bg-muted/30"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32 bg-muted/30"><SelectValue /></SelectTrigger>
              <SelectContent>{[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Department</Label>
            <Select value={selDept} onValueChange={setSelDept}>
              <SelectTrigger className="w-48 bg-muted/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={processPayroll} className="gap-2 px-6 bg-primary hover:bg-primary-glow shadow-sm">
            <Play className="size-4 fill-current" /> Execute Run
          </Button>
        </div>
      </div>

      {deptSummary.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="bg-muted/20 px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Department-wise Summary ({months[month-1]} {year})</h3>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">{deptSummary.length} Departments</span>
          </div>
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="pl-6">Department</TableHead>
                <TableHead className="text-center">Employees</TableHead>
                <TableHead className="text-right">Total Gross</TableHead>
                <TableHead className="text-right">Total Ded.</TableHead>
                <TableHead className="text-right pr-6">Net Payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptSummary.map((d) => (
                <TableRow key={d.name}>
                  <TableCell className="font-semibold pl-6">{d.name}</TableCell>
                  <TableCell className="text-center font-medium">{d.count}</TableCell>
                  <TableCell className="text-right">₹{d.gross.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right text-destructive">₹{d.deductions.toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right font-bold pr-6">₹{d.net.toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/20 px-6 py-4 border-b">
          <h3 className="font-semibold">Recent Payroll History</h3>
        </div>
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-bold text-foreground pl-6">Payroll Period</TableHead>
              <TableHead className="font-bold text-foreground">Status</TableHead>
              <TableHead className="text-right font-bold text-foreground">Total Net Payout</TableHead>
              <TableHead className="text-right font-bold text-foreground pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/10 transition-colors">
                <TableCell className="font-semibold pl-6">{months[r.period_month - 1]} {r.period_year}</TableCell>
                <TableCell>
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                    r.status === "locked" ? "bg-slate-100 text-slate-700" : "bg-green-100 text-green-700"
                  )}>
                    {r.status}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono font-bold">₹{Number(r.total_net).toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadAll(r.id)} className="gap-2 border-primary/20 text-primary hover:bg-primary/5">
                      <FileDown className="size-3.5" /> Download Slips
                    </Button>
                    {r.status !== "locked" && (
                      <Button size="sm" variant="ghost" onClick={() => lockRun(r.id)} className="gap-2 text-muted-foreground hover:text-foreground">
                        <Lock className="size-3.5" /> Finalize
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
                    <p className="text-muted-foreground font-medium">No payroll runs found for the selected criteria.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
