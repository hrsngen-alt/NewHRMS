import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Trash2, Upload, Download, Users, Pencil, FileIcon, Eye, Clock, Calendar, FileText } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/employees")({ component: () => <AppShell><EmployeesPage /></AppShell> });

function EmployeesPage() {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [viewingEmployee, setViewingEmployee] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const isAdmin = role === "admin";



  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: documents = [], refetch: fetchDocs } = useQuery({
    queryKey: ["employee_documents", editingEmployee?.id || viewingEmployee?.id],
    enabled: !!editingEmployee || !!viewingEmployee,
    queryFn: async () => {
      const targetId = editingEmployee?.id || viewingEmployee?.id;
      const { data, error } = await supabase.from("employee_documents" as any).select("*").eq("employee_id", targetId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });







  const departments = useMemo(() => {
    const set = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(set).sort();
  }, [employees]);

  const filtered = employees.filter((e) => {
    const matchesQ = `${e.full_name} ${e.email} ${e.employee_code} ${e.department ?? ""}`.toLowerCase().includes(q.toLowerCase());
    const matchesDept = deptFilter === "all" || e.department === deptFilter;
    return matchesQ && matchesDept;
  });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const obj: any = {};
    fd.forEach((v, k) => { obj[k] = v === "" ? null : v; });
    ["basic_salary", "hra", "bonus", "pf_amount", "esic_amount", "gratuity_amount"].forEach((k) => { obj[k] = Number(obj[k] ?? 0); });
    obj.conveyance = 0;
    obj.medical = 0;
    obj.special_allowance = 0;
    
    let error;
    if (editingEmployee) {
      const res = await supabase.from("employees").update(obj).eq("id", editingEmployee.id);
      error = res.error;
    } else {
      const res = await supabase.from("employees").insert(obj);
      error = res.error;
    }

    if (error) {
      if (error.code === "23505") {
        if (error.message.includes("email")) toast.error("An employee with this email already exists.");
        else if (error.message.includes("employee_code")) toast.error("This employee code is already taken.");
        else if (error.message.includes("pan_number")) toast.error("This PAN number is already registered.");
        else if (error.message.includes("aadhaar_number")) toast.error("This Aadhaar number is already registered.");
        else if (error.message.includes("uan_number")) toast.error("This UAN number is already registered.");
        else toast.error("This record already exists (duplicate unique field).");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(`Employee ${editingEmployee ? "updated" : "added"}`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["employees"] });
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this employee?")) return;
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Employee deleted"); qc.invalidateQueries({ queryKey: ["employees"] }); }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingEmployee) return;
    setBusy(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingEmployee.id}/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("employee_documents").upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("employee_documents").getPublicUrl(fileName);
      
      const { error: dbError } = await supabase.from("employee_documents" as any).insert({
        employee_id: editingEmployee.id,
        document_name: file.name,
        document_url: publicUrl
      });
      if (dbError) throw dbError;

      toast.success("Document uploaded!");
      qc.invalidateQueries({ queryKey: ["employee_documents", editingEmployee.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      if (docRef.current) docRef.current.value = "";
      setBusy(false);
    }
  };

  const deleteDoc = async (doc: any) => {
    if (!confirm("Delete this document?")) return;
    setBusy(true);
    try {
      // Extract the path from the public URL to delete from storage
      const urlParts = doc.document_url.split('/employee_documents/');
      if (urlParts.length > 1) {
        const path = urlParts[1];
        const { error: storageError } = await supabase.storage.from("employee_documents").remove([path]);
        if (storageError) console.error("Storage delete error:", storageError);
      }

      const { error } = await supabase.from("employee_documents" as any).delete().eq("id", doc.id);
      if (error) throw error;
      
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["employee_documents", editingEmployee?.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete document");
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ full_name: "John Doe", email: "john@example.com" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "employees_template.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws);
        
        // 1. Fetch all existing unique IDs to avoid duplicates
        const { data: existing } = await supabase
          .from("employees")
          .select("email, pan_number, aadhaar_number, uan_number");
        
        const existingEmails = new Set(existing?.map(e => e.email?.toLowerCase()) || []);
        const existingPans = new Set(existing?.map(e => e.pan_number?.toUpperCase()) || []);
        const existingAadhaars = new Set(existing?.map(e => e.aadhaar_number) || []);
        const existingUans = new Set(existing?.map(e => e.uan_number) || []);

        const processedEmails = new Set<string>();
        const processedPans = new Set<string>();

        let skippedCount = 0;
        const inserts = rawData.map((row: any) => {
          // Normalize keys for easier matching: "Full Name" -> "fullname"
          const n: any = {};
          for (const key in row) {
            const k = key.trim().toLowerCase().replace(/[\s_-]+/g, '');
            n[k] = row[key];
          }

          const get = (...variants: string[]) => {
            for (const v of variants) {
              const normalizedV = v.toLowerCase().replace(/[\s_-]+/g, '');
              if (n[normalizedV] !== undefined) return n[normalizedV];
            }
            return null;
          };

          const emp: any = {
            full_name: get("full_name", "name", "employee_name"),
            email: get("email", "work_email", "email_address"),
            phone: get("phone", "mobile", "contact_number"),
            department: get("department", "dept"),
            designation: get("designation", "role", "position"),
            joining_date: get("joining_date", "doj", "date_of_joining"),
            pan_number: get("pan_number", "pan", "pan_card")?.toString().toUpperCase(),
            aadhaar_number: get("aadhaar_number", "aadhaar", "adhaar")?.toString(),
            uan_number: get("uan_number", "uan")?.toString(),
            reporting_manager: get("reporting_manager", "manager", "supervisor"),
            bank_name: get("bank_name", "bank"),
            bank_account: get("bank_account", "account_number", "account")?.toString(),
            bank_ifsc: get("bank_ifsc", "ifsc", "ifsc_code"),
            basic_salary: Number(get("basic_salary", "basic", "monthly_basic") || 0),
            conveyance: 0,
            medical: 0,
            special_allowance: 0,
            bonus: Number(get("bonus", "monthly_bonus") || 0),
            pf_amount: Number(get("pf_amount", "pf", "pf_deduction") || 0),
            esic_amount: Number(get("esic_amount", "esic", "esic_deduction") || 0),
            gratuity_amount: Number(get("gratuity_amount", "gratuity", "gratuity_deduction") || 0),
          };
          return emp;
        }).filter(row => {
          if (!row.full_name || !row.email) {
            skippedCount++;
            return false;
          }

          const emailLower = row.email.toLowerCase();
          const panUpper = row.pan_number;

          // Skip if email exists in DB or is duplicate in current file
          if (existingEmails.has(emailLower) || processedEmails.has(emailLower)) {
            skippedCount++;
            return false;
          }

          // Skip if PAN exists in DB or is duplicate in current file
          if (panUpper && (existingPans.has(panUpper) || processedPans.has(panUpper))) {
            skippedCount++;
            return false;
          }

          // Skip if Aadhaar or UAN exist in DB
          if (row.aadhaar_number && existingAadhaars.has(row.aadhaar_number)) {
            skippedCount++;
            return false;
          }
          if (row.uan_number && existingUans.has(row.uan_number)) {
            skippedCount++;
            return false;
          }

          processedEmails.add(emailLower);
          if (panUpper) processedPans.add(panUpper);
          return true;
        });

        if (inserts.length === 0) {
          return toast.error(skippedCount > 0 ? `No new records found. ${skippedCount} skipped due to duplicates or missing data.` : "No valid rows found");
        }

        const { error } = await supabase
          .from("employees")
          .insert(inserts);
        
        if (error) {
          toast.error(error.message);
        } else {
          toast.success(`Import complete! ${inserts.length} added, ${skippedCount} skipped.`);
          qc.invalidateQueries({ queryKey: ["employees"] });
        }
      } catch (err) {
        console.error(err);
        toast.error("Error parsing file");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
        setBusy(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };



  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">Employees</h1>
          <p className="text-sm font-medium text-muted-foreground/60 mt-1">{isLoading ? "Fetching records..." : `Managing ${employees.length} active workforce members`}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileRef} onChange={handleImport} />
            <Button variant="outline" className="gap-2 border-primary/20 text-primary hover:bg-primary/5" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload className="size-4" /> Import
            </Button>
            
            {selectedIds.size > 0 && (
              <Button 
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 animate-in zoom-in duration-200"
                disabled={busy}
                onClick={async () => {
                  const pending = employees.filter(e => selectedIds.has(e.id) && !e.user_id);
                  if (pending.length === 0) return toast.info("Selected employees already have accounts!");
                  if (!confirm(`Send welcome invites to ${pending.length} selected employees?`)) return;
                  
                  setBusy(true);
                  let success = 0;
                  let failed = 0;
                  for (const emp of pending) {
                    try {
                      // 1. Securely pre-create the user in auth.users
                      const { data: userId, error: rpcError } = await supabase.rpc('create_invited_user', {
                        p_email: emp.email,
                        p_full_name: emp.full_name
                      });
                      if (rpcError) throw rpcError;

                      // 2. Trigger the reset password / onboarding email
                      const { error } = await supabase.auth.resetPasswordForEmail(emp.email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) throw error;
                      success++;
                    } catch (err) {
                      console.error(`Failed to invite ${emp.email}:`, err);
                      failed++;
                    }
                  }
                  if (failed > 0) {
                    toast.success(`Invited ${success} employees. Failed to invite ${failed}.`);
                  } else {
                    toast.success(`Sent ${success} invites!`);
                  }
                  setSelectedIds(new Set());
                  setBusy(false);
                }}
              >
                <Users className="size-4" /> Invite Selected ({selectedIds.size})
              </Button>
            )}

            <Button 
              variant="outline" 
              className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50" 
              disabled={busy || employees.length === 0}
              onClick={async () => {
                const pending = employees.filter(e => !e.user_id);
                if (pending.length === 0) return toast.info("All employees already have accounts!");
                if (!confirm(`Send welcome invites to ${pending.length} employees?`)) return;
                
                setBusy(true);
                let success = 0;
                let failed = 0;

                for (const emp of pending) {
                  try {
                    // 1. Securely pre-create the user in auth.users
                    const { data: userId, error: rpcError } = await supabase.rpc('create_invited_user', {
                      p_email: emp.email,
                      p_full_name: emp.full_name
                    });
                    if (rpcError) throw rpcError;

                    // 2. Trigger the reset password / onboarding email
                    const { error } = await supabase.auth.resetPasswordForEmail(emp.email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) throw error;
                    success++;
                  } catch (err) {
                    console.error(`Failed to invite ${emp.email}:`, err);
                    failed++;
                  }
                }

                toast.success(`Onboarding complete! ${success} invited, ${failed} failed.`);
                setBusy(false);
              }}
            >
              <Users className="size-4" /> Invite All
            </Button>
            
            {/* View Employee Dialog */}
            <Dialog open={!!viewingEmployee} onOpenChange={(val) => { if (!val) setViewingEmployee(null); }}>
              <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-primary">
                    <Users className="size-6" /> Employee Profile
                  </DialogTitle>
                </DialogHeader>
                {viewingEmployee && (
                  <div className="mt-6 space-y-8">
                    <div className="flex flex-col md:flex-row items-center gap-8 pb-8 border-b border-slate-100 dark:border-slate-800">
                      <div className="w-28 h-36 rounded-[32px] shadow-2xl shadow-slate-200 dark:shadow-none overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 border-4 border-white dark:border-slate-700">
                        {(viewingEmployee as any).photo_url ? (
                          <img src={(viewingEmployee as any).photo_url} alt={viewingEmployee.full_name} className="size-full object-cover" />
                        ) : (
                          <div className="text-4xl font-black text-slate-200 uppercase">{viewingEmployee.full_name?.charAt(0)}</div>
                        )}
                      </div>
                      <div className="text-center md:text-left space-y-2">
                        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{viewingEmployee.full_name}</h2>
                        <p className="text-slate-500 font-mono text-sm tracking-tight">{viewingEmployee.employee_code}</p>
                        <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-2 pt-2">
                          <span className="px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-500/20">{viewingEmployee.department}</span>
                          <span className="px-4 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest border border-slate-100 dark:border-slate-700">{viewingEmployee.designation}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <section className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-l-4 border-primary pl-3">Personal & Contact</h3>
                        <div className="grid grid-cols-1 gap-3 text-sm ml-4">
                          <DetailItem label="Email" value={viewingEmployee.email} />
                          <DetailItem label="Phone" value={viewingEmployee.phone} />
                          <DetailItem label="PAN" value={viewingEmployee.pan_number} />
                          <DetailItem label="Aadhaar" value={viewingEmployee.aadhaar_number} />
                          <DetailItem label="UAN" value={viewingEmployee.uan_number} />
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-l-4 border-primary pl-3">Employment Details</h3>
                        <div className="grid grid-cols-1 gap-3 text-sm ml-4">
                          <DetailItem label="Joining Date" value={viewingEmployee.joining_date} />
                          <DetailItem label="Manager" value={viewingEmployee.reporting_manager} />
                          <DetailItem label="Status" value={viewingEmployee.status} badge />
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-l-4 border-primary pl-3">Banking Info</h3>
                        <div className="grid grid-cols-1 gap-3 text-sm ml-4">
                          <DetailItem label="Bank Name" value={viewingEmployee.bank_name} />
                          <DetailItem label="Account" value={viewingEmployee.bank_account} />
                          <DetailItem label="IFSC" value={viewingEmployee.bank_ifsc} />
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-l-4 border-primary pl-3">Salary Structure</h3>
                        <div className="grid grid-cols-1 gap-3 text-sm ml-4">
                          <DetailItem label="Basic Pay" value={`₹${Number(viewingEmployee.basic_salary).toLocaleString("en-IN")}`} />
                          <DetailItem label="HRA" value={`₹${Number(viewingEmployee.hra).toLocaleString("en-IN")}`} />
                          <DetailItem label="Monthly Bonus" value={`₹${Number(viewingEmployee.bonus || 0).toLocaleString("en-IN")}`} />
                          <div className="border-t border-b py-2 my-2 grid grid-cols-1 gap-2 bg-slate-50/50 p-2.5 rounded-lg border-slate-100">
                            <DetailItem label="Gross Salary" value={`₹${Number(
                              Number(viewingEmployee.basic_salary || 0) +
                              Number(viewingEmployee.hra || 0) +
                              Number(viewingEmployee.bonus || 0)
                            ).toLocaleString("en-IN")}`} />
                          </div>
                          <div className="flex flex-col gap-1 mt-1">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground/60">Deduction Details (Monthly)</span>
                            <div className="flex flex-wrap gap-2 mt-0.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-slate-50 text-slate-700 border-slate-200">
                                PF: ₹{Number(viewingEmployee.pf_amount || 0).toLocaleString("en-IN")}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-slate-50 text-slate-700 border-slate-200">
                                ESIC: ₹{Number(viewingEmployee.esic_amount || 0).toLocaleString("en-IN")}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-slate-50 text-slate-700 border-slate-200">
                                Gratuity: ₹{Number(viewingEmployee.gratuity_amount || 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </section>



                      <section className="md:col-span-2 space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-l-4 border-primary pl-3">Employee Documents</h3>
                        <div className="ml-4 border rounded-xl divide-y bg-slate-50/30 overflow-hidden">
                          {documents.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground italic">No documents uploaded for this employee.</div>
                          ) : documents.map((doc: any) => (
                            <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-white/80 transition-colors">
                              <div className="flex items-center gap-4 overflow-hidden">
                                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                  <FileText className="size-6" />
                                </div>
                                <div className="overflow-hidden">
                                  <p className="text-sm font-bold truncate">{doc.document_name}</p>
                                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{new Date(doc.created_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" asChild className="gap-2 shadow-none border-dashed">
                                <a href={doc.document_url} target="_blank" rel="noreferrer">
                                  <Eye className="size-4" /> View
                                </a>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                )}
                <DialogFooter className="mt-8 pt-4 border-t">
                  <Button variant="outline" onClick={() => setViewingEmployee(null)}>Close Profile</Button>
                  <Button onClick={() => { setEditingEmployee(viewingEmployee); setViewingEmployee(null); setOpen(true); }}>Edit Record</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add/Edit Employee Dialog */}
            <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setEditingEmployee(null); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary-glow" onClick={() => setEditingEmployee(null)}>
                  <Plus className="size-4" /> Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-xl">{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
                </DialogHeader>
                
                {editingEmployee ? (
                  <Tabs defaultValue="details" className="mt-4">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="documents">Documents</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details">
                      <EmployeeForm onSubmit={onSubmit} busy={busy} setOpen={setOpen} editingEmployee={editingEmployee} />
                    </TabsContent>
                    <TabsContent value="documents" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Attached Documents</h3>
                        <div>
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" ref={docRef} onChange={handleDocUpload} />
                          <Button size="sm" onClick={() => docRef.current?.click()} disabled={busy} className="gap-2">
                            <Upload className="size-4" /> Upload
                          </Button>
                        </div>
                      </div>
                      <div className="border rounded-md divide-y">
                        {documents.length === 0 ? (
                          <div className="p-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</div>
                        ) : documents.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 hover:bg-muted/30">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <FileIcon className="size-5 text-primary shrink-0" />
                              <a href={doc.document_url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline truncate">
                                {doc.document_name}
                              </a>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="icon" variant="ghost" asChild className="text-primary hover:text-primary">
                                <a href={doc.document_url} target="_blank" rel="noreferrer" title="View Document">
                                  <Eye className="size-4" />
                                </a>
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => deleteDoc(doc)} disabled={busy} className="text-destructive hover:bg-destructive/10" title="Delete Document">
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <DialogFooter className="mt-6 pt-4 border-t">
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setOpen(false); setEditingEmployee(null); }}>Finish & Close</Button>
                      </DialogFooter>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <EmployeeForm onSubmit={onSubmit} busy={busy} setOpen={setOpen} editingEmployee={null} />
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b bg-muted/20 px-4 py-1">
          <Search className="size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employees..." className="border-0 bg-transparent shadow-none flex-1 min-w-[200px]" />
          <div className="h-6 w-px bg-border mx-2 hidden sm:block" />
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-48 border-0 bg-transparent shadow-none focus:ring-0 text-xs font-semibold uppercase">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => (
                <SelectItem key={d} value={d || "none"}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                {isAdmin && (
                  <TableHead className="w-12">
                    <input 
                      type="checkbox" 
                      className="size-4 rounded border-gray-300"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(filtered.map(e => e.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </TableHead>
                )}
                <TableHead>Code</TableHead>
                <TableHead>Employee Name</TableHead>
                <TableHead>Work Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Monthly Basic</TableHead>
                {isAdmin && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id} className={cn("group hover:bg-primary/5", selectedIds.has(e.id) && "bg-primary/5")}>
                  {isAdmin && (
                    <TableCell>
                      <input 
                        type="checkbox" 
                        className="size-4 rounded border-gray-300"
                        checked={selectedIds.has(e.id)}
                        onChange={() => {
                          const next = new Set(selectedIds);
                          if (next.has(e.id)) next.delete(e.id);
                          else next.add(e.id);
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-xs">{e.employee_code}</TableCell>
                  <TableCell 
                    className="font-semibold cursor-pointer hover:text-primary hover:underline transition-colors" 
                    onClick={() => setViewingEmployee(e)}
                  >
                    {e.full_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.email}</TableCell>
                  <TableCell>{e.department}</TableCell>
                  <TableCell className="text-right font-medium">₹{Number(e.basic_salary).toLocaleString("en-IN")}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        {!e.user_id && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            title="Invite to Portal" 
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                // 1. Securely pre-create the user in auth.users
                                const { data: userId, error: rpcError } = await supabase.rpc('create_invited_user', {
                                  p_email: e.email,
                                  p_full_name: e.full_name
                                });
                                if (rpcError) throw rpcError;

                                // 2. Trigger the reset password / onboarding email
                                const { error } = await supabase.auth.resetPasswordForEmail(e.email, {
                                  redirectTo: `${window.location.origin}/reset-password`,
                                });
                                if (error) throw error;
                                toast.success("Invite sent!");
                              } catch (err: any) {
                                toast.error(err.message || "Failed to send invite");
                              }
                              setBusy(false);
                            }}
                          >
                            <Plus className="size-4 text-indigo-600" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="View Profile" onClick={() => setViewingEmployee(e)}>
                          <Eye className="size-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Edit Record" onClick={() => { setEditingEmployee(e); setOpen(true); }}>
                          <Pencil className="size-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => remove(e.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, badge }: { label: string; value: any; badge?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase text-muted-foreground/60">{label}</span>
      {badge ? (
        <span className={cn(
          "w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase",
          value?.toString().toLowerCase() === 'active' ? "bg-green-100 text-green-700" : 
          value?.toString().toLowerCase() === 'resigned' ? "bg-red-100 text-red-700" : 
          "bg-slate-100 text-slate-700"
        )}>
          {value}
        </span>
      ) : (
        <span className="text-foreground font-medium">{value}</span>
      )}
    </div>
  );
}

function EmployeeForm({ onSubmit, busy, setOpen, editingEmployee }: any) {
  const [basic, setBasic] = useState(editingEmployee?.basic_salary ?? 0);
  const [hra, setHra] = useState(editingEmployee?.hra ?? 0);
  const [bonus, setBonus] = useState(editingEmployee?.bonus ?? 0);
  const [pf, setPf] = useState(editingEmployee?.pf_amount ?? 0);
  const [esic, setEsic] = useState(editingEmployee?.esic_amount ?? 0);
  const [gratuity, setGratuity] = useState(editingEmployee?.gratuity_amount ?? 0);

  useEffect(() => {
    setBasic(editingEmployee?.basic_salary ?? 0);
    setHra(editingEmployee?.hra ?? 0);
    setBonus(editingEmployee?.bonus ?? 0);
    setPf(editingEmployee?.pf_amount ?? 0);
    setEsic(editingEmployee?.esic_amount ?? 0);
    setGratuity(editingEmployee?.gratuity_amount ?? 0);
  }, [editingEmployee]);

  const grossSalary = Number(basic || 0) + Number(hra || 0) + Number(bonus || 0);

  const personalFields = [
    ["full_name", "Full Name", true], ["email", "Work Email", true],
    ["phone", "Phone Number"], ["department", "Department"],
    ["designation", "Designation"], ["joining_date", "Joining Date", false, "date"],
    ["pan_number", "PAN Card"], ["aadhaar_number", "Aadhaar Number"],
    ["uan_number", "UAN Number"], ["reporting_manager", "Reporting Manager"],
    ["bank_name", "Bank Name"], ["bank_account", "Account Number"],
    ["bank_ifsc", "IFSC Code"],
  ];

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-5 mt-4">
      {personalFields.map(([name, label, req, type]) => (
        <div key={name as string} className={name === "full_name" || name === "email" ? "col-span-2" : ""}>
          <Label htmlFor={name as string} className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">{label as string}</Label>
          <Input 
            id={name as string} name={name as string} type={(type as string) || "text"} 
            required={Boolean(req)} className="bg-muted/30 focus:bg-white" 
            defaultValue={editingEmployee ? editingEmployee[name as string] : ""}
          />
        </div>
      ))}
      
      <div className="col-span-2 border-t pt-4 mt-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Salary Structure</h3>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="basic_salary" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Basic Pay</Label>
            <Input 
              id="basic_salary" name="basic_salary" type="number" 
              className="bg-muted/30 focus:bg-white font-medium" 
              value={basic}
              onChange={(e) => setBasic(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="hra" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">HRA</Label>
            <Input 
              id="hra" name="hra" type="number" 
              className="bg-muted/30 focus:bg-white font-medium" 
              value={hra}
              onChange={(e) => setHra(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="bonus" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Monthly Bonus</Label>
            <Input 
              id="bonus" name="bonus" type="number" 
              className="bg-muted/30 focus:bg-white font-medium" 
              value={bonus}
              onChange={(e) => setBonus(Number(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>
      
      <div className="col-span-2 bg-slate-50/50 border border-slate-100 rounded-xl p-4 mt-2 flex justify-between items-center">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 block">Calculated Gross Salary</span>
          <span className="text-xl font-black text-slate-900 mt-1 block">₹{grossSalary.toLocaleString("en-IN")}</span>
        </div>
        <div className="text-right text-[10px] text-muted-foreground font-medium leading-relaxed max-w-xs">
          Gross pay is the sum of Basic Pay, HRA, and Monthly Bonus.
        </div>
      </div>

      <div className="col-span-2 border-t pt-4 mt-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Deduction Details (Monthly Amounts)</h3>
        <div className="grid grid-cols-3 gap-4 animate-in fade-in duration-300">
          <div>
            <Label htmlFor="pf_amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">PF Deduction</Label>
            <Input 
              id="pf_amount" name="pf_amount" type="number" step="0.01"
              className="bg-muted/30 focus:bg-white font-medium" 
              value={pf}
              onChange={(e) => setPf(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="esic_amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">ESIC Deduction</Label>
            <Input 
              id="esic_amount" name="esic_amount" type="number" step="0.01"
              className="bg-muted/30 focus:bg-white font-medium" 
              value={esic}
              onChange={(e) => setEsic(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="gratuity_amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Gratuity Deduction</Label>
            <Input 
              id="gratuity_amount" name="gratuity_amount" type="number" step="0.01"
              className="bg-muted/30 focus:bg-white font-medium" 
              value={gratuity}
              onChange={(e) => setGratuity(Number(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      <DialogFooter className="col-span-2 pt-4 border-t mt-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" disabled={busy} className="px-8">{busy ? "Processing..." : "Save Details"}</Button>
      </DialogFooter>
    </form>
  );
}
