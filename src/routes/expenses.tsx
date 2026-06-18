import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Receipt, Plus, Clock, CheckCircle2, XCircle, Wallet, FileText, IndianRupee, Upload, ExternalLink, Eye, Search, TrendingUp, Building2, X, Users as UsersIcon, ListFilter, LayoutGrid, Pencil, Trash2, Mail } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { cn } from "../lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
export const Route = createFileRoute("/expenses")({ component: () => <AppShell><ExpensesPage /></AppShell> });

const getEmailUrl = (email: string, employeeName: string, title: string, amount: number) => {
  const subject = encodeURIComponent(`Inquiry regarding your expense claim: ${title}`);
  const body = encodeURIComponent(`Hi ${employeeName},\n\nI have a question/doubt regarding your expense claim "${title}" of amount ₹${Number(amount).toLocaleString('en-IN')}.\n\nBest regards,\nHR SNGeneLab`);
  return `mailto:${email || ''}?subject=${subject}&body=${body}`;
};

function ExpensesPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isAuthorized = isAdmin || isManager;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"claims" | "employees">("employees");
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [reviewingClaim, setReviewingClaim] = useState<{ id: string, status: 'approved' | 'rejected' } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [editingClaim, setEditingClaim] = useState<any | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [deleteReceipt, setDeleteReceipt] = useState(false);
  const [selectedEditFile, setSelectedEditFile] = useState<File | null>(null);

  const startEditing = (claim: any) => {
    setEditingClaim(claim);
    setDeleteReceipt(false);
    setSelectedEditFile(null);
  };

  const closeEditing = () => {
    setEditingClaim(null);
    setDeleteReceipt(false);
    setSelectedEditFile(null);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const { myEmployee } = useMyEmployee();

  const { data: departmentEmployees = [] } = useQuery({
    queryKey: ["department-employees-expenses", myEmployee?.department],
    enabled: role === "manager" && !!myEmployee?.department,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id")
        .eq("department", myEmployee!.department);
      if (error) throw error;
      return data.map(e => e.id) || [];
    }
  });

  const { data: claims = [] as any[], isLoading } = useQuery({
    queryKey: ["expense-claims", role, myEmployee?.id, departmentEmployees],
    queryFn: async () => {
      let query = supabase.from("expense_claims" as any).select("*, employees(full_name, department, phone, email)").order("created_at", { ascending: false });

      if (role === "manager" && myEmployee) {
        if (departmentEmployees.length > 0) {
          query = query.in("employee_id", departmentEmployees);
        } else {
          query = query.eq("employee_id", myEmployee.id);
        }
      } else if (!isAdmin && myEmployee) {
        query = query.eq("employee_id", myEmployee.id);
      }

      const { data, error } = await query;
      if (error) return [];
      return data as any[];
    },
    enabled: !!user && (role === "admin" || !!myEmployee),
  });

  // Dynamically compute available months from claims
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    claims.forEach((c: any) => {
      if (c.created_at) {
        const date = new Date(c.created_at);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        months.add(`${year}-${month}`);
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [claims]);

  const formatMonthYear = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Filter claims by month for department spending and grouped employee views
  const groupedClaims = useMemo(() => {
    return claims.filter((c: any) => {
      if (monthFilter === "all") return true;
      if (!c.created_at) return false;
      const claimDate = new Date(c.created_at);
      const claimMonthYear = `${claimDate.getFullYear()}-${String(claimDate.getMonth() + 1).padStart(2, '0')}`;
      return claimMonthYear === monthFilter;
    });
  }, [claims, monthFilter]);

  // Grouping Logic (using month-filtered claims)
  const groupedData = useMemo(() => {
    const map: Record<string, any> = {};
    groupedClaims.forEach((c: any) => {
      const eid = c.employee_id;
      if (!map[eid]) {
        map[eid] = {
          id: eid,
          name: c.employees?.full_name || "Unknown",
          dept: c.employees?.department || "Other",
          total: 0,
          count: 0,
          pending: 0,
          latest: c.created_at
        };
      }
      map[eid].total += Number(c.amount);
      map[eid].count += 1;
      if (c.status === 'pending') map[eid].pending += 1;
      if (new Date(c.created_at) > new Date(map[eid].latest)) map[eid].latest = c.created_at;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [groupedClaims]);

  const deptData = useMemo(() => {
    const map: Record<string, number> = {};
    groupedClaims.forEach((c: any) => {
      if (c.status === 'rejected') return;
      const dept = c.employees?.department || "Other";
      map[dept] = (map[dept] ?? 0) + Number(c.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [groupedClaims]);

  const filteredClaims = claims.filter((c: any) => {
    const matchesSearch = c.employees?.full_name?.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || c.employees?.department === deptFilter;
    
    let matchesMonth = true;
    if (monthFilter !== "all" && c.created_at) {
      const claimDate = new Date(c.created_at);
      const claimMonthYear = `${claimDate.getFullYear()}-${String(claimDate.getMonth() + 1).padStart(2, '0')}`;
      matchesMonth = claimMonthYear === monthFilter;
    }
    
    return matchesSearch && matchesDept && matchesMonth;
  });

  const filteredGroups = groupedData.filter((g: any) => {
    const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || g.dept === deptFilter;
    return matchesSearch && matchesDept;
  });

  const empDetailData = useMemo(() => {
    if (!selectedEmpId) return null;
    const empClaims = claims.filter((c: any) => c.employee_id === selectedEmpId);
    const empFromClaim = empClaims[0]?.employees || {};
    const emp = {
      full_name: empFromClaim.full_name || "Employee",
      department: empFromClaim.department || "Unknown",
      phone: empFromClaim.phone || null,
      email: empFromClaim.email || null,
    };
    const total = empClaims.reduce((s: number, c: any) => s + Number(c.amount), 0);
    const approved = empClaims.filter((c: any) => c.status === 'approved').length;
    return { emp, claims: empClaims, total, approved };
  }, [selectedEmpId, claims]);

  const chartColors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f59e0b", "#10b981"];

  const submitClaim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!myEmployee) return toast.error("Profile not linked.");
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const file = fileRef.current?.files?.[0];
    let receiptUrl = null;

    try {
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${myEmployee.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("expense_receipts")
          .upload(fileName, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("expense_receipts").getPublicUrl(fileName);
        receiptUrl = publicUrl;
      }

      const { error: insertError } = await supabase.from("expense_claims" as any).insert({
        employee_id: myEmployee.id,
        title: fd.get("title"),
        amount: Number(fd.get("amount")),
        category: fd.get("category"),
        receipt_url: receiptUrl,
        notes: fd.get("notes") ? String(fd.get("notes")) : null,
        status: "pending"
      });

      if (insertError) throw insertError;

      // Notify HR/Admins
      try {
        const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
        if (admins && admins.length > 0) {
          const titleText = fd.get("title");
          const amountText = Number(fd.get("amount")).toLocaleString('en-IN');
          const notifications = admins.map(admin => ({
            user_id: admin.user_id,
            title: "New Expense Claim",
            message: `${myEmployee.full_name} submitted a claim: "${titleText}" for ₹${amountText}.`,
            is_read: false,
            link: "/expenses"
          }));
          await supabase.from("notifications" as any).insert(notifications);
        }
      } catch (notifErr) {
        console.error("Failed to create submission notification:", notifErr);
      }

      toast.success("Expense claim submitted successfully!");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["expense-claims"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit claim.");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (id: string, status: string, notes?: string) => {
    let claimantUserId = null;
    let claimTitle = "";
    try {
      const { data: claimData } = await supabase
        .from("expense_claims" as any)
        .select("title, employees(user_id)")
        .eq("id", id)
        .maybeSingle() as any;
      if (claimData) {
        claimTitle = claimData.title;
        claimantUserId = claimData.employees?.user_id;
      }
    } catch (fetchErr) {
      console.error("Failed to fetch claim details for notification:", fetchErr);
    }

    const { error } = await supabase.from("expense_claims" as any).update({
      status,
      admin_notes: notes || null
    }).eq("id", id);

    if (error) toast.error(error.message);
    else {
      toast.success(`Claim ${status} successfully.`);
      qc.invalidateQueries({ queryKey: ["expense-claims"] });

      // Notify employee
      if (claimantUserId) {
        try {
          await supabase.from("notifications" as any).insert({
            user_id: claimantUserId,
            title: `Expense Claim ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: `Your claim "${claimTitle}" was ${status}${notes ? ` (${notes})` : ""}.`,
            is_read: false,
            link: "/expenses"
          });
        } catch (notifErr) {
          console.error("Failed to create review notification:", notifErr);
        }
      }
    }
  };

  const editClaim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingClaim || !myEmployee) return;
    setEditBusy(true);
    const fd = new FormData(e.currentTarget);
    const file = selectedEditFile;
    let receiptUrl = deleteReceipt ? null : editingClaim.receipt_url;

    try {
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${myEmployee.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("expense_receipts")
          .upload(fileName, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("expense_receipts").getPublicUrl(fileName);
        receiptUrl = publicUrl;
      }

      const { error: updateError } = await supabase.from("expense_claims" as any).update({
        title: String(fd.get("title")),
        amount: Number(fd.get("amount")),
        category: String(fd.get("category")),
        notes: fd.get("notes") ? String(fd.get("notes")) : null,
        receipt_url: receiptUrl,
      }).eq("id", editingClaim.id).eq("employee_id", myEmployee.id);

      if (updateError) throw updateError;

      toast.success("Expense claim updated successfully!");
      closeEditing();
      qc.invalidateQueries({ queryKey: ["expense-claims"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update claim.");
    } finally {
      setEditBusy(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <IndianRupee className="size-5" />
            </div>
            <h1 className="font-display text-4xl font-black tracking-tight text-foreground">Expense Hub</h1>
          </div>
          <p className="text-muted-foreground font-medium">Consolidated financial operations and reimbursements.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-1.5 rounded-xl border-2 border-primary/5 w-full sm:w-auto">
            {isAuthorized && (
              <div className="flex p-1 bg-white/50 rounded-lg border border-primary/5 mr-1 sm:mr-2">
                <button
                  onClick={() => setViewMode("employees")}
                  className={cn("p-1.5 rounded-md transition-all", viewMode === "employees" ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/5")}
                  title="Group by Employee"
                >
                  <UsersIcon className="size-4" />
                </button>
                <button
                  onClick={() => setViewMode("claims")}
                  className={cn("p-1.5 rounded-md transition-all", viewMode === "claims" ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/5")}
                  title="Individual Claims"
                >
                  <ListFilter className="size-4" />
                </button>
              </div>
            )}
            <div className="relative flex-1 min-w-[120px] sm:w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9 w-full border-none bg-transparent focus-visible:ring-0 text-xs font-bold"
              />
            </div>

            {/* Month Filter */}
            {availableMonths.length > 0 && (
              <>
                <div className="h-6 w-[1px] bg-primary/10 hidden sm:block" />
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="h-10 border-none bg-transparent focus:ring-0 text-xs font-black uppercase tracking-widest flex-1 min-w-[100px] sm:w-[140px]">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Months</SelectItem>
                    {availableMonths.map((m) => (
                      <SelectItem key={m} value={m}>
                        {formatMonthYear(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {role === "admin" && (
              <>
                <div className="h-6 w-[1px] bg-primary/10 hidden sm:block" />
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger className="h-10 border-none bg-transparent focus:ring-0 text-xs font-black uppercase tracking-widest flex-1 min-w-[100px] sm:w-[140px]">
                    <SelectValue placeholder="Dept" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Depts</SelectItem>
                    {Array.from(new Set(claims.map((c: any) => c.employees?.department).filter(Boolean))).map((d: any) => (
                      <SelectItem key={d as string} value={d as string}>{d as string}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          {myEmployee && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="h-12 w-full sm:w-auto px-8 rounded-xl font-black gap-2 shadow-xl shadow-primary/20 hover:scale-105 transition-all shrink-0">
                  <Plus className="size-5" /> Submit Claim
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl p-0 border-2 border-primary/5 shadow-elegant max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 pb-4 shrink-0">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tight">Submit Expense Claim</DialogTitle>
                    <CardDescription>Enter details and attach your bill copy for approval.</CardDescription>
                  </DialogHeader>
                </div>
                <form onSubmit={submitClaim} className="flex flex-col flex-1 min-h-0">
                  <div className="overflow-y-auto flex-1 px-8 pb-2 space-y-5">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Expense Title</Label>
                      <Input name="title" placeholder="e.g. Client Dinner, Taxi to Airport" required className="h-12 rounded-xl border-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Amount (₹)</Label>
                        <Input name="amount" type="number" placeholder="0.00" required className="h-12 rounded-xl border-2" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</Label>
                        <Select name="category" required defaultValue="travel">
                          <SelectTrigger className="h-12 rounded-xl border-2"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="travel">Travel</SelectItem>
                            <SelectItem value="food">Food & Dining</SelectItem>
                            <SelectItem value="fuel">Fuel / Transport</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        Notes / Description <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
                      </Label>
                      <Textarea
                        name="notes"
                        placeholder="Describe the reason for this expense, e.g. client meeting, team lunch..."
                        className="rounded-xl border-2 min-h-[90px] resize-none"
                      />
                    </div>

                    <div className="space-y-2 pb-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Attach Receipt (Bill Copy)</Label>
                      <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group" onClick={() => fileRef.current?.click()}>
                        <input type="file" className="hidden" ref={fileRef} accept="image/*,application/pdf" />
                        <Upload className="size-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                        <p className="text-xs font-bold text-muted-foreground">Click to upload image or PDF</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1">Maximum size: 5MB</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-8 py-5 border-t border-border/40 bg-muted/10 shrink-0">
                    <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl font-black">
                      {busy ? "Submitting..." : "Submit for Approval"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isAuthorized && claims.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7 rounded-[2rem] border-2 border-primary/5 shadow-card p-8 bg-card relative overflow-hidden group">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-black text-xl tracking-tight flex items-center gap-2">
                  <Building2 className="size-5 text-indigo-500" /> Dept-wise Spending
                </h3>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Operational cost distribution</p>
              </div>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 800 }} width={100} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                    {deptData.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="lg:col-span-5 rounded-[2rem] border-2 border-primary/5 shadow-card p-8 bg-card relative overflow-hidden group">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-black text-xl tracking-tight flex items-center gap-2">
                  <TrendingUp className="size-5 text-teal-500" /> Top Claimants
                </h3>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Individual expense leadership</p>
              </div>
            </div>
            <div className="space-y-4">
              {groupedData.slice(0, 5).map((emp, i) => (
                <div key={emp.id} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 group/item hover:bg-primary/5 transition-all cursor-pointer" onClick={() => setSelectedEmpId(emp.id)}>
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-primary text-xs border border-primary/5">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-black tracking-tight">{emp.name}</p>
                      <div className="h-1.5 w-24 bg-muted rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${(emp.total / (groupedData[0]?.total || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <span className="font-black text-foreground">₹{emp.total.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard icon={Wallet} label="Net Spending Volume" value={`₹${(viewMode === 'employees' ? filteredGroups : filteredClaims).reduce((s: number, c: any) => s + Number(c.total || c.amount), 0).toLocaleString('en-IN')}`} color="bg-indigo-500" />
        <StatCard icon={CheckCircle2} label="Approved Assets" value={`₹${claims.filter((c: any) => c.status === 'approved').reduce((s: number, c: any) => s + Number(c.amount), 0).toLocaleString('en-IN')}`} color="bg-teal-500" />
        <StatCard icon={Clock} label="Action Required" value={claims.filter((c: any) => c.status === 'pending').length} color="bg-amber-500" />
      </div>

      <Dialog open={!!selectedEmpId} onOpenChange={(v) => !v && setSelectedEmpId(null)}>
        <DialogContent className="max-w-5xl w-[95vw] md:w-full rounded-[2rem] md:rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-slate-50 dark:bg-slate-950">
          {empDetailData && (
            <div className="flex flex-col h-[85vh]">
              <div className="bg-white dark:bg-slate-900 p-4 md:p-8 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 md:gap-5">
                    <div className="size-12 md:size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/5 shrink-0">
                      <UsersIcon className="size-6 md:size-8" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-3xl font-black tracking-tight">{empDetailData.emp.full_name}</h2>
                      <p className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] text-muted-foreground">{empDetailData.emp.department} • Financial Ledger</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest">Aggregate Claim Value</p>
                    <p className="text-2xl md:text-3xl font-black text-foreground">₹{empDetailData.total.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                  <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Submission Count</p>
                    <p className="text-lg md:text-2xl font-black">{empDetailData.claims.length} Documents</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Mean Claim Value</p>
                    <p className="text-lg md:text-2xl font-black">₹{Math.round(empDetailData.total / (empDetailData.claims.length || 1)).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <p className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Governance Performance</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="size-2.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-xs font-bold">{empDetailData.approved} Approved Claims</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black text-base md:text-lg tracking-tight uppercase">Consolidated Claim History</h3>
                  
                  {/* Desktop View Table */}
                  <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                        <TableRow>
                          <TableHead className="pl-6 font-black uppercase text-[9px] tracking-widest">Entry Details</TableHead>
                          <TableHead className="font-black uppercase text-[9px] tracking-widest">Category</TableHead>
                          <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Status</TableHead>
                          <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Value</TableHead>
                          <TableHead className="font-black uppercase text-[9px] tracking-widest text-right pr-6">Proof / Contact</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {empDetailData.claims.map((c: any) => (
                          <TableRow key={c.id} className="hover:bg-primary/5 transition-colors">
                            <TableCell className="pl-6">
                              <p className="font-bold text-sm">{c.title}</p>
                              {c.notes && (
                                <p className="text-xs text-muted-foreground bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/30 px-2.5 py-1 rounded-lg mt-1 w-fit max-w-[250px] font-medium leading-relaxed text-left">
                                  <span className="font-black text-[9px] uppercase tracking-wider text-amber-600 block mb-0.5">Note:</span>
                                  {c.notes}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground/50 mt-1.5 font-bold">{new Date(c.created_at).toLocaleDateString()}</p>
                            </TableCell>
                            <TableCell>
                              <span className="px-2 py-0.5 rounded-lg bg-muted text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                {c.category}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                                  c.status === 'approved' ? "bg-green-100 text-green-700" :
                                    c.status === 'rejected' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                                  )}>
                                  {c.status}
                                </span>
                                {c.admin_notes && (
                                  <p className="text-[8px] font-bold text-muted-foreground italic mt-1 max-w-[100px] truncate" title={c.admin_notes}>
                                    "{c.admin_notes}"
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-black">₹{Number(c.amount).toLocaleString('en-IN')}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end items-center gap-1.5">
                                {myEmployee && c.employee_id === myEmployee.id && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-8 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600"
                                    title="Edit Claim"
                                    onClick={() => startEditing(c)}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                )}
                                {c.receipt_url && (
                                  <Button size="icon" variant="ghost" className="size-8 rounded-lg text-primary hover:bg-primary/10" asChild title="View Bill Copy">
                                    <a href={c.receipt_url} target="_blank" rel="noreferrer"><Eye className="size-4" /></a>
                                  </Button>
                                )}
                                {c.notes ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button size="icon" variant="ghost" className="size-8 rounded-lg text-amber-500 hover:bg-amber-50 hover:text-amber-600" title="View Employee Notes">
                                        <FileText className="size-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-4 rounded-xl border-2 border-primary/5 shadow-md">
                                      <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Employee Notes</p>
                                        <p className="text-xs text-foreground leading-relaxed break-words font-medium text-left">{c.notes}</p>
                                      </div>
                                    </PopoverContent>
</Popover>
                                ) : (
                                  <Button size="icon" variant="ghost" className="size-8 rounded-lg text-muted-foreground/30 cursor-not-allowed" disabled title="No notes provided">
                                    <FileText className="size-4" />
                                  </Button>
                                )}

                                {isAuthorized && (
                                  c.employees?.email || empDetailData.emp.email ? (
                                    <Button size="icon" variant="ghost" className="size-8 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600" asChild>
                                      <a href={getEmailUrl(c.employees?.email || empDetailData.emp.email, c.employees?.full_name || empDetailData.emp.full_name || "Employee", c.title, c.amount)} title="Send Email">
                                        <Mail className="size-4" />
                                      </a>
                                    </Button>
                                  ) : (
                                    <Button size="icon" variant="ghost" className="size-8 rounded-lg text-muted-foreground/30 cursor-not-allowed" disabled title="No email address provided">
                                      <Mail className="size-4" />
                                    </Button>
                                  )
                                )}

                                {(isAdmin || (role === "manager" && c.employee_id !== myEmployee?.id)) && c.status === 'pending' && (
                                  <>
                                    <Button size="icon" variant="ghost" className="size-8 rounded-lg text-green-600 hover:bg-green-100" onClick={() => setReviewingClaim({ id: c.id, status: 'approved' })} title="Approve">
                                      <CheckCircle2 className="size-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="size-8 rounded-lg text-rose-600 hover:bg-rose-100" onClick={() => setReviewingClaim({ id: c.id, status: 'rejected' })} title="Reject">
                                      <XCircle className="size-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile View Stacked Cards */}
                  <div className="md:hidden space-y-4">
                    {empDetailData.claims.map((c: any) => (
                      <div key={c.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                        {/* Header: Title & Value */}
                        <div className="flex justify-between items-start gap-2">
                          <div className="text-left">
                            <h4 className="font-bold text-sm text-foreground">{c.title}</h4>
                            <span className="text-[10px] font-bold text-muted-foreground/50">{new Date(c.created_at).toLocaleDateString()}</span>
                          </div>
                          <span className="font-black text-sm text-foreground shrink-0">₹{Number(c.amount).toLocaleString('en-IN')}</span>
                        </div>

                        {/* Category & Status */}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="px-2 py-0.5 rounded-lg bg-muted text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                            {c.category}
                          </span>
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                              c.status === 'approved' ? "bg-green-100 text-green-700" :
                                c.status === 'rejected' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {c.status}
                            </span>
                            {c.admin_notes && (
                              <p className="text-[8px] font-bold text-muted-foreground italic mt-0.5 max-w-[150px] truncate" title={c.admin_notes}>
                                "{c.admin_notes}"
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Notes if present */}
                        {c.notes && (
                          <p className="text-xs text-muted-foreground bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/30 px-2.5 py-1.5 rounded-lg mt-1 w-full font-medium leading-relaxed">
                            <span className="font-black text-[9px] uppercase tracking-wider text-amber-600 block mb-0.5">Note:</span>
                            {c.notes}
                          </p>
                        )}

                        {/* Actions Row */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/30">
                          {/* View Proof & Contact */}
                          <div className="flex items-center gap-1.5">
                            {myEmployee && c.employee_id === myEmployee.id && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600"
                                title="Edit Claim"
                                onClick={() => startEditing(c)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            )}
                            {c.receipt_url ? (
                              <Button size="icon" variant="ghost" className="size-8 rounded-lg text-primary hover:bg-primary/10" asChild title="View Bill Copy">
                                <a href={c.receipt_url} target="_blank" rel="noreferrer"><Eye className="size-4" /></a>
                              </Button>
                            ) : (
                              <span className="text-[9px] font-black text-muted-foreground/30 uppercase">No Bill</span>
                            )}
                            {isAuthorized && (c.employees?.email || empDetailData.emp.email) && (
                              <Button size="icon" variant="ghost" className="size-8 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600" asChild>
                                <a href={getEmailUrl(c.employees?.email || empDetailData.emp.email, c.employees?.full_name || empDetailData.emp.full_name || "Employee", c.title, c.amount)} title="Send Email">
                                  <Mail className="size-4" />
                                </a>
                              </Button>
                            )}
                          </div>

                          {/* Approve / Reject Actions */}
                          {isAuthorized && c.status === 'pending' && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {role === "manager" && c.employee_id === myEmployee?.id ? (
                                <span className="text-[9px] font-bold text-muted-foreground/50 uppercase">Self Claim</span>
                              ) : (
                                <>
                                  <Button size="icon" variant="outline" className="size-8 rounded-lg border-green-200 text-green-700 hover:bg-green-50" onClick={() => setReviewingClaim({ id: c.id, status: 'approved' })} title="Approve">
                                    <CheckCircle2 className="size-4 text-green-600" />
                                  </Button>
                                  <Button size="icon" variant="outline" className="size-8 rounded-lg border-red-200 text-red-700 hover:bg-red-50" onClick={() => setReviewingClaim({ id: c.id, status: 'rejected' })} title="Reject">
                                    <XCircle className="size-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="rounded-[2.5rem] border-2 border-primary/5 shadow-card overflow-hidden">
        {/* Desktop View - Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableRow>
                {viewMode === "employees" ? (
                  <>
                    <TableHead className="pl-8 font-black uppercase text-[10px] tracking-widest">Employee Profile</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Department</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Active Claims</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right">Latest Entry</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-8">Total Expenditure</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="pl-8 font-black uppercase text-[10px] tracking-widest">Expense Details</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Employee</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Category</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-8">Amount</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-8">Proof / Contact</TableHead>
                    {isAuthorized && <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-8">Actions</TableHead>}
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={7} className="h-16 bg-muted/10" />
                  </TableRow>
                ))
              ) : viewMode === "employees" ? (
                filteredGroups.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-20 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">No profiles found</TableCell></TableRow>
                ) : filteredGroups.map((g: any) => (
                  <TableRow key={g.id} className="group hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => setSelectedEmpId(g.id)}>
                    <TableCell className="pl-8">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                          <UsersIcon className="size-5" />
                        </div>
                        <span className="font-black text-sm text-foreground">{g.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{g.dept}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-black text-sm">{g.count} claims</span>
                        {g.pending > 0 && <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">{g.pending} Pending</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-[11px] font-bold text-muted-foreground">{new Date(g.latest).toLocaleDateString()}</span>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <span className="font-black text-base text-foreground">₹{g.total.toLocaleString('en-IN')}</span>
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredClaims.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-20 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">No matching claims found</TableCell></TableRow>
              ) : filteredClaims.map((c: any) => (
                <TableRow key={c.id} className="group hover:bg-primary/5 transition-colors">
                  <TableCell className="pl-8">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                        <Receipt className="size-5" />
                      </div>
                      <div className="flex flex-col gap-0.5 text-left">
                        <span className="font-black text-sm text-foreground">{c.title}</span>
                        {c.notes && (
                          <span className="text-xs text-muted-foreground bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/30 px-2 py-0.5 rounded-lg mt-0.5 w-fit max-w-[250px] font-medium leading-relaxed">
                            <span className="font-black text-[9px] uppercase tracking-wider text-amber-600 mr-1">Note:</span>
                            {c.notes}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-muted-foreground/50 mt-0.5">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setSelectedEmpId(c.employee_id)}
                      className="flex flex-col text-left group/emp hover:translate-x-1 transition-transform"
                    >
                      <span className="font-bold text-sm text-foreground group-hover/emp:text-primary transition-colors underline decoration-primary/0 group-hover/emp:decoration-primary/30 underline-offset-4">{c.employees?.full_name}</span>
                      <span className="text-[10px] font-black text-muted-foreground uppercase">{c.employees?.department}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded-lg bg-muted text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      {c.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-tighter",
                        c.status === 'approved' ? "bg-green-100 text-green-700" :
                          c.status === 'rejected' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {c.status === 'approved' ? <CheckCircle2 className="size-3 mr-1.5" /> :
                          c.status === 'rejected' ? <XCircle className="size-3 mr-1.5" /> : <Clock className="size-3 mr-1.5" />}
                        {c.status}
                      </span>
                      {c.admin_notes && (
                        <p className="text-[9px] font-bold text-muted-foreground italic max-w-[120px] truncate" title={c.admin_notes}>
                          "{c.admin_notes}"
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <span className="font-black text-foreground">₹{Number(c.amount).toLocaleString('en-IN')}</span>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex justify-end items-center gap-1.5">
                      {/* Edit — always for own claims */}
                      {myEmployee && c.employee_id === myEmployee.id && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600"
                          title="Edit Claim"
                          onClick={() => startEditing(c)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}

                      {c.receipt_url ? (
                        <Button size="icon" variant="ghost" className="size-8 rounded-lg text-primary hover:bg-primary/10" asChild title="View Bill Copy">
                          <a href={c.receipt_url} target="_blank" rel="noreferrer"><Eye className="size-4" /></a>
                        </Button>
                      ) : (
                        <span className="text-[10px] font-black text-muted-foreground/30 uppercase mr-1">No Bill</span>
                      )}

                      {c.notes ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="icon" variant="ghost" className="size-8 rounded-lg text-amber-500 hover:bg-amber-50 hover:text-amber-600" title="View Employee Notes">
                              <FileText className="size-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-4 rounded-xl border-2 border-primary/5 shadow-md">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Employee Notes</p>
                              <p className="text-xs text-foreground leading-relaxed break-words font-medium text-left">{c.notes}</p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Button size="icon" variant="ghost" className="size-8 rounded-lg text-muted-foreground/30 cursor-not-allowed" disabled title="No notes provided">
                          <FileText className="size-4" />
                        </Button>
                      )}                      {isAuthorized && (
                        c.employees?.email ? (
                          <Button size="icon" variant="ghost" className="size-8 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600" asChild>
                            <a href={getEmailUrl(c.employees.email, c.employees.full_name || "Employee", c.title, c.amount)} title="Send Email">
                              <Mail className="size-4" />
                            </a>
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" className="size-8 rounded-lg text-muted-foreground/30 cursor-not-allowed" disabled title="No email address provided">
                            <Mail className="size-4" />
                          </Button>
                        )
                      )}
                    </div>
                  </TableCell>
                  {isAuthorized && (
                    <TableCell className="text-right pr-8">
                      <div className="flex justify-end gap-2">
                        {c.status === 'pending' && (
                          role === "manager" && c.employee_id === myEmployee?.id ? (
                            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase">Self Claim</span>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" className="size-8 rounded-lg text-green-600 hover:bg-green-100" onClick={() => setReviewingClaim({ id: c.id, status: 'approved' })} title="Approve">
                                <CheckCircle2 className="size-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-8 rounded-lg text-rose-600 hover:bg-rose-100" onClick={() => setReviewingClaim({ id: c.id, status: 'rejected' })} title="Reject">
                                <XCircle className="size-4" />
                              </Button>
                            </>
                          )
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View - Groups & Claims Lists */}
        {isLoading ? (
          <div className="md:hidden p-10 text-center animate-pulse font-black text-primary">Loading records...</div>
        ) : (
          <>
            {/* Mobile View - Employees Group List */}
            {viewMode === "employees" && (
              <div className="md:hidden divide-y divide-primary/5">
                {filteredGroups.length === 0 ? (
                  <div className="py-20 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">No profiles found</div>
                ) : filteredGroups.map((g: any) => (
                  <div key={g.id} className="p-4 space-y-3 cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => setSelectedEmpId(g.id)}>
                    {/* Header: Avatar, Name & Department */}
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                        <UsersIcon className="size-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{g.name}</h4>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{g.dept}</p>
                      </div>
                    </div>

                    {/* Stats & Latest Claim */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800/30">
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Active Claims</span>
                        <span className="font-bold text-foreground block mt-0.5">{g.count} claims</span>
                        {g.pending > 0 && <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-500/10 text-amber-500 uppercase tracking-tighter mt-1">{g.pending} Pending</span>}
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Latest Entry</span>
                        <span className="font-medium text-foreground block mt-0.5">{new Date(g.latest).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Total Expenditure */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/30 flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Expenditure</span>
                      <span className="font-black text-base text-foreground">₹{g.total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mobile View - Individual Claims List */}
            {viewMode === "claims" && (
              <div className="md:hidden divide-y divide-primary/5">
                {filteredClaims.length === 0 ? (
                  <div className="py-20 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">No matching claims found</div>
                ) : filteredClaims.map((c: any) => (
                  <div key={c.id} className="p-4 space-y-3">
                    {/* Header: Title & Category */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                          <Receipt className="size-5" />
                        </div>
                        <div className="text-left">
                          <h4 className="font-bold text-sm text-foreground">{c.title}</h4>
                          <span className="text-[10px] font-bold text-muted-foreground/50">{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-muted text-[9px] font-black uppercase tracking-widest text-muted-foreground shrink-0">
                        {c.category}
                      </span>
                    </div>

                    {/* Notes if present */}
                    {c.notes && (
                      <p className="text-xs text-muted-foreground bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/30 px-2.5 py-1.5 rounded-lg mt-1 w-full font-medium leading-relaxed">
                        <span className="font-black text-[9px] uppercase tracking-wider text-amber-600 block mb-0.5">Note:</span>
                        {c.notes}
                      </p>
                    )}

                    {/* Employee Profile and Amount */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/30">
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Employee</span>
                        <button
                          onClick={() => setSelectedEmpId(c.employee_id)}
                          className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 text-left block hover:text-primary transition-colors underline underline-offset-2"
                        >
                          {c.employees?.full_name}
                          <span className="text-[9px] font-black text-muted-foreground block uppercase mt-0.5">{c.employees?.department}</span>
                        </button>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Claim Value</span>
                        <span className="font-black text-sm text-foreground block mt-0.5">₹{Number(c.amount).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Status & Proof Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/30">
                      <div className="flex flex-col items-start gap-1">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-tighter",
                          c.status === 'approved' ? "bg-green-100 text-green-700" :
                            c.status === 'rejected' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {c.status}
                        </span>
                        {c.admin_notes && (
                          <p className="text-[8px] font-bold text-muted-foreground italic max-w-[120px] truncate" title={c.admin_notes}>
                            "{c.admin_notes}"
                          </p>
                        )}
                      </div>

                      {/* Contact & Proof Links */}
                      <div className="flex items-center gap-1.5">
                        {myEmployee && c.employee_id === myEmployee.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600"
                            title="Edit Claim"
                            onClick={() => startEditing(c)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {c.receipt_url ? (
                          <Button size="icon" variant="ghost" className="size-8 rounded-lg text-primary hover:bg-primary/10" asChild title="View Bill Copy">
                            <a href={c.receipt_url} target="_blank" rel="noreferrer"><Eye className="size-4" /></a>
                          </Button>
                        ) : (
                          <span className="text-[10px] font-black text-muted-foreground/30 uppercase mr-1">No Bill</span>
                        )}
                        {isAuthorized && c.employees?.email && (
                          <Button size="icon" variant="ghost" className="size-8 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600" asChild>
                            <a href={getEmailUrl(c.employees.email, c.employees.full_name || "Employee", c.title, c.amount)} title="Send Email">
                              <Mail className="size-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Inline approval actions for managers/admins */}
                    {isAuthorized && c.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/30 w-full">
                        {role === "manager" && c.employee_id === myEmployee?.id ? (
                          <span className="text-[10px] font-bold text-muted-foreground/50 uppercase block text-center w-full">Self Claim</span>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" className="flex-1 border-green-200 text-green-700 hover:bg-green-50 rounded-xl h-9 text-xs" onClick={() => setReviewingClaim({ id: c.id, status: 'approved' })}>
                              <CheckCircle2 className="size-4 mr-1 text-green-600" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-700 hover:bg-red-50 rounded-xl h-9 text-xs" onClick={() => setReviewingClaim({ id: c.id, status: 'rejected' })}>
                              <XCircle className="size-4 mr-1 text-red-600" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <Dialog open={!!reviewingClaim} onOpenChange={(v) => !v && setReviewingClaim(null)}>
        <DialogContent className="rounded-3xl p-8 border-2 border-primary/5 shadow-elegant max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              {reviewingClaim?.status === 'approved' ? "Approve Expense" : "Reject Expense"}
            </DialogTitle>
            <CardDescription>
              Add an optional comment for the employee to see.
            </CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Admin Comment / Clarification</Label>
              <Input
                placeholder="e.g. Please provide GST bill copy..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="h-12 rounded-xl border-2"
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setReviewingClaim(null)}>Cancel</Button>
            <Button
              className={cn("rounded-xl font-black px-8", reviewingClaim?.status === 'approved' ? "bg-green-600 hover:bg-green-700" : "bg-rose-600 hover:bg-rose-700")}
              onClick={() => {
                if (reviewingClaim) {
                  updateStatus(reviewingClaim.id, reviewingClaim.status, reviewNote);
                  setReviewingClaim(null);
                  setReviewNote("");
                }
              }}
            >
              Confirm {reviewingClaim?.status}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Claim Dialog */}
      <Dialog open={!!editingClaim} onOpenChange={(v) => !v && closeEditing()}>
        <DialogContent className="rounded-3xl p-0 border-2 border-primary/5 shadow-elegant max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-8 pb-4 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Pencil className="size-5 text-indigo-500" /> Edit Expense Claim
              </DialogTitle>
              <CardDescription>Update your claim details. Only pending claims can be edited.</CardDescription>
            </DialogHeader>
          </div>
          {editingClaim && (
            <form onSubmit={editClaim} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto flex-1 px-8 pb-2 space-y-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Expense Title</Label>
                  <Input name="title" defaultValue={editingClaim.title} required className="h-12 rounded-xl border-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Amount (₹)</Label>
                    <Input name="amount" type="number" defaultValue={editingClaim.amount} required className="h-12 rounded-xl border-2" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Category</Label>
                    <Select name="category" defaultValue={editingClaim.category || "travel"} required>
                      <SelectTrigger className="h-12 rounded-xl border-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="food">Food & Dining</SelectItem>
                        <SelectItem value="fuel">Fuel / Transport</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    Notes / Description <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
                  </Label>
                  <Textarea
                    name="notes"
                    defaultValue={editingClaim.notes || ""}
                    placeholder="Describe the reason for this expense..."
                    className="rounded-xl border-2 min-h-[90px] resize-none"
                  />
                </div>
                <div className="space-y-2 pb-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Replace / Remove Bill</Label>
                  
                  {editingClaim.receipt_url && !deleteReceipt && !selectedEditFile && (
                    <div className="flex items-center gap-2 mb-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                      <Eye className="size-4 text-primary shrink-0" />
                      <span className="text-xs font-bold text-foreground flex-1 truncate">Current bill attached</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <a href={editingClaim.receipt_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline mr-1">View</a>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          className="h-6 px-2 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 rounded-md" 
                          onClick={() => setDeleteReceipt(true)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}

                  {deleteReceipt && !selectedEditFile && (
                    <div className="flex items-center gap-2 mb-2 p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/30">
                      <Trash2 className="size-4 text-rose-500 shrink-0" />
                      <span className="text-xs font-bold text-rose-600 flex-1">Bill marked for removal</span>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        className="h-6 px-2 text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary/5 rounded-md" 
                        onClick={() => setDeleteReceipt(false)}
                      >
                        Undo
                      </Button>
                    </div>
                  )}

                  {selectedEditFile && (
                    <div className="flex items-center gap-2 mb-2 p-3 rounded-xl bg-green-50/50 dark:bg-green-950/10 border border-green-100/30">
                      <FileText className="size-4 text-green-600 shrink-0" />
                      <span className="text-xs font-bold text-foreground flex-1 truncate">{selectedEditFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 rounded-md shrink-0"
                        onClick={() => {
                          setSelectedEditFile(null);
                          if (editFileRef.current) editFileRef.current.value = "";
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-5 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group" onClick={() => editFileRef.current?.click()}>
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={editFileRef} 
                      accept="image/*,application/pdf" 
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedEditFile(file);
                        if (file) setDeleteReceipt(false);
                      }}
                    />
                    <Upload className="size-7 text-muted-foreground group-hover:text-primary transition-colors mb-1.5" />
                    <p className="text-xs font-bold text-muted-foreground">Click to upload new bill (replaces current)</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">Image or PDF, max 5MB</p>
                  </div>
                </div>
              </div>
              <div className="px-8 py-5 border-t border-border/40 bg-muted/10 shrink-0 flex gap-3">
                <Button type="button" variant="ghost" className="flex-1 h-12 rounded-xl font-bold" onClick={closeEditing}>Cancel</Button>
                <Button type="submit" disabled={editBusy} className="flex-1 h-12 rounded-xl font-black bg-indigo-600 hover:bg-indigo-700">
                  {editBusy ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border bg-card p-8 shadow-card transition-all hover:shadow-elegant group">
      <div className={cn("absolute -right-4 -top-4 size-32 rounded-full opacity-10 transition-transform group-hover:scale-110", color)} />
      <div className="flex items-center gap-6">
        <div className={cn("inline-flex size-16 items-center justify-center rounded-2xl shadow-inner", color, "bg-opacity-10")}>
          <Icon className={cn("size-8", color.replace('bg-', 'text-'))} />
        </div>
        <div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
          <p className="mt-1 font-display text-4xl font-black tracking-tighter text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}
