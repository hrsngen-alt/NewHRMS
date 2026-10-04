import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Shield, MessageSquare, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feedback")({
  component: () => <AppShell><FeedbackPage /></AppShell>
});

function FeedbackPage() {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "manager";
  const qc = useQueryClient();

  const [category, setCategory] = useState("Ideas & Suggestions");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ["anonymous-feedback"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anonymous_feedback" as any)
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isAdmin
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return toast.error("Please enter your message.");

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("anonymous_feedback" as any).insert({
        category,
        message,
        status: 'unread'
      });
      if (error) throw error;
      
      toast.success("Feedback submitted anonymously.");
      setMessage("");
      setCategory("Ideas & Suggestions");
      if (isAdmin) qc.invalidateQueries({ queryKey: ["anonymous-feedback"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit feedback.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase.from("anonymous_feedback" as any).update({ status: 'read' }).eq("id", id);
    if (!error) qc.invalidateQueries({ queryKey: ["anonymous-feedback"] });
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <ShieldAlert className="size-8 text-indigo-500" />
          Safety & Feedback Box
        </h1>
        <p className="text-muted-foreground font-medium">A completely anonymous, safe space to share ideas or report concerns.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Submission Form */}
        <div className="lg:col-span-1">
          <Card className="rounded-3xl border-2 shadow-xl bg-slate-50 dark:bg-slate-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="size-5 text-emerald-500" />
                Submit Anonymously
              </CardTitle>
              <CardDescription>
                We do not track your name, email, or employee ID. Your feedback is 100% untraceable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-12 rounded-xl border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ideas & Suggestions">💡 Ideas & Suggestions</SelectItem>
                      <SelectItem value="Workplace Safety">🛡️ Workplace Safety</SelectItem>
                      <SelectItem value="HR Concern">👥 HR Concern</SelectItem>
                      <SelectItem value="Other">📝 Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Your Message</Label>
                  <Textarea 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    placeholder="Type your feedback here..." 
                    className="min-h-[150px] rounded-xl border-2 resize-none"
                    required
                  />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                  {isSubmitting ? "Submitting..." : "Submit Safely"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Admin Dashboard */}
        {isAdmin && (
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2 mb-4">
              <Shield className="size-5 text-indigo-500" />
              Admin View (Secure)
            </h2>
            
            {isLoading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground font-bold">Loading secure feedback...</div>
            ) : feedbacks.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl text-muted-foreground gap-2">
                <MessageSquare className="size-8 opacity-20" />
                <p className="font-bold">No feedback received yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbacks.map((f: any) => (
                  <div key={f.id} className={cn("p-6 rounded-3xl border-2 transition-all", f.status === 'unread' ? "bg-white dark:bg-slate-900 border-indigo-100 dark:border-indigo-900 shadow-lg" : "bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 opacity-70")}>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", 
                          f.category.includes('Safety') ? "bg-red-50 text-red-600 border-red-200" :
                          f.category.includes('HR') ? "bg-orange-50 text-orange-600 border-orange-200" :
                          "bg-indigo-50 text-indigo-600 border-indigo-200"
                        )}>
                          {f.category}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          {new Date(f.created_at).toLocaleString()}
                        </span>
                      </div>
                      {f.status === 'unread' && (
                        <Button variant="outline" size="sm" onClick={() => markAsRead(f.id)} className="h-8 rounded-lg gap-2 text-xs font-bold hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 w-full sm:w-auto mt-2 sm:mt-0">
                          <CheckCircle2 className="size-4" /> Mark Read
                        </Button>
                      )}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium leading-relaxed">{f.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
