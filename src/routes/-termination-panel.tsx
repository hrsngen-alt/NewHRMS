import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldAlert, Search, Eye, Download, UserX, AlertTriangle, FileText, CheckCircle2, History, ArchiveX, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

const TERMINATION_TYPES = [
  "Performance Issues", "Misconduct", "Attendance Issues", "Policy Violation", 
  "Redundancy / Downsizing", "Position Eliminated", "Absconding", "End of Contract", 
  "Fraud", "Behavioral Issues", "Medical Reason", "Other"
];

const ASSET_TYPES = ["Laptop", "ID Card", "Access Card", "SIM Card", "Desktop", "Headset", "Documents", "Other"];

export function TerminationPanel() {
  const { employeeId } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  
  // State for form
  const [termDate, setTermDate] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [termType, setTermType] = useState("");
  const [reason, setReason] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("0");
  const [exitInterview, setExitInterview] = useState(false);
  const [assets, setAssets] = useState<string[]>([]);
  const [recoveryStatus, setRecoveryStatus] = useState("Pending");
  const [letterFile, setLetterFile] = useState<File | null>(null);

  // Dialogs
  const [showWarning, setShowWarning] = useState(false);
  const [viewTerm, setViewTerm] = useState<any>(null);

  // Queries
  const { data: employees = [], isLoading: loadingEmps } = useQuery({
    queryKey: ["active-employees-term", search],
    queryFn: async () => {
      let q = supabase.from("employees").select("id, full_name, employee_code, department, designation, status, photo_url").eq("status", "active");
      if (search) {
        q = q.or(`full_name.ilike.%${search}%,employee_code.ilike.%${search}%`);
      }
      const { data } = await q.limit(10);
      return data || [];
    }
  });

  const { data: terminations = [], isLoading: loadingTerms } = useQuery({
    queryKey: ["terminations"],
    queryFn: async () => {
      const { data } = await supabase.from("terminations")
        .select("*, employees:employee_id(full_name, employee_code, department, designation, photo_url)")
        .order("created_at", { ascending: false });
      return data || [];
    }
  });

  const selectedEmp = employees.find((e: any) => e.id === selectedEmpId);

  const toggleAsset = (a: string) => {
    setAssets(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setLetterFile(e.target.files[0]);
    } else {
      setLetterFile(null);
    }
  };

  const executeTermination = async () => {
    if (!selectedEmpId || !termDate || !lastDay || !termType || !reason) {
      setShowWarning(false);
      return toast.error("Please fill all required fields.");
    }
    setBusy(true);
    try {
      let letterUrl = null;
      if (letterFile) {
        const ext = letterFile.name.split('.').pop();
        const fileName = `termination_letters/${selectedEmpId}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("employee_documents").upload(fileName, letterFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("employee_documents").getPublicUrl(fileName);
        letterUrl = publicUrl;
      }

      // 1. Create termination record
      const { error: insertError } = await (supabase.from("terminations") as any).insert({
        employee_id: selectedEmpId,
        termination_date: termDate,
        last_working_date: lastDay,
        termination_type: termType,
        termination_reason: reason,
        termination_letter_url: letterUrl,
        approved_by: employeeId,
        notice_period: Number(noticePeriod),
        exit_interview_required: exitInterview,
        company_assets: assets,
        recovery_status: recoveryStatus,
        status: "Terminated",
        audit_created_by: employeeId,
        audit_ip_address: "web_client"
      });
      if (insertError) throw insertError;

      // 2. Update employee status to Terminated
      const { error: updateError } = await supabase.from("employees").update({ status: "Terminated" }).eq("id", selectedEmpId);
      if (updateError) throw updateError;

      toast.success("Employee terminated successfully.");
      setShowWarning(false);
      
      // Reset form
      setSelectedEmpId("");
      setTermDate("");
      setLastDay("");
      setTermType("");
      setReason("");
      setAssets([]);
      setLetterFile(null);
      if (fileRef.current) fileRef.current.value = "";
      
      qc.invalidateQueries({ queryKey: ["active-employees-term"] });
      qc.invalidateQueries({ queryKey: ["terminations"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to process termination.");
    } finally {
      setBusy(false);
    }
  };

  const cancelTermination = async (termId: string, empId: string) => {
    if (!window.confirm("Are you sure you want to cancel this termination? This will reactivate the employee account.")) return;
    setBusy(true);
    try {
      const { error: updateTerm } = await supabase.from("terminations").update({ status: "Cancelled", audit_cancelled_by: employeeId, audit_cancelled_at: new Date().toISOString() }).eq("id", termId);
      if (updateTerm) throw updateTerm;
      const { error: updateEmp } = await supabase.from("employees").update({ status: "Active" }).eq("id", empId);
      if (updateEmp) throw updateEmp;

      toast.success("Termination cancelled and employee reactivated.");
      qc.invalidateQueries({ queryKey: ["active-employees-term"] });
      qc.invalidateQueries({ queryKey: ["terminations"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel termination.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Top Section: Form and Employee Selection */}
      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* Left Side: Employee Search and Info */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-[32px] border-2 shadow-xl shadow-red-500/5 overflow-hidden border-red-100 dark:border-red-500/10">
            <CardHeader className="bg-red-50/50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/20">
              <CardTitle className="text-xl font-black flex items-center gap-2 text-red-600 dark:text-red-400">
                <UserX className="size-5" /> Select Employee
              </CardTitle>
              <CardDescription>Search and select an active employee to terminate.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Search active employees..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 rounded-xl h-12"
                />
              </div>

              {!selectedEmp && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {loadingEmps ? (
                    <div className="text-center p-4 text-sm text-muted-foreground animate-pulse font-bold">Loading...</div>
                  ) : employees.length === 0 ? (
                    <div className="text-center p-4 text-sm text-muted-foreground italic">No active employees found.</div>
                  ) : (
                    employees.map((emp: any) => (
                      <div 
                        key={emp.id} 
                        onClick={() => setSelectedEmpId(emp.id)}
                        className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-200 transition-all"
                      >
                        <div className="size-10 rounded-full bg-slate-200 shrink-0 overflow-hidden">
                          {emp.photo_url ? <img src={emp.photo_url} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center font-bold text-slate-500">{emp.full_name?.charAt(0)}</div>}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-bold truncate text-sm">{emp.full_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{emp.employee_code} • {emp.department}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {selectedEmp && (
                <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="size-16 rounded-full bg-slate-200 shrink-0 overflow-hidden border-2 border-white shadow-sm">
                      {selectedEmp.photo_url ? <img src={selectedEmp.photo_url} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center text-xl font-black text-slate-500">{selectedEmp.full_name?.charAt(0)}</div>}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-black text-lg truncate">{selectedEmp.full_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedEmp.employee_code}</p>
                      <Badge className="mt-1 bg-green-100 text-green-700 border-none uppercase tracking-widest text-[8px]">{selectedEmp.status}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm"><span className="text-[9px] font-black uppercase text-muted-foreground block mb-0.5">Dept</span><span className="font-bold truncate">{selectedEmp.department}</span></div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm"><span className="text-[9px] font-black uppercase text-muted-foreground block mb-0.5">Role</span><span className="font-bold truncate">{selectedEmp.designation}</span></div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedEmpId("")} className="w-full rounded-xl text-xs font-bold border-dashed">Select Different Employee</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-[32px] bg-red-50 dark:bg-red-900/10 border border-red-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Terminations</p>
              <p className="text-3xl font-black text-red-700 dark:text-red-400">{terminations.filter((t:any) => t.status === "Terminated").length}</p>
            </div>
            <div className="p-5 rounded-[32px] bg-slate-50 dark:bg-slate-900 border">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Active</p>
              <p className="text-3xl font-black text-slate-700 dark:text-slate-300">{loadingEmps ? "-" : employees.length}</p>
            </div>
          </div>
        </div>

        {/* Right Side: Termination Form */}
        <div className="lg:col-span-8">
          <Card className={cn("rounded-[32px] border-2 shadow-xl overflow-hidden transition-all duration-500", !selectedEmpId ? "opacity-50 pointer-events-none grayscale" : "border-slate-200")}>
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b">
              <CardTitle className="text-xl font-black">Termination Details</CardTitle>
              <CardDescription>Specify the reason, timeline, and asset recovery checklist.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Dates & Types */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest">Notice Date</Label>
                      <Input type="date" value={termDate} onChange={e => setTermDate(e.target.value)} className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest">Last Working Day</Label>
                      <Input type="date" value={lastDay} onChange={e => setLastDay(e.target.value)} className="h-11 rounded-xl" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest">Termination Type</Label>
                    <Select value={termType} onValueChange={setTermType}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select primary reason" /></SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {TERMINATION_TYPES.map(t => <SelectItem key={t} value={t} className="rounded-xl">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest">Detailed Reason</Label>
                    <Textarea 
                      placeholder="Explain the reason for termination securely for audit purposes..." 
                      value={reason} onChange={e => setReason(e.target.value)} 
                      className="min-h-[120px] rounded-xl resize-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest">Notice Period (Days)</Label>
                      <Input type="number" min="0" value={noticePeriod} onChange={e => setNoticePeriod(e.target.value)} className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest block mb-3">Exit Interview</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="exit" checked={exitInterview} onCheckedChange={(v) => setExitInterview(!!v)} />
                        <label htmlFor="exit" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Required</label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assets & Attachments */}
                <div className="space-y-6">
                  <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                      <ArchiveX className="size-4" /> Asset Recovery Checklist
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {ASSET_TYPES.map(a => (
                        <div key={a} className="flex items-center space-x-2">
                          <Checkbox id={`asset-${a}`} checked={assets.includes(a)} onCheckedChange={() => toggleAsset(a)} />
                          <label htmlFor={`asset-${a}`} className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer">{a}</label>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t">
                      <Label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Recovery Status</Label>
                      <Select value={recoveryStatus} onValueChange={setRecoveryStatus}>
                        <SelectTrigger className="h-10 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl text-xs">
                          <SelectItem value="Pending">Pending Recovery</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Not Required">Not Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest">Termination Letter (PDF/DOC)</Label>
                    <Input type="file" ref={fileRef} accept=".pdf,.doc,.docx" onChange={handleFileChange} className="h-11 rounded-xl file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                    <p className="text-[10px] text-muted-foreground">Optional. This will be securely saved to the employee's document vault.</p>
                  </div>
                  
                  <div className="pt-4">
                    <Button 
                      type="button" 
                      onClick={() => setShowWarning(true)} 
                      disabled={!selectedEmpId || busy} 
                      className="w-full h-12 rounded-xl font-black bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20"
                    >
                      Process Termination
                    </Button>
                  </div>
                </div>
                
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History Dashboard */}
      <div className="rounded-[32px] border-2 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        <div className="p-6 border-b bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black flex items-center gap-2"><History className="size-5 text-primary" /> Termination Registry</h3>
            <p className="text-sm text-muted-foreground mt-1">Immutable ledger of all company-initiated terminations.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableRow className="border-none">
                <TableHead className="font-black uppercase text-[10px] tracking-widest pl-6">Employee</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Type / Date</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Last Day</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Assets</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTerms ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-primary font-black animate-pulse">Loading records...</TableCell></TableRow>
              ) : terminations.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">No termination records found.</TableCell></TableRow>
              ) : terminations.map((t: any) => (
                <TableRow key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-slate-200 shrink-0 overflow-hidden">
                        {t.employees?.photo_url ? <img src={t.employees.photo_url} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center font-bold text-xs">{t.employees?.full_name?.charAt(0)}</div>}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">{t.employees?.full_name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{t.employees?.employee_code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-bold text-xs">{t.termination_type}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(t.termination_date).toLocaleDateString('en-GB')}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-md font-mono text-xs">{new Date(t.last_working_date).toLocaleDateString('en-GB')}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-[9px] font-black uppercase border-none", t.recovery_status === 'Completed' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                      {t.recovery_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-[10px] font-black uppercase border-none", t.status === 'Cancelled' ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-700")}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2">
                      {t.termination_letter_url && (
                        <Button size="icon" variant="ghost" className="size-8 text-blue-600 hover:bg-blue-50" onClick={() => window.open(t.termination_letter_url, "_blank")} title="View Letter">
                          <FileText className="size-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-8 text-primary hover:bg-primary/10" onClick={() => setViewTerm(t)} title="View Details">
                        <Eye className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Warning Dialog */}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent className="rounded-[32px] sm:max-w-md border-red-200 border-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-black text-red-600">
              <ShieldAlert className="size-7" /> Confirm Termination
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-900 text-sm">
              <p className="font-black mb-2 uppercase tracking-widest text-[10px] text-red-500">System Actions</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>{selectedEmp?.full_name}</strong>'s status will instantly change to <strong>Terminated</strong>.</li>
                <li>Their ESS login will be permanently disabled.</li>
                <li>They will be blocked from logging attendance and leaves.</li>
                <li>They will be automatically excluded from future payrolls.</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground italic">Are you absolutely sure you want to proceed with this action?</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowWarning(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={executeTermination} disabled={busy} className="rounded-xl px-8 font-black bg-red-600 shadow-lg shadow-red-600/30">
              {busy ? "Processing..." : "Confirm & Terminate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Termination Dialog */}
      <Dialog open={!!viewTerm} onOpenChange={(val) => !val && setViewTerm(null)}>
        <DialogContent className="rounded-[32px] max-w-2xl">
          {viewTerm && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black flex items-center gap-2"><History className="size-6 text-primary" /> Termination Record</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900">
                  <div className="size-12 rounded-full bg-slate-200 shrink-0 overflow-hidden">
                    {viewTerm.employees?.photo_url ? <img src={viewTerm.employees.photo_url} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center font-bold">{viewTerm.employees?.full_name?.charAt(0)}</div>}
                  </div>
                  <div>
                    <p className="font-black text-lg">{viewTerm.employees?.full_name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{viewTerm.employees?.employee_code} • {viewTerm.employees?.department}</p>
                  </div>
                  <div className="ml-auto">
                     <Badge className={cn("text-[10px] font-black uppercase border-none", viewTerm.status === 'Cancelled' ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-700")}>{viewTerm.status}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 rounded-2xl border space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Type & Reason</p>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{viewTerm.termination_type}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 whitespace-pre-wrap">{viewTerm.termination_reason}</p>
                   </div>
                   <div className="space-y-4">
                      <div className="p-4 rounded-2xl border grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Notice Date</p>
                          <p className="font-bold text-sm">{new Date(viewTerm.termination_date).toLocaleDateString('en-GB')}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Last Day</p>
                          <p className="font-bold text-sm">{new Date(viewTerm.last_working_date).toLocaleDateString('en-GB')}</p>
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl border bg-amber-50 dark:bg-amber-900/10 border-amber-100">
                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2">Assets & Exit</p>
                        <div className="text-xs space-y-1">
                           <p><strong>Recovery:</strong> {viewTerm.recovery_status}</p>
                           <p><strong>Checklist:</strong> {Array.isArray(viewTerm.company_assets) && viewTerm.company_assets.length > 0 ? viewTerm.company_assets.join(", ") : "None"}</p>
                           <p><strong>Interview:</strong> {viewTerm.exit_interview_required ? "Required" : "Not Required"}</p>
                        </div>
                      </div>
                   </div>
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-[10px] text-muted-foreground font-mono">
                    <p>Created: {new Date(viewTerm.created_at).toLocaleString()}</p>
                    <p>Audit IP: {viewTerm.audit_ip_address}</p>
                  </div>
                  {viewTerm.status === "Terminated" && (
                    <Button variant="destructive" size="sm" onClick={() => { setViewTerm(null); cancelTermination(viewTerm.id, viewTerm.employee_id); }} className="rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800">
                      Cancel Termination
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
