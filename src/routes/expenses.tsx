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
import { Receipt, Plus, Clock, CheckCircle2, XCircle, Wallet, FileText, IndianRupee, Upload, ExternalLink, Eye, Search, TrendingUp, Building2, X, Users as UsersIcon, ListFilter, LayoutGrid } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { cn } from "../lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export const Route = createFileRoute("/expenses")({ component: () => <AppShell><ExpensesPage /></AppShell> });

function ExpensesPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"claims" | "employees">("employees");
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [reviewingClaim, setReviewingClaim] = useState<{id: string, status: 'approved' | 'rejected'} | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { myEmployee } = useMyEmployee();

  const { data: claims = [] as any[], isLoading } = useQuery({
    queryKey: ["expense-claims", role, myEmployee?.id],
    queryFn: async () => {
      let q = supabase.from("expense_claims" as any).select("*, employees(full_name, department)").order("created_at", { ascending: false });
      if (!isAdmin && myEmployee) q = q.eq("employee_id", myEmployee.id);
      const { data, error } = await q;
      if (error) return [];
      return data as any[];
    },
    enabled: !!user && (isAdmin || !!myEmployee),
  });

  // Grouping Logic
  const groupedData = useMemo(() => {
    const map: Record<string, any> = {};
    claims.forEach((c: any) => {
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
    return Object.values(map).sort((a,b) => b.total - a.total);
  }, [claims]);

  const deptData = useMemo(() => {
    const map: Record<string, number> = {};
    claims.forEach((c: any) => {
      if (c.status === 'rejected') return;
      const dept = c.employees?.department || "Other";
      map[dept] = (map[dept] ?? 0) + Number(c.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [claims]);

  const filteredClaims = claims.filter((c: any) => {
    const matchesSearch = c.employees?.full_name?.toLowerCase().includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || c.employees?.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const filteredGroups = groupedData.filter((g: any) => {
    const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || g.dept === deptFilter;
    return matchesSearch && matchesDept;
  });

  const empDetailData = useMemo(() => {
    if (!selectedEmpId) return null;
    const empClaims = claims.filter((c: any) => c.employee_id === selectedEmpId);
    const emp = empClaims[0]?.employees || { full_name: "Employee", department: "Unknown" };
    const total = empClaims.reduce((s: number, c: any) => s + Number(c.amount), 0);
    const approved = empClaims.filter((c:any) => c.status === 'approved').length;
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
        status: "pending"
      });

      if (insertError) throw insertError;
      
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
    const { error } = await supabase.from("expense_claims" as any).update({ 
      status,
      admin_notes: notes || null 
    }).eq("id", id);
    
    if (error) toast.error(error.message);
    else {
      toast.success(`Claim ${status} successfully.`);
      qc.invalidateQueries({ queryKey: ["expense-claims"] });
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
        
        <div className="flex items-center gap-3">
           {isAdmin && (
             <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-xl border-2 border-primary/5">
                <div className="flex p-1 bg-white/50 rounded-lg border border-primary/5 mr-2">
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
                <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                   <Input 
                      placeholder="Search..." 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-10 pl-9 w-[180px] border-none bg-transparent focus-visible:ring-0 text-xs font-bold"
                   />
                </div>
                <div className="h-6 w-[1px] bg-primary/10" />
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                   <SelectTrigger className="h-10 border-none bg-transparent focus:ring-0 text-xs font-black uppercase tracking-widest w-[140px]">
                      <SelectValue placeholder="Dept" />
                   </SelectTrigger>
                   <SelectContent className="rounded-xl">
                      <SelectItem value="all">All Depts</SelectItem>
                      {Array.from(new Set(claims.map((c: any) => c.employees?.department).filter(Boolean))).map((d: any) => (
                        <SelectItem key={d as string} value={d as string}>{d as string}</SelectItem>
                      ))}
                   </SelectContent>
                </Select>
             </div>
           )}
           {!isAdmin && (
             <Dialog open={open} onOpenChange={setOpen}>
               <DialogTrigger asChild>
                 <Button className="h-12 px-8 rounded-xl font-black gap-2 shadow-xl shadow-primary/20 hover:scale-105 transition-all">
                   <Plus className="size-5" /> Submit Claim
                 </Button>
               </DialogTrigger>
               <DialogContent className="rounded-3xl p-8 border-2 border-primary/5 shadow-elegant max-w-xl">
                 <DialogHeader>
                   <DialogTitle className="text-2xl font-black tracking-tight">Submit Expense Claim</DialogTitle>
                   <CardDescription>Enter details and attach your bill copy for approval.</CardDescription>
                 </DialogHeader>
                 <form onSubmit={submitClaim} className="space-y-6 mt-6">
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
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Attach Receipt (Bill Copy)</Label>
                      <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group" onClick={() => fileRef.current?.click()}>
                         <input type="file" className="hidden" ref={fileRef} accept="image/*,application/pdf" />
                         <Upload className="size-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                         <p className="text-xs font-bold text-muted-foreground">Click to upload image or PDF</p>
                         <p className="text-[10px] text-muted-foreground/50 mt-1">Maximum size: 5MB</p>
                      </div>
                   </div>

                   <DialogFooter className="pt-6">
                      <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl font-black">{busy ? "Submitting..." : "Submit for Approval"}</Button>
                   </DialogFooter>
                 </form>
               </DialogContent>
             </Dialog>
           )}
        </div>
      </div>

      {isAdmin && claims.length > 0 && (
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
        <DialogContent className="max-w-5xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-slate-50 dark:bg-slate-950">
           {empDetailData && (
             <div className="flex flex-col h-[85vh]">
                <div className="bg-white dark:bg-slate-900 p-8 border-b border-slate-200 dark:border-slate-800">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-5">
                         <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/5">
                            <UsersIcon className="size-8" />
                         </div>
                         <div>
                            <h2 className="text-3xl font-black tracking-tight">{empDetailData.emp.full_name}</h2>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">{empDetailData.emp.department} • Financial Ledger</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Aggregate Claim Value</p>
                         <p className="text-3xl font-black text-foreground">₹{empDetailData.total.toLocaleString('en-IN')}</p>
                      </div>
                   </div>
                </div>

                <div className="flex-1 overflow-auto p-8 space-y-8">
                   <div className="grid grid-cols-3 gap-6">
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                         <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Submission Count</p>
                         <p className="text-2xl font-black">{empDetailData.claims.length} Documents</p>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                         <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Mean Claim Value</p>
                         <p className="text-2xl font-black">₹{Math.round(empDetailData.total / (empDetailData.claims.length || 1)).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                         <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Governance Performance</p>
                         <div className="flex items-center gap-2 mt-1">
                            <div className="size-3 rounded-full bg-green-500" />
                            <span className="text-xs font-bold">{empDetailData.approved} Approved Claims</span>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <h3 className="font-black text-lg tracking-tight uppercase">Consolidated Claim History</h3>
                      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                         <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                               <TableRow>
                                  <TableHead className="pl-6 font-black uppercase text-[9px] tracking-widest">Entry Details</TableHead>
                                  <TableHead className="font-black uppercase text-[9px] tracking-widest">Category</TableHead>
                                  <TableHead className="font-black uppercase text-[9px] tracking-widest text-center">Status</TableHead>
                                  <TableHead className="font-black uppercase text-[9px] tracking-widest text-right">Value</TableHead>
                                  <TableHead className="font-black uppercase text-[9px] tracking-widest text-right pr-6">Proof</TableHead>
                               </TableRow>
                            </TableHeader>
                            <TableBody>
                               {empDetailData.claims.map((c: any) => (
                                 <TableRow key={c.id} className="hover:bg-primary/5 transition-colors">
                                    <TableCell className="pl-6">
                                       <p className="font-bold text-sm">{c.title}</p>
                                       <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
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
                                       <div className="flex justify-end gap-2">
                                          {c.receipt_url && (
                                            <Button size="icon" variant="ghost" className="size-8 rounded-lg text-primary hover:bg-primary/10" asChild>
                                               <a href={c.receipt_url} target="_blank" rel="noreferrer"><Eye className="size-4" /></a>
                                            </Button>
                                          )}
                                          {isAdmin && c.status === 'pending' && (
                                            <>
                                              <Button size="icon" variant="ghost" className="size-8 rounded-lg text-green-600 hover:bg-green-100" onClick={() => setReviewingClaim({id: c.id, status: 'approved'})}>
                                                <CheckCircle2 className="size-4" />
                                              </Button>
                                              <Button size="icon" variant="ghost" className="size-8 rounded-lg text-rose-600 hover:bg-rose-100" onClick={() => setReviewingClaim({id: c.id, status: 'rejected'})}>
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
                   </div>
                </div>
             </div>
           )}
        </DialogContent>
      </Dialog>

      <Card className="rounded-[2.5rem] border-2 border-primary/5 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
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
                    <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-8">Receipt</TableHead>
                    {isAdmin && <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-8">Actions</TableHead>}
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
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-foreground">{c.title}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
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
                    {c.receipt_url ? (
                      <Button size="icon" variant="ghost" className="size-8 rounded-lg text-primary hover:bg-primary/10" asChild>
                        <a href={c.receipt_url} target="_blank" rel="noreferrer" title="View Bill Copy">
                           <Eye className="size-4" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-[10px] font-black text-muted-foreground/30 uppercase">No Bill</span>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right pr-8">
                      <div className="flex justify-end gap-2">
                        {c.status === 'pending' && (
                          <>
                            <Button size="icon" variant="ghost" className="size-8 rounded-lg text-green-600 hover:bg-green-100" onClick={() => setReviewingClaim({id: c.id, status: 'approved'})}>
                              <CheckCircle2 className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-8 rounded-lg text-rose-600 hover:bg-rose-100" onClick={() => setReviewingClaim({id: c.id, status: 'rejected'})}>
                              <XCircle className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
