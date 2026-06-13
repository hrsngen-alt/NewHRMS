import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LeaveConfigTab() {
  const qc = useQueryClient();

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["admin-leave-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_types" as any).select("*").order("name");
      if (error) {
        if (error.code === '42P01') return []; // table doesn't exist yet
        throw error;
      }
      return data || [];
    }
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ["admin-holidays"],
    queryFn: async () => {
      const { data, error } = await supabase.from("holidays" as any).select("*").order("date");
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return data || [];
    }
  });

  const [newType, setNewType] = useState({ code: "", name: "", is_paid: "true", default_annual_allowance: 0 });
  const addLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("leave_types" as any).insert({
      code: newType.code.toUpperCase(),
      name: newType.name,
      is_paid: newType.is_paid === "true",
      default_annual_allowance: newType.default_annual_allowance
    });
    if (error) return toast.error(error.message);
    toast.success("Leave Type Added");
    setNewType({ code: "", name: "", is_paid: "true", default_annual_allowance: 0 });
    qc.invalidateQueries({ queryKey: ["admin-leave-types"] });
  };

  const deleteLeaveType = async (id: string) => {
    if (!confirm("Delete this leave type?")) return;
    const { error } = await supabase.from("leave_types" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-leave-types"] });
  };

  const [newHoliday, setNewHoliday] = useState({ date: "", name: "", is_mandatory: "true" });
  const addHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("holidays" as any).insert({
      date: newHoliday.date,
      name: newHoliday.name,
      is_mandatory: newHoliday.is_mandatory === "true"
    });
    if (error) return toast.error(error.message);
    toast.success("Holiday Added");
    setNewHoliday({ date: "", name: "", is_mandatory: "true" });
    qc.invalidateQueries({ queryKey: ["admin-holidays"] });
  };

  const deleteHoliday = async (id: string) => {
    if (!confirm("Delete this holiday?")) return;
    const { error } = await supabase.from("holidays" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-holidays"] });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Leave Types Configuration */}
      <Card className="rounded-2xl border-2 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <CardTitle className="text-lg font-black">Leave Types Configuration</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <form onSubmit={addLeaveType} className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 flex-1 min-w-[120px]">
              <Label className="text-xs">Code</Label>
              <Input required value={newType.code} onChange={e => setNewType({ ...newType, code: e.target.value })} placeholder="e.g. SL" />
            </div>
            <div className="space-y-1.5 flex-2 min-w-[200px]">
              <Label className="text-xs">Name</Label>
              <Input required value={newType.name} onChange={e => setNewType({ ...newType, name: e.target.value })} placeholder="e.g. Sick Leave" />
            </div>
            <div className="space-y-1.5 w-24">
              <Label className="text-xs">Paid?</Label>
              <Select value={newType.is_paid} onValueChange={val => setNewType({ ...newType, is_paid: val })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-24">
              <Label className="text-xs">Days/Yr</Label>
              <Input type="number" min="0" required value={newType.default_annual_allowance} onChange={e => setNewType({ ...newType, default_annual_allowance: Number(e.target.value) })} />
            </div>
            <Button type="submit" size="icon" className="shrink-0"><Plus className="size-4" /></Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Allowance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveTypes.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-bold">{t.code}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{t.is_paid ? "Paid" : "Unpaid"}</TableCell>
                  <TableCell>{t.default_annual_allowance} days</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => deleteLeaveType(t.id)} className="text-red-500">
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {leaveTypes.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No leave types found. Please run the SQL migration.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Holidays Configuration */}
      <Card className="rounded-2xl border-2 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <CardTitle className="text-lg font-black">Company Holidays</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <form onSubmit={addHoliday} className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 flex-1 min-w-[150px]">
              <Label className="text-xs">Date</Label>
              <Input type="date" required value={newHoliday.date} onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })} />
            </div>
            <div className="space-y-1.5 flex-2 min-w-[200px]">
              <Label className="text-xs">Holiday Name</Label>
              <Input required value={newHoliday.name} onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })} placeholder="e.g. Christmas" />
            </div>
            <div className="space-y-1.5 w-32">
              <Label className="text-xs">Mandatory?</Label>
              <Select value={newHoliday.is_mandatory} onValueChange={val => setNewHoliday({ ...newHoliday, is_mandatory: val })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">Optional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="icon" className="shrink-0"><Plus className="size-4" /></Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell className="font-bold">{new Date(h.date).toLocaleDateString()}</TableCell>
                  <TableCell>{h.name}</TableCell>
                  <TableCell>{h.is_mandatory ? "Mandatory" : "Optional"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => deleteHoliday(h.id)} className="text-red-500">
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {holidays.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No holidays found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
