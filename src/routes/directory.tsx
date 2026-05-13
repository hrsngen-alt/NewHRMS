import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Mail, Phone, Users, Filter } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/directory")({ component: () => <AppShell><DirectoryPage /></AppShell> });

function DirectoryPage() {
  const [q, setQ] = useState("");
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employee-directory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, full_name, department, designation, employee_code, email, phone, status").eq("status", "active").order("full_name");
      if (error) return [];
      return data;
    },
  });

  const filtered = employees.filter((e: any) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return e.full_name?.toLowerCase().includes(s) || e.department?.toLowerCase().includes(s) || e.designation?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-4xl font-black tracking-tight text-foreground">Team Directory</h1>
          <p className="text-muted-foreground font-medium text-lg">Connect with your colleagues across the SN Genec network.</p>
        </div>
        <div className="relative w-full max-w-md group">
          <Search className="absolute left-4 top-4 size-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search by name, department, or role..." 
            className="pl-12 h-14 rounded-2xl border-2 shadow-sm focus:border-primary/50 transition-all text-lg font-medium"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 rounded-3xl border bg-card animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-32 text-center flex flex-col items-center gap-6 border-2 border-dashed rounded-[3rem]">
             <div className="size-20 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground/30">
                <Users className="size-10" />
             </div>
             <div className="space-y-1">
                <p className="font-black text-foreground text-xl tracking-tight">No teammates found</p>
                <p className="text-muted-foreground font-medium">Try adjusting your search query.</p>
             </div>
          </div>
        ) : filtered.map((e: any) => (
          <div key={e.id} className="rounded-[2.5rem] border-2 border-primary/5 bg-card p-6 shadow-card hover:shadow-elegant transition-all group relative overflow-hidden active:scale-95">
             <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Users className="size-24 text-primary" />
             </div>
             
             <div className="flex flex-col items-center text-center">
                <div className="size-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary font-black text-3xl shadow-inner mb-4 group-hover:scale-110 transition-transform">
                   {e.full_name?.charAt(0)}
                </div>
                <h3 className="text-xl font-black tracking-tight text-foreground line-clamp-1">{e.full_name}</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary mt-1">{e.designation}</p>
                <div className="mt-2 px-3 py-1 rounded-full bg-muted font-bold text-[10px] text-muted-foreground uppercase tracking-widest">
                   {e.department}
                </div>
             </div>

             <div className="mt-8 pt-8 border-t border-dashed space-y-3">
                <div className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors cursor-pointer group/item">
                   <div className="size-8 rounded-xl bg-muted group-hover/item:bg-primary/10 flex items-center justify-center transition-colors">
                      <Mail className="size-4" />
                   </div>
                   <span className="text-xs font-bold truncate">{e.email || "Not shared"}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors cursor-pointer group/item">
                   <div className="size-8 rounded-xl bg-muted group-hover/item:bg-primary/10 flex items-center justify-center transition-colors">
                      <Phone className="size-4" />
                   </div>
                   <span className="text-xs font-bold">{e.phone || "Not shared"}</span>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
