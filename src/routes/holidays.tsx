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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <input type="file" id="holiday-import" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleImport} disabled={busy} />
            <Button variant="outline" onClick={() => document.getElementById('holiday-import')?.click()} disabled={busy} className="h-12 px-6 rounded-xl font-black gap-2 border-2 border-primary/10 hover:border-primary/30 transition-all w-full sm:w-auto">
              <FileSpreadsheet className="size-5" /> {busy ? "Importing..." : "Import Excel"}
            </Button>
            <Dialog open={open} onOpenChange={(v) => { if(!v) setEditingItem(null); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button className="h-12 px-8 rounded-xl font-black gap-2 shadow-lg shadow-primary/20 w-full sm:w-auto">
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
        <div className="h-64 rounded-3xl border-2 border-dashed flex items-center justify-center">
          <p className="font-black text-muted-foreground animate-pulse">Loading Holidays...</p>
        </div>
      ) : upcomingHolidays.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center gap-4 border-2 border-dashed rounded-3xl">
           <CalendarDays className="size-12 text-muted-foreground/30" />
           <p className="font-black text-muted-foreground uppercase tracking-widest text-xs">No upcoming holidays scheduled</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-primary/5 shadow-card overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <Table className="w-full table-auto">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 pl-6">Holiday Name</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">Date</TableHead>
                  <TableHead className="hidden md:table-cell font-black text-[10px] uppercase tracking-widest py-4">Type</TableHead>
                  <TableHead className="hidden md:table-cell font-black text-[10px] uppercase tracking-widest py-4">Description</TableHead>
                  {isAdmin && (
                    <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 text-right pr-6">
                      <span className="hidden sm:inline">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingHolidays.map((h: any) => (
                  <TableRow key={h.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-bold pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "size-8 rounded-lg flex items-center justify-center text-white shrink-0",
                          h.type === 'public' ? "bg-indigo-500" : h.type === 'company' ? "bg-teal-500" : "bg-amber-500"
                        )}>
                          {h.type === 'public' ? <CalendarDays className="size-4" /> : <Gift className="size-4" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs sm:text-sm md:text-base font-bold text-foreground block whitespace-normal break-words">
                            {h.name}
                          </span>
                          {/* Mobile view stacked tags/description */}
                          <div className="flex flex-col gap-1 mt-1 md:hidden leading-normal text-muted-foreground font-normal">
                            <span className={cn(
                              "px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-widest w-fit shrink-0",
                              h.type === 'public' ? "bg-indigo-100 text-indigo-700" : h.type === 'company' ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {h.type}
                            </span>
                            {h.description && (
                              <span className="text-[10px] font-medium text-muted-foreground whitespace-normal break-words">
                                {h.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-muted-foreground text-xs sm:text-sm whitespace-nowrap">
                      {new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className={cn(
                        "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
                        h.type === 'public' ? "bg-indigo-100 text-indigo-700" : h.type === 'company' ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {h.type}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground font-medium max-w-xs truncate">
                      {h.description || "Public Holiday"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right pr-6 py-4">
                        <div className="flex flex-col sm:flex-row justify-end items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditingItem(h); setOpen(true); }} className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary shrink-0">
                            <Edit2 className="size-3" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteHoliday(h.id)} className="size-8 rounded-lg hover:bg-rose-100 hover:text-rose-600 shrink-0">
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
        </div>
      )}
    </div>
  );
}
