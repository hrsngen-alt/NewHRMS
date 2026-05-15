import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Calendar, Tag, AlertCircle, Info, Star, Plus, Edit2, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/announcements")({ component: () => <AppShell><AnnouncementsPage /></AppShell> });

function AnnouncementsPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("announcements" as any).select("*").order("created_at", { ascending: false });
      if (error) return [];
      return data;
    },
  });

  const submitAnnouncement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);

    try {
      const payload = {
        title: fd.get("title"),
        content: fd.get("content"),
        category: fd.get("category"),
        priority: fd.get("priority"),
        author_id: user?.id,
      };

      if (editingItem) {
        const { error } = await supabase.from("announcements" as any).update(payload).eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Announcement updated!");
      } else {
        const { data: newAnnouncement, error } = await (supabase.from("announcements" as any) as any).insert(payload).select().single();
        if (error) throw error;

        // Notify All Employees
        const { data: employees } = await supabase.from("employees").select("user_id").not("user_id", "is", null);
        if (employees && employees.length > 0) {
          const notifications = employees.map(emp => ({
            user_id: emp.user_id,
            title: "New Company Announcement",
            message: payload.title as string,
            is_read: false,
            type: payload.category === 'event' ? 'info' : 'success'
          }));
          await (supabase.from("notifications" as any) as any).insert(notifications);
        }

        toast.success("Announcement published!");
      }

      setOpen(false);
      setEditingItem(null);
      qc.invalidateQueries({ queryKey: ["announcements"] });
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const { error } = await supabase.from("announcements" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Announcement removed");
      qc.invalidateQueries({ queryKey: ["announcements"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-4xl font-black tracking-tight text-foreground">SN Gene Bulletin & Events</h1>
          <p className="text-muted-foreground font-medium">The central hub for company news, cultural events, and important updates.</p>
        </div>

        {isAdmin && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) setEditingItem(null); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button className="h-12 px-8 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                <Plus className="size-5" /> New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl p-8 border-2 border-primary/5 shadow-elegant max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight">{editingItem ? "Edit Announcement" : "Create Announcement"}</DialogTitle>
                <DialogDescription>Share important news or upcoming events with the entire organization.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submitAnnouncement} className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Title</Label>
                  <Input name="title" defaultValue={editingItem?.title} placeholder="e.g. Annual Town Hall 2024" required className="h-12 rounded-xl border-2" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</Label>
                    <Select name="category" required defaultValue={editingItem?.category || "general"}>
                      <SelectTrigger className="h-12 rounded-xl border-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General News</SelectItem>
                        <SelectItem value="event">Company Event</SelectItem>
                        <SelectItem value="policy">Policy Update</SelectItem>
                        <SelectItem value="birthday">Birthday/Celebration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Priority</Label>
                    <Select name="priority" required defaultValue={editingItem?.priority || "normal"}>
                      <SelectTrigger className="h-12 rounded-xl border-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High Priority</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Content</Label>
                  <Textarea name="content" defaultValue={editingItem?.content} placeholder="Write the details here..." required className="min-h-[150px] rounded-xl border-2 p-4" />
                </div>

                <DialogFooter className="pt-6">
                  <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl font-black gap-2">
                    {busy ? "Saving..." : <><Send className="size-4" /> {editingItem ? "Update Announcement" : "Publish Announcement"}</>}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 rounded-3xl border bg-card animate-pulse" />
            ))
          ) : announcements.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4 border-2 border-dashed rounded-3xl">
              <Megaphone className="size-12 text-muted-foreground/30" />
              <p className="font-black text-muted-foreground uppercase tracking-widest text-xs">No active announcements</p>
            </div>
          ) : announcements.map((a: any) => (
            <Card key={a.id} className="rounded-3xl border-2 border-primary/5 shadow-card overflow-hidden transition-all hover:shadow-elegant group relative">
              {isAdmin && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <Button size="icon" variant="secondary" onClick={() => { setEditingItem(a); setOpen(true); }} className="size-8 rounded-lg">
                    <Edit2 className="size-3" />
                  </Button>
                  <Button size="icon" variant="destructive" onClick={() => deleteAnnouncement(a.id)} className="size-8 rounded-lg">
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              )}
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
                      a.priority === 'high' ? "bg-rose-100 text-rose-700" :
                        a.category === 'event' ? "bg-indigo-100 text-indigo-700" :
                          "bg-primary/10 text-primary"
                    )}>
                      {a.category}
                    </span>
                    {a.priority === 'high' && <AlertCircle className="size-4 text-rose-500 animate-pulse" />}
                  </div>
                  <CardTitle className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors pr-16">{a.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 font-bold">
                    <Calendar className="size-3" /> {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </CardDescription>
                </div>
                <div className="size-14 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Megaphone className="size-6" />
                </div>
              </CardHeader>
              <CardContent className="pb-8">
                <p className="text-muted-foreground font-medium leading-relaxed whitespace-pre-wrap">{a.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-3xl border-2 border-primary/5 shadow-card p-8 bg-gradient-to-br from-indigo-500 to-purple-600 text-white overflow-hidden relative">
            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl" />
            <Star className="size-10 mb-6 text-white/50" />
            <h3 className="text-2xl font-black tracking-tight">Stay Connected</h3>
            <p className="text-indigo-100 font-medium mt-2 leading-relaxed">The SN Gene Bulletin is your source of truth for all company-wide updates and cultural events.</p>
            <div className="mt-8 pt-8 border-t border-white/10 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                  <Tag className="size-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">Policy Updates</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                  <Info className="size-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">Event Reminders</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
