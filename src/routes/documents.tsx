import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FolderOpen, FileText, Download, ExternalLink, ShieldCheck, Info, Plus, Trash2,
  Upload, Send, CalendarDays, Clock, Smartphone, TrendingUp, X, Search, Navigation2, Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/documents")({ component: () => <AppShell><DocumentsPage /></AppShell> });

function DocumentsPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [previewDoc, setPreviewDoc] = useState<any>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["company-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_documents" as any).select("*").order("created_at", { ascending: false });
      if (error) return [];
      return data;
    },
  });

  const uploadDoc = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File;
    const title = fd.get("title") as string;
    const category = fd.get("category") as string;
    const description = fd.get("description") as string;

    try {
      let publicUrl = null;

      if (file && file.size > 0) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `policies/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("employee_documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl: url } } = supabase.storage
          .from("employee_documents")
          .getPublicUrl(filePath);

        publicUrl = url;
      }

      const { error: dbError } = await supabase.from("company_documents" as any).insert({
        title,
        category,
        description,
        file_url: publicUrl,
        created_at: new Date().toISOString()
      });

      if (dbError) throw dbError;

      toast.success(publicUrl ? "Document uploaded successfully!" : "Policy mention added!");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["company-documents"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to process request");
    } finally {
      setBusy(false);
    }
  };

  const deleteDoc = async (doc: any) => {
    if (!confirm("Are you sure you want to delete this?")) return;
    try {
      const { error } = await supabase.from("company_documents" as any).delete().eq("id", doc.id);
      if (error) throw error;
      toast.success("Removed successfully");
      qc.invalidateQueries({ queryKey: ["company-documents"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const categories = [
    "Leave Policy",
    "Office Attendance and Timing Policy",
    "Internet, Mobile, Email Usage Policy",
    "Workplace Safer for Women",
    "General Rules and Regulations",
    "Separation Policy",
    "Access Card Process",
    "Maternity & Paternity Leave Policy",
    "Code of Conduct & Ethics",
    "Marketing Main Process",
    "manual",
    "form",
    "insurance"
  ];

  const getIcon = (cat: string) => {
    switch (cat) {
      case "Leave Policy":
      case "Maternity & Paternity Leave Policy":
        return <CalendarDays className="size-5" />;
      case "Office Attendance and Timing Policy":
      case "Access Card Process":
        return <Clock className="size-5" />;
      case "Internet, Mobile, Email Usage Policy":
        return <Smartphone className="size-5" />;
      case "Workplace Safer for Women":
      case "Code of Conduct & Ethics":
        return <ShieldCheck className="size-5" />;
      case "General Rules and Regulations":
      case "manual":
        return <Info className="size-5" />;
      case "Separation Policy":
        return <X className="size-5" />;
      case "Marketing Main Process":
        return <TrendingUp className="size-5" />;
      default:
        return <FolderOpen className="size-5" />;
    }
  };

  const filteredDocs = search
    ? documents.filter((d: any) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.description?.toLowerCase().includes(search.toLowerCase())
    )
    : documents;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Policy Hub</h1>
          <p className="text-muted-foreground mt-1">Company policies, handbooks and documents.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="pl-9 w-[250px]"
            />
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="size-4" /> Add Policy
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Policy</DialogTitle>
                  <DialogDescription>Upload a document or add a text policy notice.</DialogDescription>
                </DialogHeader>
                <form onSubmit={uploadDoc} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input name="title" placeholder="Policy Title" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select name="category" required defaultValue="Leave Policy">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea name="description" placeholder="Short description or policy text..." />
                  </div>
                  <div className="space-y-2">
                    <Label>File (Optional)</Label>
                    <Input type="file" name="file" accept=".pdf,image/*" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={busy} className="w-full">
                      {busy ? "Uploading..." : "Save Policy"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Dialog open={!!previewDoc} onOpenChange={(v) => !v && setPreviewDoc(null)}>
        <DialogContent className="max-w-[95vw] h-[90vh] p-0 rounded-3xl overflow-hidden border-none shadow-2xl bg-black/90">
          {previewDoc && (
            <div className="w-full h-full flex flex-col relative">
              <div className="p-4 bg-background/10 backdrop-blur-md flex items-center justify-between border-b border-white/10 z-30">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 text-primary" />
                  <h3 className="font-black text-white">{previewDoc.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {!isAdmin && (
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10">
                      <ShieldCheck className="size-3 text-primary" />
                      <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Protected Mode</span>
                    </div>
                  )}
                  <Button variant="ghost" onClick={() => setPreviewDoc(null)} className="text-white hover:bg-white/20 rounded-xl">
                    <X className="size-5" />
                  </Button>
                </div>
              </div>

              <div
                className="flex-1 bg-neutral-900 overflow-hidden relative flex items-center justify-center"
                onContextMenu={(e) => !isAdmin && e.preventDefault()}
              >
                {/* Security Overlay for non-admins - blocks interaction but allows scroll via parent if possible, 
                    actually best way is pointer-events-none on a top layer for non-admins */}
                {!isAdmin && (
                  <div className="absolute inset-0 z-20 pointer-events-none select-none flex flex-col items-center justify-center opacity-[0.03]">
                    <p className="text-white text-6xl font-black rotate-[-30deg] uppercase tracking-[2rem]">SN Gene HR</p>
                  </div>
                )}

                <div className={cn(
                  "w-full h-full relative z-10",
                  !isAdmin ? "pointer-events-auto" : "" // We allow pointer events but handle specifically
                )}>
                  {previewDoc.file_url.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={`${previewDoc.file_url}#toolbar=0&navpanes=0&scrollbar=1`}
                      className="w-full h-full border-none bg-white"
                      title="Preview"
                      style={{ pointerEvents: isAdmin ? 'auto' : 'auto' }}
                    />
                  ) : (
                    <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                      <img
                        src={previewDoc.file_url}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg select-none"
                        draggable={false}
                      />
                    </div>
                  )}
                </div>

                {!isAdmin && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 z-30 shadow-2xl">
                    <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] flex items-center gap-2">
                      <ShieldCheck className="size-3 text-primary" />
                      View Only Mode • Print/Download Disabled
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-12">
        {categories.map((cat) => {
          const catDocs = filteredDocs.filter((d: any) => d.category === cat);
          if (catDocs.length === 0 && !isAdmin) return null;

          return (
            <div key={cat} className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-primary">{getIcon(cat)}</span>
                <h3 className="font-bold text-lg">{cat}</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {catDocs.map((d: any) => (
                  <Card key={d.id} className="group overflow-hidden transition-all hover:shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            {d.file_url ? <FileText className="size-5" /> : <Info className="size-5" />}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm line-clamp-1">{d.title}</h4>
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">{cat}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {d.file_url && (
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => setPreviewDoc(d)}>
                              <Eye className="size-4" />
                            </Button>
                          )}
                          {isAdmin && (
                            <>
                              {d.file_url && (
                                <Button size="icon" variant="ghost" className="size-8" asChild>
                                  <a href={d.file_url} target="_blank" rel="noreferrer" download>
                                    <Download className="size-4" />
                                  </a>
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => deleteDoc(d)}>
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {d.description && (
                        <p className="mt-4 text-xs text-muted-foreground line-clamp-3 italic">
                          {d.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
