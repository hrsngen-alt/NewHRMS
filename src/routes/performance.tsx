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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Award, Target, MessageSquare, Plus, FileEdit, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/performance")({ 
  component: () => (
    <AppShell>
      <PerformancePage />
    </AppShell>
  ) 
});

function PerformancePage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: myEmployee } = useQuery({
    queryKey: ["my-employee-perf"],
    enabled: !!user && !isAdmin,
    queryFn: async () => (await supabase.from("employees" as any).select("id").eq("user_id", user!.id).maybeSingle()).data as any,
  });

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["performance-reviews", role, myEmployee?.id],
    queryFn: async () => {
      let q = supabase.from("performance_reviews" as any).select("*, employees(full_name, employee_code, department)").order("created_at", { ascending: false });
      if (!isAdmin && myEmployee) q = q.eq("employee_id", myEmployee.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!user && (isAdmin || !!myEmployee),
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ["all-employees-perf"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("employees" as any).select("id, full_name").eq("status", "active").order("full_name")).data as any[] || [],
  });

  const submitReview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const empId = fd.get("employee_id");
    const empName = allEmployees.find(e => e.id === empId)?.full_name || "Employee";

    const { error } = await supabase.from("performance_reviews" as any).insert({
      employee_id: empId,
      reviewer_id: user!.id,
      review_period: fd.get("review_period"),
      rating: Number(fd.get("rating")),
      feedback: fd.get("feedback"),
      goals: fd.get("goals"),
      status: "submitted"
    });

    if (error) {
      toast.error(error.message);
    } else {
      // Create notification for HR/Admin
      const { data: admins, error: admErr } = await supabase.from("profiles" as any).select("id").eq("role", "admin");
      if (!admErr && admins) {
        const notifications = admins.map(adm => ({
          user_id: adm.id,
          title: "New Performance Appraisal",
          message: `A new appraisal has been submitted for ${empName} (${fd.get("review_period")}).`,
          type: "success",
          is_read: false
        }));
        await supabase.from("notifications" as any).insert(notifications);
      }

      toast.success("Performance review submitted and HR notified!");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["performance-reviews"] });
    }
    setBusy(false);
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse font-black text-primary">Loading reviews...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-foreground">Performance Reviews</h1>
          <p className="text-muted-foreground font-medium mt-1">Track employee growth, set goals, and provide constructive feedback.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-xl h-12 shadow-lg shadow-primary/20">
                <Plus className="size-4" /> New Review
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl rounded-3xl p-8 border-2 border-primary/5 shadow-elegant overflow-y-auto max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight">Create Performance Review</DialogTitle>
                <CardDescription>Evaluate performance and set future objectives.</CardDescription>
              </DialogHeader>
              <form onSubmit={submitReview} className="space-y-6 mt-6">
                <div className="grid md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Employee</Label>
                      <Select name="employee_id" required>
                         <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue placeholder="Choose employee" /></SelectTrigger>
                         <SelectContent>
                            {allEmployees.map(emp => (
                               <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                            ))}
                         </SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Review Period</Label>
                      <Input name="review_period" placeholder="e.g. Q1 2024" required className="h-11 rounded-xl border-2" />
                   </div>
                </div>

                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rating (1-5)</Label>
                   <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((num) => (
                         <label key={num} className="cursor-pointer group">
                            <input type="radio" name="rating" value={num} required className="hidden peer" />
                            <div className="size-12 rounded-xl border-2 flex items-center justify-center font-black peer-checked:bg-primary peer-checked:text-white peer-checked:border-primary transition-all group-hover:border-primary/50">
                               {num}
                            </div>
                         </label>
                      ))}
                   </div>
                </div>

                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Detailed Feedback</Label>
                   <Textarea name="feedback" placeholder="Describe achievements, strengths, and areas for improvement..." className="min-h-[120px] rounded-2xl border-2" required />
                </div>

                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Future Goals & Objectives</Label>
                   <Textarea name="goals" placeholder="What should the employee achieve in the next period?" className="min-h-[100px] rounded-2xl border-2" required />
                </div>

                <DialogFooter className="pt-6 border-t gap-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
                  <Button type="submit" disabled={busy} className="px-10 rounded-xl h-11">{busy ? "Submitting..." : "Submit Review"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
         {/* Summary Widget */}
         <div className="lg:col-span-4 space-y-6">
            <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
               <CardHeader className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white pb-8">
                  <Award className="size-10 mb-4 opacity-80" />
                  <CardTitle className="text-2xl font-black tracking-tight text-white">Excellence Score</CardTitle>
                  <CardDescription className="text-indigo-100 font-medium">Average performance across all reviews.</CardDescription>
               </CardHeader>
               <CardContent className="p-8 -mt-6">
                  <div className="bg-card rounded-2xl p-6 shadow-elegant border border-primary/5 flex flex-col items-center text-center">
                     <span className="text-6xl font-black text-primary tracking-tighter">4.2</span>
                     <div className="flex gap-1 mt-2 text-amber-400">
                        <Star className="size-5 fill-current" />
                        <Star className="size-5 fill-current" />
                        <Star className="size-5 fill-current" />
                        <Star className="size-5 fill-current" />
                        <Star className="size-5 text-muted-foreground/30" />
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-4">Above Benchmark</p>
                  </div>
               </CardContent>
            </Card>

            <Card className="rounded-2xl border-2 border-primary/5 shadow-card p-6 space-y-4">
               <h3 className="font-black text-xs uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                  <Target className="size-4" /> Upcoming Targets
               </h3>
               <div className="space-y-3">
                  <TargetItem label="Annual Appraisal Cycle" date="Dec 2024" />
                  <TargetItem label="Q3 Strategy Review" date="Sep 2024" />
               </div>
            </Card>
         </div>

         {/* Reviews List */}
         <div className="lg:col-span-8">
            <Card className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden">
               <div className="overflow-x-auto">
                  <Table>
                     <TableHeader className="bg-slate-50/50 border-b">
                        <TableRow>
                           <TableHead className="pl-8 font-black uppercase text-[10px] tracking-widest">Review Period</TableHead>
                           <TableHead className="font-black uppercase text-[10px] tracking-widest">{isAdmin ? "Employee" : "Rating"}</TableHead>
                           <TableHead className="font-black uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                           <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-8">Action</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {reviews.map((r: any) => (
                           <TableRow key={r.id} className="hover:bg-primary/5 transition-colors group">
                              <TableCell className="pl-8 font-black text-foreground">
                                 <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                       <MessageSquare className="size-4" />
                                    </div>
                                    {r.review_period}
                                 </div>
                              </TableCell>
                              <TableCell>
                                 {isAdmin ? (
                                    <div className="flex flex-col">
                                       <span className="font-bold text-sm">{r.employees?.full_name}</span>
                                       <span className="text-[10px] font-black text-muted-foreground uppercase">{r.employees?.department}</span>
                                    </div>
                                 ) : (
                                    <div className="flex gap-1 text-amber-400">
                                       {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-3 fill-current" />)}
                                    </div>
                                 )}
                              </TableCell>
                              <TableCell className="text-center">
                                 <span className={cn(
                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-tighter",
                                    r.status === 'submitted' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                                 )}>
                                    {r.status === 'submitted' ? <CheckCircle2 className="size-3 mr-1" /> : <FileEdit className="size-3 mr-1" />}
                                    {r.status}
                                 </span>
                              </TableCell>
                              <TableCell className="text-right pr-8">
                                 <Button variant="ghost" size="sm" className="font-black text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10 rounded-xl">
                                    View Details
                                 </Button>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
                  {reviews.length === 0 && (
                     <div className="py-24 text-center flex flex-col items-center gap-4">
                        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground/20">
                           <Award className="size-10" />
                        </div>
                        <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No reviews documented yet.</p>
                     </div>
                  )}
               </div>
            </Card>
         </div>
      </div>
    </div>
  );
}

function TargetItem({ label, date }: { label: string; date: string }) {
   return (
      <div className="p-3 rounded-xl bg-secondary/50 flex items-center justify-between border border-transparent hover:border-primary/20 transition-all">
         <span className="text-xs font-bold text-foreground">{label}</span>
         <span className="text-[10px] font-black text-muted-foreground uppercase">{date}</span>
      </div>
   );
}
