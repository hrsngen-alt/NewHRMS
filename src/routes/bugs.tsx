import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bug, Search, Filter, MessageSquare, AlertCircle, CheckCircle2, Clock, PlayCircle, Download, FileText, Image as ImageIcon, Video, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bugs")({
  component: () => <AppShell><BugsDashboard /></AppShell>
});

const STATUSES = ["New", "Open", "Assigned", "In Progress", "Testing", "Resolved", "Closed", "Rejected"];

function BugsDashboard() {
  const { user, employeeId, role } = useAuth();
  const qc = useQueryClient();
  const isAdmin = role === "admin";
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedBug, setSelectedBug] = useState<any>(null);

  const { data: bugs = [], isLoading } = useQuery({
    queryKey: ["bug-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bug_reports" as any)
        .select(`*, employees!bug_reports_employee_id_fkey(full_name, department), assigned:employees!bug_reports_assigned_to_fkey(full_name)`)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isAdmin
  });

  const { data: team = [] } = useQuery({
    queryKey: ["dev-team"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("status", "Active");
      return data || [];
    }
  });

  if (!isAdmin) return <div className="p-10 text-center font-bold text-red-500">Access Denied</div>;

  const filteredBugs = bugs.filter((b: any) => {
    const matchesSearch = b.title.toLowerCase().includes(search.toLowerCase()) || b.ticket_id.toLowerCase().includes(search.toLowerCase()) || b.employees?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || b.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityColor = (p: string) => {
    if (p === 'Critical') return 'bg-red-100 text-red-700';
    if (p === 'High') return 'bg-orange-100 text-orange-700';
    if (p === 'Medium') return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  const getStatusColor = (s: string) => {
    if (s === 'New') return 'bg-blue-100 text-blue-700';
    if (['Resolved', 'Closed'].includes(s)) return 'bg-emerald-100 text-emerald-700';
    if (s === 'Rejected') return 'bg-slate-100 text-slate-700';
    return 'bg-purple-100 text-purple-700';
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayBugs = bugs.filter((b: any) => b.created_at.startsWith(todayStr)).length;
  const criticalBugs = bugs.filter((b: any) => b.priority === 'Critical' && !['Resolved', 'Closed', 'Rejected'].includes(b.status)).length;
  const openBugs = bugs.filter((b: any) => !['Resolved', 'Closed', 'Rejected'].includes(b.status)).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">Bug Management</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">Triage, assign, and resolve user-reported issues.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-3xl bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-900">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">Total Reports</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{bugs.length}</p>
        </div>
        <div className="p-6 rounded-3xl bg-purple-50 border border-purple-100 dark:bg-purple-900/20 dark:border-purple-900">
          <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-2">Open Issues</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{openBugs}</p>
        </div>
        <div className="p-6 rounded-3xl bg-red-50 border border-red-100 dark:bg-red-900/20 dark:border-red-900">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-2">Critical Priority</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{criticalBugs}</p>
        </div>
        <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Reported Today</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{todayBugs}</p>
        </div>
      </div>

      <Card className="rounded-[32px] shadow-xl overflow-hidden border-2">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search ticket or title..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11 rounded-xl" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-11 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px] h-11 rounded-xl"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/20">
              <TableRow className="border-none">
                <TableHead className="font-black uppercase text-[10px] tracking-widest pl-6 py-4">Ticket ID</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Reporter</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Title</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Priority</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Status</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Date</TableHead>
                <TableHead className="text-right pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center animate-pulse font-bold text-primary">Loading records...</TableCell></TableRow>
              ) : filteredBugs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">No bugs found.</TableCell></TableRow>
              ) : filteredBugs.map((b: any) => (
                <TableRow key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => setSelectedBug(b)}>
                  <TableCell className="pl-6 font-mono font-bold text-xs">{b.ticket_id}</TableCell>
                  <TableCell>
                    <p className="font-bold text-sm">{b.employees?.full_name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{b.employees?.department}</p>
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    <p className="font-bold text-sm truncate">{b.title}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{b.report_type} • {b.category}</p>
                  </TableCell>
                  <TableCell><Badge className={cn("text-[9px] font-black uppercase border-none", getPriorityColor(b.priority))}>{b.priority}</Badge></TableCell>
                  <TableCell><Badge className={cn("text-[10px] font-black uppercase border-none", getStatusColor(b.status))}>{b.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">{new Date(b.created_at).toLocaleDateString('en-GB')}</TableCell>
                  <TableCell className="text-right pr-6">
                     <Button variant="ghost" size="sm" className="rounded-lg text-xs font-bold">Review</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedBug && (
        <BugDetailsModal 
          bug={selectedBug} 
          onClose={() => setSelectedBug(null)} 
          team={team} 
          employeeId={employeeId!}
          onUpdate={() => { qc.invalidateQueries({queryKey: ["bug-reports"]}); }}
        />
      )}
    </div>
  );
}

function BugDetailsModal({ bug, onClose, team, employeeId, onUpdate }: any) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(bug.status);
  const [assigned, setAssigned] = useState(bug.assigned_to || "unassigned");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: comments = [] } = useQuery({
    queryKey: ["bug-comments", bug.id],
    queryFn: async () => {
      const { data } = await supabase.from("bug_comments" as any).select("*, employees(full_name)").eq("bug_id", bug.id).order("created_at", { ascending: true });
      return data || [];
    }
  });

  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      const { error } = await (supabase.from("bug_reports") as any).update({
        status, assigned_to: assigned === "unassigned" ? null : assigned
      }).eq("id", bug.id);
      if (error) throw error;
      toast.success("Ticket updated.");
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase.from("bug_comments") as any).insert({
        bug_id: bug.id, employee_id: employeeId, comment
      });
      if (error) throw error;
      setComment("");
      qc.invalidateQueries({queryKey: ["bug-comments", bug.id]});
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!bug} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 flex flex-col rounded-[32px] overflow-hidden bg-slate-50 dark:bg-zinc-950">
        <DialogHeader className="p-6 bg-white dark:bg-zinc-900 border-b shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              {bug.title}
              <Badge variant="outline" className="font-mono text-xs border-primary/20 text-primary">{bug.ticket_id}</Badge>
            </DialogTitle>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Reported by {bug.employees?.full_name} on {new Date(bug.created_at).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={assigned} onValueChange={setAssigned}>
              <SelectTrigger className="w-[180px] h-9 rounded-lg text-xs font-bold"><SelectValue placeholder="Assign To..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {team.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px] h-9 rounded-lg text-xs font-bold bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleUpdate} disabled={submitting} className="rounded-lg h-9 font-bold">Save Changes</Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Side: Bug Context */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-white dark:bg-zinc-900">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Description</h3>
              <p className="text-sm whitespace-pre-wrap">{bug.description}</p>
            </div>
            {bug.steps_to_reproduce && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b pb-2">Steps to Reproduce</h3>
                <p className="text-sm whitespace-pre-wrap">{bug.steps_to_reproduce}</p>
              </div>
            )}
            {(bug.expected_result || bug.actual_result) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50/50 dark:bg-green-950/20 rounded-2xl border border-green-100">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-green-700 mb-2">Expected Result</h3>
                  <p className="text-xs text-green-900 dark:text-green-100">{bug.expected_result || "N/A"}</p>
                </div>
                <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-100">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-red-700 mb-2">Actual Result</h3>
                  <p className="text-xs text-red-900 dark:text-red-100">{bug.actual_result || "N/A"}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b pb-2">System Diagnostics</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                 <DiagnosticItem label="App URL" value={bug.sys_url} />
                 <DiagnosticItem label="Browser" value={bug.sys_browser} />
                 <DiagnosticItem label="OS" value={bug.sys_os} />
                 <DiagnosticItem label="Resolution" value={bug.sys_resolution} />
                 <DiagnosticItem label="Timezone" value={bug.sys_timezone} />
                 <DiagnosticItem label="Language" value={bug.sys_language} />
              </div>
            </div>
          </div>

          {/* Right Side: Media & Comments */}
          <div className="w-full md:w-[400px] border-l flex flex-col bg-slate-50 dark:bg-zinc-950">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
               {/* Timeline / Comments */}
               {comments.length === 0 ? (
                 <div className="h-32 flex items-center justify-center text-xs text-muted-foreground italic">No comments yet.</div>
               ) : (
                 comments.map((c: any) => (
                   <div key={c.id} className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border shadow-sm space-y-2">
                     <div className="flex justify-between items-start">
                       <p className="font-bold text-xs">{c.employees?.full_name}</p>
                       <p className="text-[9px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                     </div>
                     <p className="text-sm text-slate-700 dark:text-slate-300">{c.comment}</p>
                     
                     {/* Attachments inside comment */}
                     {c.attachments && c.attachments.length > 0 && (
                       <div className="flex flex-wrap gap-2 pt-2 border-t mt-2">
                         {c.attachments.map((att: any, i: number) => (
                           <a key={i} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 transition-colors text-[10px] font-bold">
                             {att.type === 'image' ? <ImageIcon className="size-3" /> : att.type === 'video' ? <Video className="size-3" /> : <Paperclip className="size-3" />}
                             {att.name}
                           </a>
                         ))}
                       </div>
                     )}
                   </div>
                 ))
               )}
            </div>
            
            {/* Comment Input */}
            <div className="p-4 bg-white dark:bg-zinc-900 border-t shrink-0">
               <Textarea 
                 placeholder="Type a comment or status update..." 
                 value={comment} 
                 onChange={e => setComment(e.target.value)} 
                 className="min-h-[80px] rounded-xl text-sm mb-3 resize-none" 
               />
               <Button onClick={handleComment} disabled={submitting || !comment.trim()} className="w-full h-10 rounded-xl font-bold gap-2">
                 <Send className="size-4" /> Add Note
               </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DiagnosticItem({ label, value }: { label: string, value: string }) {
  if (!value) return null;
  return (
    <div className="p-3 bg-slate-100 dark:bg-zinc-800/50 rounded-xl">
      <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
      <p className="text-[10px] font-mono text-slate-900 dark:text-slate-100 truncate mt-1" title={value}>{value}</p>
    </div>
  );
}
