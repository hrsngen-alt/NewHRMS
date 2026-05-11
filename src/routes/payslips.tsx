import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { generatePayslipPDF } from "@/lib/payslip";
import { FileDown, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/payslips")({ component: () => <AppShell><PayslipsPage /></AppShell> });

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function PayslipsPage() {
  const { user, role } = useAuth();
  const [q, setQ] = useState("");
  const isAdmin = role === "admin";

  const { data: myEmployee } = useQuery({
    queryKey: ["my-employee", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("employees").select("id").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: slips = [] } = useQuery({
    queryKey: ["payslips", role, myEmployee?.id],
    queryFn: async () => {
      let q = supabase.from("payslips").select("*, payroll_runs(period_month, period_year), employees(*)").order("created_at", { ascending: false });
      if (role !== "admin" && myEmployee) q = (q as any).eq("employee_id", myEmployee.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filteredSlips = slips.filter((s: any) => {
    if (!q) return true;
    const search = q.toLowerCase();
    return (
      s.employees?.full_name?.toLowerCase().includes(search) ||
      s.employees?.employee_code?.toLowerCase().includes(search) ||
      months[s.payroll_runs?.period_month - 1]?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Salary Slips</h1>
        <p className="text-sm text-muted-foreground">Download monthly payslips as PDF.</p>
      </div>

      <div className="rounded-2xl border bg-card shadow-card overflow-hidden">
        <div className="bg-muted/20 px-6 py-3 border-b flex items-center justify-between gap-4">
          <h3 className="font-semibold">Payroll History</h3>
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
            {filteredSlips.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{months[s.payroll_runs!.period_month - 1]} {s.payroll_runs!.period_year}</TableCell>
                {role === "admin" && <TableCell>{s.employees?.full_name}</TableCell>}
                <TableCell className="text-right">₹{Number(s.gross).toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right text-destructive">₹{Number(s.total_deductions).toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right font-semibold">₹{Number(s.net_pay).toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => generatePayslipPDF(s as never)}><FileDown className="size-3.5" /> PDF</Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredSlips.length === 0 && <TableRow><TableCell colSpan={role === "admin" ? 6 : 5} className="py-12 text-center text-muted-foreground">No matching payslips found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
