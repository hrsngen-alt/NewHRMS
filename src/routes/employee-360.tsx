import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  Briefcase, Mail, Phone, CalendarDays, Wallet, Clock, 
  User, Award, Activity, FileText, Share2, Printer, Pencil, Plus, Trash2, Check, ChevronsUpDown,
  Laptop, FileCheck, Network, Cpu, TrendingUp, AlertTriangle, ChevronRight, XCircle, CheckCircle2, Sparkles
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/employee-360")({
  component: () => <AppShell><Employee360Page /></AppShell>
});

function Employee360Page() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin" || role === "manager";
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [isEmpComboboxOpen, setIsEmpComboboxOpen] = useState(false);
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-360-list"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees" as any).select("id, full_name, employee_code, department, designation").eq("status", "active").order("full_name");
      if (error) throw error;
      return (data as any[]) || [];
    }
  });

  const myEmpId = selectedEmpId; // If not admin, they'd see their own, but let's assume this page is for admin/hr mostly.

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee-360-details", selectedEmpId],
    enabled: !!selectedEmpId,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees" as any).select("*").eq("id", selectedEmpId).single();
      if (error) throw error;
      return data as any;
    }
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["employee-360-leaves", selectedEmpId],
    enabled: !!selectedEmpId,
    queryFn: async () => {
      const { data, error } = await supabase.from("leaves" as any).select("*").eq("employee_id", selectedEmpId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    }
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["employee-360-attendance", selectedEmpId],
    enabled: !!selectedEmpId,
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance" as any).select("*").eq("employee_id", selectedEmpId).order("date", { ascending: false }).limit(30);
      if (error) throw error;
      return (data as any[]) || [];
    }
  });

  const { data: performance = [] } = useQuery({
    queryKey: ["employee-360-performance", selectedEmpId],
    enabled: !!selectedEmpId,
    queryFn: async () => {
      const { data, error } = await supabase.from("performance_reviews" as any).select("*").eq("employee_id", selectedEmpId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    }
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ["employee-360-payslips", selectedEmpId],
    enabled: !!selectedEmpId,
    queryFn: async () => {
      const { data, error } = await supabase.from("payslips" as any).select("*, payroll_runs(period_month, period_year)").eq("employee_id", selectedEmpId).order("created_at", { ascending: false }).limit(6);
      if (error) throw error;
      return (data as any[]) || [];
    }
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["employee-360-documents", selectedEmpId],
    enabled: !!selectedEmpId,
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_documents" as any).select("*").eq("employee_id", selectedEmpId);
      if (error) return []; // Might not exist
      return (data as any[]) || [];
    }
  });

  const { data: assets = [], refetch: refetchAssets } = useQuery({
    queryKey: ["employee-360-assets", selectedEmpId],
    enabled: !!selectedEmpId,
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_assets" as any).select("*").eq("employee_id", selectedEmpId);
      if (error) return []; // Might not exist
      return (data as any[]) || [];
    }
  });

  // Calculate quick stats
  const approvedLeaves = leaves.filter((l: any) => l.status === "approved").reduce((acc: number, curr: any) => acc + curr.days, 0);
  const totalCTC = employee ? (employee.basic_salary + employee.hra + employee.special_allowance + employee.conveyance + employee.medical) * 12 : 0;
  const recentRating = performance.length > 0 ? performance[0].rating : "N/A";

  const getMonthName = (m: number) => {
    const d = new Date();
    d.setMonth(m - 1);
    return d.toLocaleString('default', { month: 'short' });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Activity className="size-8 text-indigo-600" /> Employee 360° Profile
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Complete overview of employee lifecycle, performance, and data.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {isAdmin && (
            <Popover open={isEmpComboboxOpen} onOpenChange={setIsEmpComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isEmpComboboxOpen}
                  className="w-full md:w-[300px] h-12 rounded-xl justify-between border-2 bg-white dark:bg-slate-900 shadow-sm"
                >
                  {selectedEmpId
                    ? employees.find((emp: any) => emp.id === selectedEmpId)?.full_name
                    : "Search employee..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Search by name or emp code..." />
                  <CommandList>
                    <CommandEmpty>No employee found.</CommandEmpty>
                    <CommandGroup>
                      {employees.map((emp: any) => (
                        <CommandItem
                          key={emp.id}
                          value={`${emp.full_name} ${emp.employee_code}`}
                          onSelect={() => {
                            setSelectedEmpId(emp.id === selectedEmpId ? "" : emp.id)
                            setIsEmpComboboxOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedEmpId === emp.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {emp.full_name} <span className="text-muted-foreground text-xs ml-2">({emp.employee_code})</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          {isAdmin && selectedEmpId && (
            <Button variant="outline" className="h-12 rounded-xl gap-2 font-bold text-indigo-600 border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/30" asChild>
              <a href={`/employees?edit=${selectedEmpId}`}>
                <Pencil className="size-4" /> Edit Profile
              </a>
            </Button>
          )}
          
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl shrink-0" title="Print Profile" disabled={!selectedEmpId}>
            <Printer className="size-5" />
          </Button>
          <Button variant="default" size="icon" className="h-12 w-12 rounded-xl shrink-0 bg-indigo-600 hover:bg-indigo-700" title="Share" disabled={!selectedEmpId}>
            <Share2 className="size-5" />
          </Button>
        </div>
      </div>

      {!selectedEmpId ? (
        <div className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center">
          <User className="size-16 text-indigo-200 dark:text-indigo-900 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300">Select an Employee</h2>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">Choose an employee from the dropdown above to view their complete 360° profile, including attendance, performance, and compensation history.</p>
        </div>
      ) : isLoading ? (
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : employee ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* TOP FULL WIDTH SUMMARY CARD (Spans 12 cols but inside a layout) */}
          <div className="xl:col-span-12">
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 rounded-3xl p-1 overflow-hidden shadow-2xl relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Network className="size-64" />
              </div>
              <div className="bg-white dark:bg-slate-950 rounded-[22px] p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
                <div className="relative">
                  {employee.photo_url ? (
                    <img src={employee.photo_url} alt="Profile" className="size-32 rounded-2xl object-cover shadow-lg border-4 border-white dark:border-slate-800" />
                  ) : (
                    <div className="size-32 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shadow-lg border-4 border-white dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-black text-4xl">
                      {employee.full_name.charAt(0)}
                    </div>
                  )}
                  <div className="absolute -bottom-3 -right-3 bg-green-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border-2 border-white dark:border-slate-950 shadow-sm">
                    {employee.status}
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left space-y-4">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{employee.full_name}</h2>
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold text-lg flex items-center justify-center md:justify-start gap-2 mt-1">
                      <Briefcase className="size-5" /> {employee.designation} <span className="text-muted-foreground font-medium text-sm">• {employee.department}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg"><User className="size-4" /> {employee.employee_code}</span>
                    <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg"><Mail className="size-4" /> {employee.email}</span>
                    {employee.phone && <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg"><Phone className="size-4" /> {employee.phone}</span>}
                    <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg"><CalendarDays className="size-4" /> Joined: {new Date(employee.joining_date || "").toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-2 gap-4 w-full xl:w-auto mt-4 md:mt-0">
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-center xl:min-w-[120px]">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">CTC (Annual)</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">₹{(totalCTC / 100000).toFixed(2)}L</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-center xl:min-w-[120px]">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Leaves Taken</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{approvedLeaves}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-center xl:min-w-[120px]">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Last Rating</p>
                    <p className="text-xl font-black text-amber-500 flex items-center justify-center gap-1">
                      {recentRating} <Award className="size-4" />
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-center xl:min-w-[120px]">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Company Exp.</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {Math.floor((new Date().getTime() - new Date(employee.joining_date || "").getTime()) / (1000 * 3600 * 24 * 365.25))} Yrs
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl text-center xl:min-w-[120px]">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Exp.</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {employee.total_experience ? `${employee.total_experience} Yrs` : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* LEFT COLUMN - TABS (Spans 8 cols) */}
          <div className="xl:col-span-8 space-y-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-white dark:bg-slate-900 h-14 p-1.5 rounded-2xl shadow-sm border w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview" className="rounded-xl px-6 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Overview</TabsTrigger>
                <TabsTrigger value="compensation" className="rounded-xl px-6 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Compensation</TabsTrigger>
                <TabsTrigger value="attendance" className="rounded-xl px-6 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Leave & Attendance</TabsTrigger>
                <TabsTrigger value="performance" className="rounded-xl px-6 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Performance</TabsTrigger>
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="mt-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="rounded-3xl shadow-sm border-2 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                      <CardTitle className="text-lg font-black flex items-center gap-2"><User className="size-5 text-indigo-600" /> Personal Info</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-sm">
                      <div className="grid grid-cols-3 gap-2 border-b pb-3">
                        <span className="text-muted-foreground font-semibold">PAN</span>
                        <span className="col-span-2 font-bold text-slate-900 dark:text-white uppercase">{employee.pan_number || "Not Provided"}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-b pb-3">
                        <span className="text-muted-foreground font-semibold">Aadhaar</span>
                        <span className="col-span-2 font-bold text-slate-900 dark:text-white">{employee.aadhaar_number || "Not Provided"}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-b pb-3">
                        <span className="text-muted-foreground font-semibold">UAN</span>
                        <span className="col-span-2 font-bold text-slate-900 dark:text-white">{employee.uan_number || "Not Provided"}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 border-b pb-3">
                        <span className="text-muted-foreground font-semibold">Bank Name</span>
                        <span className="col-span-2 font-bold text-slate-900 dark:text-white">{employee.bank_name || "Not Provided"}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-muted-foreground font-semibold">Account No</span>
                        <span className="col-span-2 font-bold text-slate-900 dark:text-white">{employee.bank_account || "Not Provided"}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl shadow-sm border-2 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                      <CardTitle className="text-lg font-black flex items-center gap-2"><Network className="size-5 text-indigo-600" /> Organization</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Reporting Manager</p>
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border">
                          <div className="size-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
                            <User className="size-5" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">
                              {employee.reporting_manager || "Self / Top Level"}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium">Manager</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Direct Reports</p>
                        <div className="space-y-2">
                          {employees.filter((e: any) => e.id !== employee.id && employee.full_name === (e as any).reporting_manager).length > 0 ? (
                            employees.filter((e: any) => e.id !== employee.id && employee.full_name === (e as any).reporting_manager).map((dr: any) => (
                              <div key={dr.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border">
                                <div className="size-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                  <User className="size-4 text-slate-500" />
                                </div>
                                <div>
                                  <p className="font-bold text-xs">{dr.full_name}</p>
                                  <p className="text-[10px] text-muted-foreground">{dr.designation}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm italic text-muted-foreground">No direct reports.</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-3xl shadow-sm border-2 overflow-hidden">
                  <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black flex items-center gap-2"><Activity className="size-5 text-indigo-600" /> Activity Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-3 space-y-6">
                      
                      {/* Synthesize Timeline from data */}
                      <div className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 size-4 bg-white dark:bg-slate-950 border-2 border-indigo-500 rounded-full"></div>
                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">{new Date().toLocaleDateString()}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Profile Viewed</p>
                        <p className="text-xs text-muted-foreground mt-1">HR Admin viewed the 360 profile.</p>
                      </div>

                      {performance.length > 0 && (
                        <div className="relative pl-6">
                          <div className="absolute -left-[9px] top-1 size-4 bg-white dark:bg-slate-950 border-2 border-amber-500 rounded-full"></div>
                          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">{new Date(performance[0].created_at).toLocaleDateString()}</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Performance Review Completed</p>
                          <p className="text-xs text-muted-foreground mt-1">Received a rating of {performance[0].rating}/5 for period {performance[0].review_period}.</p>
                        </div>
                      )}

                      {leaves.length > 0 && (
                        <div className="relative pl-6">
                          <div className="absolute -left-[9px] top-1 size-4 bg-white dark:bg-slate-950 border-2 border-rose-500 rounded-full"></div>
                          <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">{new Date(leaves[0].created_at).toLocaleDateString()}</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">Leave Request</p>
                          <p className="text-xs text-muted-foreground mt-1">Requested {leaves[0].days} days of {leaves[0].leave_type} leave (Status: {leaves[0].status}).</p>
                        </div>
                      )}

                      <div className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 size-4 bg-white dark:bg-slate-950 border-2 border-green-500 rounded-full"></div>
                        <p className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">{new Date(employee.joining_date || "").toLocaleDateString()}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Joined Company</p>
                        <p className="text-xs text-muted-foreground mt-1">Started as {employee.designation} in {employee.department} department.</p>
                      </div>

                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* COMPENSATION TAB */}
              <TabsContent value="compensation" className="mt-6 space-y-6">
                <Card className="rounded-3xl shadow-sm border-2 overflow-hidden">
                  <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                    <CardTitle className="text-lg font-black flex items-center gap-2"><Wallet className="size-5 text-indigo-600" /> Current Salary Structure</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground border-b pb-2">Earnings (Monthly)</h4>
                        <div className="flex justify-between items-center text-sm"><span className="font-medium text-slate-600 dark:text-slate-400">Basic Salary</span><span className="font-bold text-slate-900 dark:text-white">₹{employee.basic_salary?.toLocaleString('en-IN') || 0}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="font-medium text-slate-600 dark:text-slate-400">HRA</span><span className="font-bold text-slate-900 dark:text-white">₹{employee.hra?.toLocaleString('en-IN') || 0}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="font-medium text-slate-600 dark:text-slate-400">Special Allowance</span><span className="font-bold text-slate-900 dark:text-white">₹{employee.special_allowance?.toLocaleString('en-IN') || 0}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="font-medium text-slate-600 dark:text-slate-400">Conveyance</span><span className="font-bold text-slate-900 dark:text-white">₹{employee.conveyance?.toLocaleString('en-IN') || 0}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="font-medium text-slate-600 dark:text-slate-400">Medical Allowance</span><span className="font-bold text-slate-900 dark:text-white">₹{employee.medical?.toLocaleString('en-IN') || 0}</span></div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t"><span className="font-black text-slate-900 dark:text-white">Total Gross</span><span className="font-black text-indigo-600 dark:text-indigo-400">₹{(employee.basic_salary + employee.hra + employee.special_allowance + employee.conveyance + employee.medical).toLocaleString('en-IN')}</span></div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground border-b pb-2">Deductions (Monthly)</h4>
                        <div className="flex justify-between items-center text-sm"><span className="font-medium text-slate-600 dark:text-slate-400">PF Contribution</span><span className="font-bold text-slate-900 dark:text-white">₹{employee.pf_amount?.toLocaleString('en-IN') || 0}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="font-medium text-slate-600 dark:text-slate-400">ESIC</span><span className="font-bold text-slate-900 dark:text-white">₹{employee.esic_amount?.toLocaleString('en-IN') || 0}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="font-medium text-slate-600 dark:text-slate-400">Professional Tax</span><span className="font-bold text-slate-900 dark:text-white">₹200</span></div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t mt-auto"><span className="font-black text-slate-900 dark:text-white">Total Deductions</span><span className="font-black text-rose-600 dark:text-rose-400">₹{((employee.pf_amount || 0) + (employee.esic_amount || 0) + 200).toLocaleString('en-IN')}</span></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl shadow-sm border-2 overflow-hidden">
                  <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                    <CardTitle className="text-lg font-black flex items-center gap-2"><FileText className="size-5 text-indigo-600" /> Recent Payslips</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {payslips.length > 0 ? (
                      <div className="divide-y">
                        {payslips.map((ps: any) => (
                          <div key={ps.id} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="size-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                <Wallet className="size-5" />
                              </div>
                              <div>
                                <p className="font-bold text-sm">{getMonthName(ps.payroll_runs?.period_month)} {ps.payroll_runs?.period_year}</p>
                                <p className="text-xs text-muted-foreground">Net Pay: ₹{ps.net_pay.toLocaleString('en-IN')}</p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="rounded-xl font-bold gap-2">
                              View <ChevronRight className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground text-sm italic">No payslips generated yet.</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ATTENDANCE TAB */}
              <TabsContent value="attendance" className="mt-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="rounded-3xl shadow-sm border-2 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                      <CardTitle className="text-lg font-black flex items-center gap-2"><Clock className="size-5 text-indigo-600" /> Recent Attendance (Last 30 Days)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {attendance.length > 0 ? (
                        <div className="divide-y">
                          {attendance.map((a: any) => (
                            <div key={a.id} className="p-3 px-6 flex items-center justify-between">
                              <div>
                                <p className="font-bold text-sm">{new Date(a.date).toLocaleDateString()}</p>
                                <p className="text-[10px] text-muted-foreground">{a.check_in || "--"} to {a.check_out || "--"} ({a.hours_worked || 0} hrs)</p>
                              </div>
                              <Badge className={
                                a.status === 'present' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                a.status === 'absent' ? "bg-rose-100 text-rose-700 hover:bg-rose-100" :
                                "bg-amber-100 text-amber-700 hover:bg-amber-100"
                              }>{a.status.toUpperCase()}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-muted-foreground text-sm italic">No attendance records found.</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl shadow-sm border-2 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                      <CardTitle className="text-lg font-black flex items-center gap-2"><CalendarDays className="size-5 text-indigo-600" /> Leave History</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {leaves.length > 0 ? (
                        <div className="divide-y">
                          {leaves.map((l: any) => (
                            <div key={l.id} className="p-3 px-6 flex items-center justify-between">
                              <div>
                                <p className="font-bold text-sm capitalize">{l.leave_type} Leave</p>
                                <p className="text-[10px] text-muted-foreground">{l.start_date} to {l.end_date} • {l.days} days</p>
                              </div>
                              <Badge className={
                                l.status === 'approved' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                l.status === 'rejected' ? "bg-rose-100 text-rose-700 hover:bg-rose-100" :
                                "bg-amber-100 text-amber-700 hover:bg-amber-100"
                              }>{l.status.toUpperCase()}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-muted-foreground text-sm italic">No leave records found.</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* PERFORMANCE TAB */}
              <TabsContent value="performance" className="mt-6 space-y-6">
                <Card className="rounded-3xl shadow-sm border-2 overflow-hidden">
                  <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                    <CardTitle className="text-lg font-black flex items-center gap-2"><Award className="size-5 text-indigo-600" /> Appraisal History</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {performance.length > 0 ? (
                      <div className="space-y-6">
                        {performance.map((p: any) => (
                          <div key={p.id} className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-4">
                              <div>
                                <h4 className="font-black text-lg text-slate-900 dark:text-white">{p.review_period} Review</h4>
                                <p className="text-xs text-muted-foreground mt-1">Submitted on {new Date(p.created_at).toLocaleDateString()}</p>
                              </div>
                              <div className="flex items-center gap-2 bg-white dark:bg-slate-950 px-4 py-2 rounded-xl border shadow-sm">
                                <span className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Rating</span>
                                <span className="font-black text-xl text-amber-500 flex items-center gap-1">{p.rating}/5 <Award className="size-5" /></span>
                              </div>
                            </div>
                            <div className="space-y-4 text-sm">
                              <div>
                                <p className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-1">Feedback</p>
                                <p className="text-slate-700 dark:text-slate-300 italic">"{p.feedback}"</p>
                              </div>
                              {p.goals && (
                                <div>
                                  <p className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-1">Goals Set</p>
                                  <p className="text-slate-700 dark:text-slate-300">{p.goals}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground text-sm italic border-2 border-dashed rounded-2xl">No performance reviews available for this employee.</div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT COLUMN - INSIGHTS & ASSETS (Spans 4 cols) */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* AI Insights Panel */}
            <Card className="rounded-3xl shadow-sm border-2 overflow-hidden border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-950">
              <CardHeader className="border-b border-indigo-100/50 dark:border-indigo-900/50 pb-4">
                <CardTitle className="text-lg font-black flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                  <Cpu className="size-5" /> AI Insights Panel
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-indigo-600/60 dark:text-indigo-400/60">Generated Summary</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  {performance.length > 0 ? (
                    <div className="flex gap-3">
                      <TrendingUp className="size-5 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Performance Overview</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Latest review rating is {performance[0].rating}/5. {performance[0].rating >= 4 ? "Strong candidate showing excellent progress." : "Consistent performance recorded."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">No Performance Data</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Employee has not received any performance reviews yet. Schedule a review to track progress.</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <CheckCircle2 className="size-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Leave Utilization</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Employee has taken {approvedLeaves} days of approved leave. Attendance tracking is {attendance.length > 0 ? "active" : "inactive or pending"}.
                      </p>
                    </div>
                  </div>
                </div>
                <Button className="w-full mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-2 font-bold shadow-lg shadow-indigo-200 dark:shadow-none">
                  <Sparkles className="size-4" /> Refresh Insights
                </Button>
              </CardContent>
            </Card>

            {/* Assets */}
            <Card className="rounded-3xl shadow-sm border-2 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-black flex items-center gap-2"><Laptop className="size-5 text-indigo-600" /> Assigned Assets</CardTitle>
                {isAdmin && selectedEmpId && (
                  <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 gap-1 rounded-lg">
                        <Plus className="size-3" /> Assign
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign Asset</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const obj = {
                          employee_id: selectedEmpId,
                          asset_name: fd.get("asset_name"),
                          asset_id: fd.get("asset_id"),
                          asset_type: fd.get("asset_type")
                        };
                        const { error } = await supabase.from("employee_assets" as any).insert(obj);
                        if (error) {
                          toast.error(error.message);
                        } else {
                          toast.success("Asset assigned successfully");
                          refetchAssets();
                          setIsAssetDialogOpen(false);
                        }
                      }} className="space-y-4 pt-4">
                        <div>
                          <Label>Asset Name</Label>
                          <Input name="asset_name" placeholder="e.g. MacBook Pro 16" required />
                        </div>
                        <div>
                          <Label>Asset ID / Serial No</Label>
                          <Input name="asset_id" placeholder="e.g. ASST-001" />
                        </div>
                        <div>
                          <Label>Asset Type</Label>
                          <Select name="asset_type" defaultValue="Laptop">
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Laptop">Laptop</SelectItem>
                              <SelectItem value="Monitor">Monitor</SelectItem>
                              <SelectItem value="Mobile">Mobile Device</SelectItem>
                              <SelectItem value="Access Card">Access Card</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <DialogFooter>
                          <Button type="submit" className="w-full">Assign Asset</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {assets.length > 0 ? (
                  <div className="divide-y">
                    {assets.map((asset: any) => (
                      <div key={asset.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <Laptop className="size-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white">{asset.asset_name}</p>
                            <p className="text-[10px] text-muted-foreground">{asset.asset_type} • ID: {asset.asset_id || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAdmin ? (
                            <Select 
                              defaultValue={asset.status} 
                              onValueChange={async (val) => {
                                const { error } = await supabase.from("employee_assets" as any).update({ status: val }).eq("id", asset.id);
                                if (error) toast.error(error.message);
                                else { toast.success("Status updated"); refetchAssets(); }
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs border-indigo-100 bg-indigo-50 text-indigo-700 w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="assigned">Assigned</SelectItem>
                                <SelectItem value="returned">Returned</SelectItem>
                                <SelectItem value="lost">Lost</SelectItem>
                                <SelectItem value="damaged">Damaged</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30">
                              {asset.status}
                            </Badge>
                          )}
                          
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={async () => {
                                if (!confirm("Remove this asset from the employee?")) return;
                                const { error } = await supabase.from("employee_assets" as any).delete().eq("id", asset.id);
                                if (error) toast.error(error.message);
                                else { toast.success("Asset removed"); refetchAssets(); }
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <Laptop className="size-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-sm font-bold">No Assets Assigned</p>
                    <p className="text-xs text-muted-foreground mt-1">There are currently no assets assigned to this employee.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            <Card className="rounded-3xl shadow-sm border-2 overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                <CardTitle className="text-lg font-black flex items-center gap-2"><FileText className="size-5 text-indigo-600" /> Documents</CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[300px] overflow-y-auto">
                {documents && documents.length > 0 ? (
                  <div className="divide-y">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="size-5 text-slate-400" />
                          <p className="font-bold text-sm truncate max-w-[150px]" title={doc.document_name || "Document"}>{doc.document_name || "Document"}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50" asChild>
                          <a href={doc.document_url} target="_blank" rel="noreferrer">View</a>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground text-sm italic">No documents uploaded.</div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      ) : null}
    </div>
  );
}
