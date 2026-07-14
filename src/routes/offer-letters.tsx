import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  FileCheck, Plus, Search, Download, Eye, Send, CheckCircle2,
  XCircle, Clock, FileText, Pencil, Trash2, Printer,
  AlertCircle, LayoutTemplate, Calendar, RefreshCw, X
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/offer-letters")({
  component: () => <AppShell><OfferLettersPage /></AppShell>,
});

type OfferStatus = "Draft" | "Generated" | "Sent" | "Accepted" | "Rejected" | "Expired";

interface SalaryBreakup {
  annual_ctc: number; monthly_gross: number; basic_salary: number; hra: number;
  special_allowance: number; bonus: number; other_allowances: number;
  pf_employee: number; esic: number; gratuity: number; professional_tax: number;
}

const STATUS_COLORS: Record<string, string> = {
  Draft:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Generated:"bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  Sent:     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  Expired:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const STATUS_ICONS: Record<string, any> = {
  Draft: Clock, Generated: FileCheck, Sent: Send,
  Accepted: CheckCircle2, Rejected: XCircle, Expired: AlertCircle,
};

function calcSalaryFromCTC(ctc: number): SalaryBreakup {
  const monthly_gross = Math.round((ctc / 12) * 100) / 100;
  const basic_salary  = Math.round(monthly_gross * 0.40 * 100) / 100;
  const hra           = Math.round(basic_salary * 0.50 * 100) / 100;
  const pf_employee   = Math.round(Math.min(basic_salary * 0.12, 1800) * 100) / 100;
  const esic          = monthly_gross <= 21000 ? Math.round(monthly_gross * 0.0075 * 100) / 100 : 0;
  const gratuity      = Math.round((basic_salary / 26) * 15 / 12 * 100) / 100;
  const professional_tax = monthly_gross > 15000 ? 200 : monthly_gross > 10000 ? 150 : 0;
  const bonus         = Math.round(monthly_gross * 0.0833 * 100) / 100;
  const other_allowances = 0;
  const special_allowance = Math.max(0, Math.round((monthly_gross - basic_salary - hra - bonus - other_allowances) * 100) / 100);
  return { annual_ctc: ctc, monthly_gross, basic_salary, hra, special_allowance, bonus, other_allowances, pf_employee, esic, gratuity, professional_tax };
}

function renderTemplate(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

function buildPlaceholders(form: any, company: string): Record<string, string> {
  const fmt = (n: number) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  return {
    CandidateName: form.candidate_name || "", Designation: form.designation || "",
    Department: form.department || "", ReportingManager: form.reporting_manager || "",
    WorkLocation: form.work_location || "", CompanyName: company,
    CandidateEmail: form.candidate_email || "", CandidateMobile: form.candidate_mobile || "",
    JoiningDate: form.joining_date ? new Date(form.joining_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "",
    OfferDate: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
    AnnualCTC: fmt(Number(form.annual_ctc || 0)), MonthlyGross: fmt(Number(form.monthly_gross || 0)),
    BasicSalary: fmt(Number(form.basic_salary || 0)), HRA: fmt(Number(form.hra || 0)),
    SpecialAllowance: fmt(Number(form.special_allowance || 0)), Bonus: fmt(Number(form.bonus || 0)),
    PFEmployee: fmt(Number(form.pf_employee || 0)), ESIC: fmt(Number(form.esic || 0)),
    Gratuity: fmt(Number(form.gratuity || 0)), ProfessionalTax: fmt(Number(form.professional_tax || 0)),
  };
}

// ────────────────────── Main Page ──────────────────────
function OfferLettersPage() {
  const { role, employeeId } = useAuth();
  const qc = useQueryClient();
  const isAdmin = role === "admin";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("letters");
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["offer-letters"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("offer_letters").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["offer-letter-templates"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("offer_letter_templates").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-offers"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name, email, phone, designation, department, employee_code").eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings-for-offers"],
    queryFn: async () => { const { data } = await (supabase as any).from("company_settings").select("company_name").maybeSingle(); return data; },
    enabled: isAdmin,
  });

  const companyName = (settings as any)?.company_name || "SN Gene Pvt. Ltd.";

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="size-20 rounded-3xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
        <AlertCircle className="size-10 text-rose-500" />
      </div>
      <h2 className="text-2xl font-black">Access Denied</h2>
      <p className="text-muted-foreground font-medium">You don't have permission to view this module.</p>
    </div>
  );

  const stats = useMemo(() => ({
    total: offers.length,
    draft: offers.filter((o: any) => o.status === "Draft").length,
    generated: offers.filter((o: any) => o.status === "Generated").length,
    sent: offers.filter((o: any) => o.status === "Sent").length,
    accepted: offers.filter((o: any) => o.status === "Accepted").length,
    rejected: offers.filter((o: any) => o.status === "Rejected").length,
    expired: offers.filter((o: any) => o.status === "Expired").length,
  }), [offers]);

  const filtered = useMemo(() => offers.filter((o: any) => {
    const q = search.toLowerCase();
    const matchSearch = !search || o.candidate_name?.toLowerCase().includes(q) || o.offer_number?.toLowerCase().includes(q) || o.designation?.toLowerCase().includes(q) || o.department?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchDept = deptFilter === "all" || o.department === deptFilter;
    return matchSearch && matchStatus && matchDept;
  }), [offers, search, statusFilter, deptFilter]);

  const depts = useMemo(() => [...new Set(offers.map((o: any) => o.department).filter(Boolean))], [offers]);

  const deleteOffer = async (id: string) => {
    if (!confirm("Delete this offer letter?")) return;
    await (supabase as any).from("offer_letters").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["offer-letters"] });
    toast.success("Deleted.");
  };

  const updateStatus = async (id: string, status: string, extra: Record<string, any> = {}) => {
    await (supabase as any).from("offer_letters").update({ status, updated_by: employeeId, ...extra }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["offer-letters"] });
    toast.success(`Marked as ${status}.`);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/30 flex items-center justify-center shrink-0">
            <FileCheck className="size-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight text-foreground">Offer Letters</h1>
            <p className="text-muted-foreground font-medium text-sm">Generate, manage and track candidate offer letters</p>
          </div>
        </div>
        <Button onClick={() => { setSelectedOffer(null); setShowGenerate(true); }}
          className="h-12 px-6 rounded-2xl gap-2 font-black bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/30 text-white">
          <Plus className="size-5" /> Generate Offer Letter
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-800/50", icon: FileText, filter: "all" },
          { label: "Draft", value: stats.draft, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-800/30", icon: Clock, filter: "Draft" },
          { label: "Generated", value: stats.generated, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30", icon: FileCheck, filter: "Generated" },
          { label: "Sent", value: stats.sent, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", icon: Send, filter: "Sent" },
          { label: "Accepted", value: stats.accepted, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", icon: CheckCircle2, filter: "Accepted" },
          { label: "Rejected", value: stats.rejected, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30", icon: XCircle, filter: "Rejected" },
          { label: "Expired", value: stats.expired, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", icon: AlertCircle, filter: "Expired" },
        ].map(({ label, value, color, bg, icon: Icon, filter }) => (
          <Card key={label} className={cn("rounded-2xl border-0 shadow-sm cursor-pointer hover:shadow-md transition-all", bg, statusFilter === filter && "ring-2 ring-indigo-500")}
            onClick={() => setStatusFilter(filter)}>
            <CardContent className="p-4">
              <Icon className={cn("size-5 mb-2", color)} />
              <p className={cn("text-2xl font-black tabular-nums", color)}>{value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 dark:bg-slate-800 rounded-2xl h-12 p-1 gap-1">
          <TabsTrigger value="letters" className="rounded-xl font-black text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700 flex gap-2">
            <FileText className="size-4" /> Letters
          </TabsTrigger>
          <TabsTrigger value="templates" className="rounded-xl font-black text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-700 flex gap-2">
            <LayoutTemplate className="size-4" /> Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="letters" className="mt-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search candidate, offer #, designation..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 rounded-2xl border-2 font-medium" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="size-4 text-muted-foreground" /></button>}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-11 rounded-2xl border-2 font-bold"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {["Draft","Generated","Sent","Accepted","Rejected","Expired"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-44 h-11 rounded-2xl border-2 font-bold"><SelectValue placeholder="All Depts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {depts.map(d => <SelectItem key={d as string} value={d as string}>{d as string}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-3xl border-2 border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-widest">Offer #</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Candidate</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest hidden md:table-cell">Role / Dept</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center hidden lg:table-cell">Annual CTC</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center hidden lg:table-cell">Joining Date</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                  <TableHead className="pr-8 text-[10px] font-black uppercase tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7} className="py-4 pl-8"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-2/3" /></TableCell></TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="size-16 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                          <FileCheck className="size-8 text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No offer letters found</p>
                        <Button variant="outline" onClick={() => setShowGenerate(true)} className="rounded-xl gap-2 mt-1">
                          <Plus className="size-4" /> Generate First Offer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.map((offer: any) => {
                  const SIcon = STATUS_ICONS[offer.status] || FileText;
                  return (
                    <TableRow key={offer.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-b dark:border-slate-800 last:border-0 transition-all">
                      <TableCell className="pl-8 py-5">
                        <span className="font-black text-xs text-indigo-600 dark:text-indigo-400">{offer.offer_number || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-sm">{offer.candidate_name}</span>
                          <span className="text-[11px] text-muted-foreground">{offer.candidate_email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-xs">{offer.designation || "—"}</span>
                          <span className="text-[11px] text-muted-foreground">{offer.department || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell">
                        <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                          {offer.annual_ctc ? `₹${Number(offer.annual_ctc).toLocaleString("en-IN")}` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell">
                        <span className="text-sm font-medium text-muted-foreground">
                          {offer.joining_date ? new Date(offer.joining_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", STATUS_COLORS[offer.status] || "bg-slate-100 text-slate-600")}>
                          <SIcon className="size-3" />{offer.status}
                        </span>
                      </TableCell>
                      <TableCell className="pr-8">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/30" title="Preview"
                            onClick={() => { setSelectedOffer(offer); setShowPreview(true); }}>
                            <Eye className="size-4 text-indigo-500" />
                          </Button>
                          {offer.status === "Draft" && (
                            <Button variant="ghost" size="icon" className="size-8 rounded-xl hover:bg-slate-50" title="Edit"
                              onClick={() => { setSelectedOffer(offer); setShowGenerate(true); }}>
                              <Pencil className="size-4 text-slate-500" />
                            </Button>
                          )}
                          {offer.status === "Generated" && (
                            <Button variant="ghost" size="icon" className="size-8 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/30" title="Mark as Sent"
                              onClick={() => updateStatus(offer.id, "Sent", { sent_at: new Date().toISOString(), sent_by: employeeId, email_delivery_status: "Sent" })}>
                              <Send className="size-4 text-blue-500" />
                            </Button>
                          )}
                          {offer.status === "Sent" && (<>
                            <Button variant="ghost" size="icon" className="size-8 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30" title="Accept"
                              onClick={() => updateStatus(offer.id, "Accepted", { accepted_at: new Date().toISOString() })}>
                              <CheckCircle2 className="size-4 text-emerald-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30" title="Reject"
                              onClick={() => updateStatus(offer.id, "Rejected", { rejected_at: new Date().toISOString() })}>
                              <XCircle className="size-4 text-rose-500" />
                            </Button>
                          </>)}
                          <Button variant="ghost" size="icon" className="size-8 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30" title="Delete"
                            onClick={() => deleteOffer(offer.id)}>
                            <Trash2 className="size-4 text-rose-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{templates.length} template(s)</p>
            <Button onClick={() => { setEditTemplate(null); setShowTemplateEditor(true); }}
              className="h-10 px-5 rounded-2xl gap-2 font-black bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <Plus className="size-4" /> New Template
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tmpl: any) => (
              <Card key={tmpl.id} className="rounded-3xl border-2 border-slate-50 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-black text-foreground">{tmpl.name}</h3>
                      {tmpl.is_default && <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 w-fit">Default</span>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-8 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                        onClick={() => { setEditTemplate(tmpl); setShowTemplateEditor(true); }}>
                        <Pencil className="size-4 text-indigo-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        onClick={async () => {
                          if (!confirm("Delete this template?")) return;
                          await (supabase as any).from("offer_letter_templates").delete().eq("id", tmpl.id);
                          qc.invalidateQueries({ queryKey: ["offer-letter-templates"] });
                          toast.success("Template deleted.");
                        }}>
                        <Trash2 className="size-4 text-rose-400" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{tmpl.body_html.replace(/<[^>]+>/g, " ").substring(0, 120)}...</p>
                  <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mt-3">
                    {new Date(tmpl.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </CardContent>
              </Card>
            ))}
            {templates.length === 0 && (
              <div className="col-span-3 py-20 flex flex-col items-center gap-3">
                <div className="size-16 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <LayoutTemplate className="size-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No templates yet</p>
                <Button variant="outline" onClick={() => { setEditTemplate(null); setShowTemplateEditor(true); }} className="rounded-xl gap-2 mt-1">
                  <Plus className="size-4" /> Create First Template
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {showGenerate && (
        <GenerateModal offer={selectedOffer} employees={employees} templates={templates} companyName={companyName} employeeId={employeeId}
          onClose={() => { setShowGenerate(false); setSelectedOffer(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["offer-letters"] }); setShowGenerate(false); setSelectedOffer(null); }} />
      )}
      {showPreview && selectedOffer && (
        <PreviewModal offer={selectedOffer} templates={templates} companyName={companyName}
          onClose={() => { setShowPreview(false); setSelectedOffer(null); }} />
      )}
      {showTemplateEditor && (
        <TemplateEditorModal template={editTemplate} employeeId={employeeId}
          onClose={() => { setShowTemplateEditor(false); setEditTemplate(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["offer-letter-templates"] }); setShowTemplateEditor(false); setEditTemplate(null); }} />
      )}
    </div>
  );
}

// ────────────────────── Generate Modal ──────────────────────
function GenerateModal({ offer, employees, templates, companyName, employeeId, onClose, onSaved }: any) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState(offer?.employee_id || "__none__");
  const [form, setForm] = useState<any>({
    candidate_name: offer?.candidate_name || "", candidate_email: offer?.candidate_email || "",
    candidate_mobile: offer?.candidate_mobile || "", designation: offer?.designation || "",
    department: offer?.department || "", reporting_manager: offer?.reporting_manager || "",
    work_location: offer?.work_location || "", joining_date: offer?.joining_date || "",
    annual_ctc: offer?.annual_ctc || "", monthly_gross: offer?.monthly_gross || "",
    basic_salary: offer?.basic_salary || "", hra: offer?.hra || "",
    special_allowance: offer?.special_allowance || "", bonus: offer?.bonus || "",
    other_allowances: offer?.other_allowances || "", pf_employee: offer?.pf_employee || "",
    esic: offer?.esic || "", gratuity: offer?.gratuity || "", professional_tax: offer?.professional_tax || "",
    template_id: offer?.template_id || (templates.find((t: any) => t.is_default)?.id || ""),
    expires_at: offer?.expires_at || "", notes: offer?.notes || "",
  });

  useEffect(() => {
    if (!selectedEmpId || selectedEmpId === "__none__") return;
    const emp = employees.find((e: any) => e.id === selectedEmpId);
    if (!emp) return;
    setForm((f: any) => ({ ...f, candidate_name: emp.full_name || f.candidate_name, candidate_email: emp.email || f.candidate_email, candidate_mobile: emp.phone || f.candidate_mobile, designation: emp.designation || f.designation, department: emp.department || f.department }));
  }, [selectedEmpId, employees]);

  useEffect(() => {
    const ctc = Number(form.annual_ctc);
    if (!ctc || ctc <= 0) return;
    const c = calcSalaryFromCTC(ctc);
    setForm((f: any) => ({ ...f, monthly_gross: c.monthly_gross, basic_salary: c.basic_salary, hra: c.hra, special_allowance: c.special_allowance, bonus: c.bonus, pf_employee: c.pf_employee, esic: c.esic, gratuity: c.gratuity, professional_tax: c.professional_tax }));
  }, [form.annual_ctc]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const fmt = (n: any) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const handleSave = async (status: string) => {
    if (!form.candidate_name.trim()) return toast.error("Candidate name is required.");
    setIsSaving(true);
    try {
      const tmpl = templates.find((t: any) => t.id === form.template_id);
      const rendered_html = tmpl ? renderTemplate(tmpl.body_html, buildPlaceholders(form, companyName)) : "";
      const payload = { 
        ...form, 
        annual_ctc: Number(form.annual_ctc)||0, 
        monthly_gross: Number(form.monthly_gross)||0, 
        basic_salary: Number(form.basic_salary)||0, 
        hra: Number(form.hra)||0, 
        special_allowance: Number(form.special_allowance)||0, 
        bonus: Number(form.bonus)||0, 
        other_allowances: Number(form.other_allowances)||0, 
        pf_employee: Number(form.pf_employee)||0, 
        esic: Number(form.esic)||0, 
        gratuity: Number(form.gratuity)||0, 
        professional_tax: Number(form.professional_tax)||0, 
        employee_id: (selectedEmpId && selectedEmpId !== "__none__") ? selectedEmpId : null, 
        template_id: form.template_id || null,
        joining_date: form.joining_date || null,
        expires_at: form.expires_at || null,
        status, 
        rendered_html, 
        updated_by: employeeId 
      };
      if (offer?.id) {
        await (supabase as any).from("offer_letters").update(payload).eq("id", offer.id);
        toast.success("Offer letter updated.");
      } else {
        const offerNum = `OL-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        await (supabase as any).from("offer_letters").insert({ ...payload, offer_number: offerNum, created_by: employeeId });
        toast.success(status === "Generated" ? "Offer letter generated!" : "Draft saved.");
      }
      onSaved();
    } catch { toast.error("Failed to save."); } finally { setIsSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">{offer ? "Edit Offer Letter" : "Generate Offer Letter"}</DialogTitle>
          <div className="flex items-center gap-2 mt-3">
            {[1,2,3].map(s => (
              <div key={s} className={cn("flex items-center gap-2", s < 3 && "flex-1")}>
                <div className={cn("size-8 rounded-xl flex items-center justify-center text-xs font-black transition-all shrink-0", step >= s ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30" : "bg-slate-100 dark:bg-slate-800 text-muted-foreground")}>
                  {s < step ? "✓" : s}
                </div>
                <span className={cn("text-[10px] font-black uppercase tracking-widest hidden sm:block shrink-0", step >= s ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground")}>
                  {s === 1 ? "Candidate" : s === 2 ? "Salary" : "Template"}
                </span>
                {s < 3 && <div className={cn("flex-1 h-0.5 rounded-full transition-all", step > s ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700")} />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {step === 1 && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Auto-fill from existing employee (optional)</Label>
                <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                  <SelectTrigger className="rounded-xl border-2 h-11"><SelectValue placeholder="Select employee to pre-fill details..." /></SelectTrigger>
                  <SelectContent>
                <SelectItem value="__none__">— Enter manually —</SelectItem>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { k: "candidate_name", l: "Candidate Name *", t: "text", p: "Full Name" },
                  { k: "candidate_email", l: "Email", t: "email", p: "email@example.com" },
                  { k: "candidate_mobile", l: "Mobile", t: "text", p: "+91 98765 43210" },
                  { k: "designation", l: "Designation", t: "text", p: "Software Engineer" },
                  { k: "department", l: "Department", t: "text", p: "Technology" },
                  { k: "reporting_manager", l: "Reporting Manager", t: "text", p: "Manager name" },
                  { k: "work_location", l: "Work Location", t: "text", p: "Ahmedabad, Gujarat" },
                  { k: "joining_date", l: "Joining Date", t: "date", p: "" },
                  { k: "expires_at", l: "Offer Expires On", t: "date", p: "" },
                ].map(({ k, l, t, p }) => (
                  <div key={k} className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{l}</Label>
                    <Input type={t} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={p} className="rounded-xl border-2 h-11" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1 block">Annual CTC — auto-calculates all components below</Label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-600 text-lg">₹</span>
                  <Input type="number" value={form.annual_ctc} onChange={e => set("annual_ctc", e.target.value)} placeholder="600000" className="pl-9 rounded-xl border-2 h-12 text-lg font-black" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { k: "monthly_gross", l: "Monthly Gross" }, { k: "basic_salary", l: "Basic Salary" },
                  { k: "hra", l: "HRA" }, { k: "special_allowance", l: "Special Allowance" },
                  { k: "bonus", l: "Bonus (Annual)" }, { k: "other_allowances", l: "Other Allowances" },
                ].map(({ k, l }) => (
                  <div key={k} className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{l}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                      <Input type="number" value={form[k]} onChange={e => set(k, e.target.value)} className="pl-7 rounded-xl border-2 h-11" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t dark:border-slate-800 pt-4">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Statutory Deductions</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { k: "pf_employee", l: "PF (Employee)" }, { k: "esic", l: "ESIC" },
                    { k: "gratuity", l: "Gratuity" }, { k: "professional_tax", l: "Professional Tax" },
                  ].map(({ k, l }) => (
                    <div key={k} className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{l}</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                        <Input type="number" value={form[k]} onChange={e => set(k, e.target.value)} className="pl-7 rounded-xl border-2 h-11" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {Number(form.annual_ctc) > 0 && (
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Salary Summary</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Monthly Gross</span><span className="font-black">₹{fmt(form.monthly_gross)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Est. Take-Home</span>
                      <span className="font-black text-emerald-600">₹{fmt(Math.max(0, Number(form.monthly_gross) - Number(form.pf_employee) - Number(form.esic) - Number(form.professional_tax)))}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select Template</Label>
                <Select value={form.template_id} onValueChange={v => set("template_id", v)}>
                  <SelectTrigger className="rounded-xl border-2 h-11"><SelectValue placeholder="Choose a template..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}{t.is_default ? " (Default)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Internal Notes</Label>
                <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Internal notes..." className="rounded-xl border-2 min-h-[80px]" />
              </div>
              {form.template_id && templates.find((t: any) => t.id === form.template_id) && (
                <div className="rounded-2xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Letter Preview</p>
                  </div>
                  <div className="p-4 max-h-64 overflow-y-auto text-sm bg-white dark:bg-slate-900"
                    dangerouslySetInnerHTML={{ __html: renderTemplate(templates.find((t: any) => t.id === form.template_id)?.body_html || "", buildPlaceholders(form, companyName)) }} />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between pt-4 border-t dark:border-slate-800">
          <div>{step > 1 && <Button variant="outline" onClick={() => setStep(s => s - 1)} className="rounded-xl gap-2">← Back</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
            {step < 3 ? (
              <Button onClick={() => setStep(s => s + 1)} className="rounded-xl gap-2 bg-indigo-500 hover:bg-indigo-600 text-white">Next →</Button>
            ) : (<>
              <Button variant="outline" disabled={isSaving} onClick={() => handleSave("Draft")} className="rounded-xl gap-2">
                <Clock className="size-4" /> Save Draft
              </Button>
              <Button disabled={isSaving} onClick={() => handleSave("Generated")} className="rounded-xl gap-2 bg-indigo-500 hover:bg-indigo-600 text-white">
                {isSaving ? <RefreshCw className="size-4 animate-spin" /> : <FileCheck className="size-4" />} Generate
              </Button>
            </>)}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────── Preview Modal ──────────────────────
function PreviewModal({ offer, templates, companyName, onClose }: any) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const tmpl = templates.find((t: any) => t.id === offer.template_id);
  const html = offer.rendered_html || (tmpl ? renderTemplate(tmpl.body_html, buildPlaceholders(offer, companyName)) : "<p>No template content found.</p>");

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.top = '-9999px';
      iframe.style.width = '800px';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error("Could not create iframe document");

      doc.write(`
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; color: #1a1a1a; background: #ffffff; padding: 40px; margin: 0; }
              table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 10px; }
              td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
              * { color: #1a1a1a; }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `);
      doc.close();

      await new Promise(r => setTimeout(r, 150));
      const canvas = await html2canvas(doc.body, { scale: 2, useCORS: true, logging: false });
      document.body.removeChild(iframe);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);
      pdf.save(`${offer.offer_number || "offer-letter"}.pdf`);
      toast.success("PDF downloaded!");
    } catch (err: any) { toast.error(`PDF Error: ${err?.message || "Unknown error"}`); } finally { setIsExporting(false); }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>${offer.offer_number||"Offer Letter"}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#1a1a1a;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #ddd;padding:8px;}</style></head><body>${content}</body></html>`);
    win.document.close(); win.focus(); win.print(); win.close();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-black">{offer.offer_number} — {offer.candidate_name}</DialogTitle>
              <span className={cn("inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest mt-1", STATUS_COLORS[offer.status] || "")}>
                {offer.status}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint} className="rounded-xl gap-2 h-9 text-sm">
                <Printer className="size-4" /> Print
              </Button>
              <Button onClick={handleDownloadPDF} disabled={isExporting} className="rounded-xl gap-2 h-9 text-sm bg-indigo-500 hover:bg-indigo-600 text-white">
                {isExporting ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />} PDF
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="rounded-2xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden bg-white">
          <div ref={printRef} className="p-8 text-slate-900 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <div className="grid sm:grid-cols-3 gap-3 pt-2">
          {[
            { label: "Created", value: offer.created_at ? new Date(offer.created_at).toLocaleDateString("en-IN") : "—", icon: FileText },
            { label: "Sent", value: offer.sent_at ? new Date(offer.sent_at).toLocaleDateString("en-IN") : "Not sent", icon: Send },
            { label: "Expires", value: offer.expires_at ? new Date(offer.expires_at+"T00:00:00").toLocaleDateString("en-IN") : "—", icon: Calendar },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
              <div className="size-8 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center shrink-0">
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="text-sm font-bold">{value}</p></div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────── Template Editor ──────────────────────
const PLACEHOLDERS = [
  "{{CandidateName}}", "{{Designation}}", "{{Department}}", "{{JoiningDate}}",
  "{{AnnualCTC}}", "{{MonthlyGross}}", "{{BasicSalary}}", "{{HRA}}",
  "{{SpecialAllowance}}", "{{Bonus}}", "{{WorkLocation}}", "{{CompanyName}}",
  "{{ReportingManager}}", "{{OfferDate}}", "{{CandidateEmail}}", "{{CandidateMobile}}",
  "{{PFEmployee}}", "{{ESIC}}", "{{Gratuity}}", "{{ProfessionalTax}}",
];

function TemplateEditorModal({ template, employeeId, onClose, onSaved }: any) {
  const [name, setName] = useState(template?.name || "");
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || "");
  const [isDefault, setIsDefault] = useState(template?.is_default || false);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<"edit"|"preview">("edit");

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Template name is required.");
    if (!bodyHtml.trim()) return toast.error("Template content is required.");
    setIsSaving(true);
    try {
      const payload = { name, body_html: bodyHtml, is_default: isDefault };
      if (template?.id) {
        await (supabase as any).from("offer_letter_templates").update(payload).eq("id", template.id);
        toast.success("Template updated.");
      } else {
        await (supabase as any).from("offer_letter_templates").insert({ ...payload, created_by: employeeId });
        toast.success("Template created.");
      }
      onSaved();
    } catch { toast.error("Failed to save template."); } finally { setIsSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">{template ? "Edit Template" : "New Template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Template Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Standard Offer Letter" className="rounded-xl border-2 h-11" />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" id="is_default_tmpl" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="size-4 rounded accent-indigo-500" />
              <Label htmlFor="is_default_tmpl" className="text-sm font-bold cursor-pointer">Set as default template</Label>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Click to insert placeholder</p>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map(p => (
                <button key={p} onClick={() => setBodyHtml((prev: string) => prev + p)}
                  className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-black hover:bg-indigo-100 transition-colors border border-indigo-200 dark:border-indigo-900">
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 border-b dark:border-slate-800 pb-3">
            <button onClick={() => setView("edit")} className={cn("text-sm font-bold px-4 py-1.5 rounded-xl transition-all", view === "edit" ? "bg-indigo-500 text-white" : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800")}>✏️ Edit HTML</button>
            <button onClick={() => setView("preview")} className={cn("text-sm font-bold px-4 py-1.5 rounded-xl transition-all", view === "preview" ? "bg-indigo-500 text-white" : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800")}>👁️ Preview</button>
          </div>
          {view === "edit" ? (
            <div className="space-y-1">
              <Textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)} placeholder="<p>Dear {{CandidateName}},</p>..." className="min-h-[380px] font-mono text-xs rounded-xl border-2" />
              <p className="text-[10px] text-muted-foreground">Supports full HTML. Use placeholders above.</p>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white overflow-auto min-h-[380px] p-6">
              <div className="text-slate-900 text-sm" dangerouslySetInnerHTML={{ __html: bodyHtml || "<p style='color:#999'>Nothing to preview yet.</p>" }} />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 pt-4 border-t dark:border-slate-800">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button disabled={isSaving} onClick={handleSave} className="rounded-xl gap-2 bg-indigo-500 hover:bg-indigo-600 text-white">
            {isSaving ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {template ? "Update Template" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
