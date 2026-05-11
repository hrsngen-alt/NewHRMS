import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Info, Gift, Plus, Edit2, Trash2, Send, FileSpreadsheet, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/holidays")({ component: () => <AppShell><HolidaysPage /></AppShell> });

function HolidaysPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const { data, error } = await supabase.from("holidays" as any).select("*").order("date");
      if (error) return [];
      return data;
    },
  });

  const submitHoliday = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    
    try {
      const payload = {
        name: fd.get("name"),
        date: fd.get("date"),
        type: fd.get("type"),
        description: fd.get("description"),
      };

      if (editingItem) {
        const { error } = await supabase.from("holidays" as any).update(payload).eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Holiday updated!");
      } else {
        const { error } = await supabase.from("holidays" as any).insert(payload);
        if (error) throw error;
        toast.success("Holiday added to calendar!");
      }

      setOpen(false);
      setEditingItem(null);
      qc.invalidateQueries({ queryKey: ["holidays"] });
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteHoliday = async (id: string) => {
    if (!confirm("Are you sure you want to remove this holiday?")) return;
    try {
      const { error } = await supabase.from("holidays" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Holiday removed");
      qc.invalidateQueries({ queryKey: ["holidays"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const dataBuffer = evt.target?.result;
          const wb = XLSX.read(dataBuffer, { type: 'array', cellDates: true });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);

          if (!data.length) throw new Error("No data found in Excel sheet");

          const formatted = data.map((row: any) => {
            // Find keys case-insensitively and trim them
            const findValue = (possibleKeys: string[]) => {
              const key = Object.keys(row).find(k => 
                possibleKeys.some(pk => k.trim().toUpperCase() === pk.toUpperCase())
              );
              return key ? row[key] : null;
            };

            const name = findValue(['HOLIDAY NAME', 'NAME', 'HOLIDAY', 'TITLE']);
            const dateStr = findValue(['DATE', 'WHEN', 'HOLIDAY DATE']);
            const dayStr = findValue(['DAY', 'WEEKDAY']);
            const desc = findValue(['DESCRIPTION', 'REASON', 'NOTES']);
            
            if (!name || !dateStr) return null;

            // Handle Excel dates or string dates
            let date;
            try {
              if (dateStr instanceof Date) {
                date = dateStr.toISOString().split('T')[0];
              } else {
                const parsedDate = new Date(dateStr);
                if (isNaN(parsedDate.getTime())) return null;
                date = parsedDate.toISOString().split('T')[0];
              }
            } catch (e) {
              return null;
            }

            return {
              name: String(name).trim(),
              date: date,
              type: 'public',
              description: desc || (dayStr ? `Holiday on ${dayStr}` : "Public Holiday")
            };
          }).filter((item): item is { name: string; date: string; type: string; description: any; } => item !== null);

          if (formatted.length === 0) throw new Error("Could not find valid columns (Expected: DATE and HOLIDAY NAME)");

          const { error } = await supabase.from("holidays" as any).insert(formatted);
          if (error) throw error;

          toast.success(`Successfully imported ${formatted.length} holidays!`);
          qc.invalidateQueries({ queryKey: ["holidays"] });
        } catch (err: any) {
          console.error("Import Error:", err);
          toast.error(err.message || "Failed to process Excel file");
        } finally {
          setBusy(false);
          e.target.value = ''; 
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      toast.error("Failed to read file");
      setBusy(false);
    }
  };

  const upcomingHolidays = holidays.filter((h: any) => new Date(h.date) >= new Date(new Date().setHours(0,0,0,0)));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-4xl font-black tracking-tight text-foreground">Holiday Calendar</h1>
          <p className="text-muted-foreground font-medium">Plan your time off around company and public holidays.</p>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-3">
            <div className="flex bg-muted p-1 rounded-xl border-2 border-primary/5 mr-2">
              <Button 
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'} 
                size="icon" 
                onClick={() => setViewMode('cards')}
                className={cn("size-10 rounded-lg", viewMode === 'cards' && "shadow-sm")}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button 
                variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
                size="icon" 
                onClick={() => setViewMode('table')}
                className={cn("size-10 rounded-lg", viewMode === 'table' && "shadow-sm")}
              >
                <List className="size-4" />
              </Button>
            </div>
            <input type="file" id="holiday-import" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImport} disabled={busy} />
            <Button variant="outline" onClick={() => document.getElementById('holiday-import')?.click()} disabled={busy} className="h-12 px-6 rounded-xl font-black gap-2 border-2 border-primary/10 hover:border-primary/30 transition-all">
              <FileSpreadsheet className="size-5" /> {busy ? "Importing..." : "Import Excel"}
            </Button>
            <Dialog open={open} onOpenChange={(v) => { if(!v) setEditingItem(null); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button className="h-12 px-8 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                <Plus className="size-5" /> Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl p-8 border-2 border-primary/5 shadow-elegant max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight">{editingItem ? "Edit Holiday" : "Schedule New Holiday"}</DialogTitle>
                <DialogDescription>Add a public or company-wide holiday to the internal calendar.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submitHoliday} className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Holiday Name</Label>
                  <Input name="name" defaultValue={editingItem?.name} placeholder="e.g. Diwali, Christmas, Foundation Day" required className="h-12 rounded-xl border-2" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</Label>
                    <Input type="date" name="date" defaultValue={editingItem?.date} required className="h-12 rounded-xl border-2" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Type</Label>
                    <Select name="type" required defaultValue={editingItem?.type || "public"}>
                      <SelectTrigger className="h-12 rounded-xl border-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public Holiday</SelectItem>
                        <SelectItem value="company">Company Holiday</SelectItem>
                        <SelectItem value="optional">Optional Holiday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description (Optional)</Label>
                  <Textarea name="description" defaultValue={editingItem?.description} placeholder="Short note about the holiday..." className="min-h-[100px] rounded-xl border-2 p-4" />
                </div>

                <DialogFooter className="pt-6">
                   <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl font-black gap-2">
                     {busy ? "Saving..." : <><Send className="size-4" /> {editingItem ? "Update Holiday" : "Add to Calendar"}</>}
                   </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl border bg-card animate-pulse" />
          ))}
        </div>
      ) : upcomingHolidays.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center gap-4 border-2 border-dashed rounded-3xl">
           <CalendarDays className="size-12 text-muted-foreground/30" />
           <p className="font-black text-muted-foreground uppercase tracking-widest text-xs">No upcoming holidays scheduled</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {upcomingHolidays.map((h: any) => (
            <Card key={h.id} className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden group hover:shadow-elegant transition-all active:scale-95 relative">
               {isAdmin && (
                 <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Button size="icon" variant="secondary" onClick={() => { setEditingItem(h); setOpen(true); }} className="size-8 rounded-lg">
                      <Edit2 className="size-3" />
                    </Button>
                    <Button size="icon" variant="destructive" onClick={() => deleteHoliday(h.id)} className="size-8 rounded-lg">
                      <Trash2 className="size-3" />
                    </Button>
                 </div>
               )}
               <CardHeader className={cn(
                 "pb-4 text-white",
                 h.type === 'public' ? "bg-indigo-500" : h.type === 'company' ? "bg-teal-500" : "bg-amber-500"
               )}>
                  <div className="flex items-center justify-between">
                     <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                        {h.type === 'public' ? <CalendarDays className="size-5" /> : <Gift className="size-5" />}
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest bg-black/10 px-2 py-0.5 rounded-lg">{h.type}</span>
                  </div>
                  <CardTitle className="mt-4 text-xl font-black tracking-tight">{h.name}</CardTitle>
                  <CardDescription className="text-white/70 font-bold">{new Date(h.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</CardDescription>
               </CardHeader>
               <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground font-medium line-clamp-2">{h.description || "Company-wide holiday observed across all branch locations."}</p>
                  <div className="mt-4 pt-4 border-t flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest">
                     <MapPin className="size-3" /> Ahmedabad & Surat
                  </div>
               </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 pl-6">Holiday Name</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">Date</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">Type</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">Description</TableHead>
                {isAdmin && <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 text-right pr-6">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingHolidays.map((h: any) => (
                <TableRow key={h.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="font-bold pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "size-8 rounded-lg flex items-center justify-center text-white",
                        h.type === 'public' ? "bg-indigo-500" : h.type === 'company' ? "bg-teal-500" : "bg-amber-500"
                      )}>
                        {h.type === 'public' ? <CalendarDays className="size-4" /> : <Gift className="size-4" />}
                      </div>
                      {h.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-muted-foreground whitespace-nowrap">
                    {new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
                      h.type === 'public' ? "bg-indigo-100 text-indigo-700" : h.type === 'company' ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {h.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-medium max-w-xs truncate">
                    {h.description || "Public Holiday"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditingItem(h); setOpen(true); }} className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary">
                          <Edit2 className="size-3" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteHoliday(h.id)} className="size-8 rounded-lg hover:bg-rose-100 hover:text-rose-600">
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
