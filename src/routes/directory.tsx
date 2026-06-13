import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Mail, Phone, Users, ChevronLeft, ChevronRight, User } from "lucide-react";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/directory")({ component: () => <AppShell><DirectoryPage /></AppShell> });

function DirectoryPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

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
    return e.full_name?.toLowerCase().includes(s) || 
           e.department?.toLowerCase().includes(s) || 
           e.designation?.toLowerCase().includes(s) ||
           e.email?.toLowerCase().includes(s) ||
           e.employee_code?.toLowerCase().includes(s);
  });

  // Reset pagination when search query changes
  useEffect(() => {
    setPage(1);
  }, [q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginatedEmployees = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Users className="size-8 text-primary" /> Team Directory
          </h1>
          <p className="text-muted-foreground font-medium text-sm md:text-base">Find and connect with your colleagues.</p>
        </div>
        <div className="relative w-full max-w-md group">
          <Search className="absolute left-4 top-3.5 size-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search by name, ID, or email..." 
            className="pl-12 h-12 rounded-xl border-2 shadow-sm focus:border-primary/50 transition-all font-medium"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl border-2 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="pl-6 h-12">Employee</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead className="text-right pr-6">Employee ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5} className="h-16 px-6">
                      <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Users className="size-10 mb-2 opacity-20" />
                      <p className="font-bold">No teammates found</p>
                      <p className="text-sm">Try adjusting your search query.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEmployees.map((e: any) => (
                  <TableRow key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm shrink-0">
                          {e.full_name?.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{e.full_name}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer w-fit">
                          <Mail className="size-3.5" />
                          <span className="truncate max-w-[200px]">{e.email || "Not shared"}</span>
                        </div>
                        {e.phone && (
                          <div className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer w-fit">
                            <Phone className="size-3.5" />
                            <span>{e.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        {e.department || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {e.designation || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6 font-mono text-sm text-muted-foreground font-bold">
                      {e.employee_code || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination Controls */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-sm text-muted-foreground font-medium">
              Showing <span className="font-bold text-foreground">{(page - 1) * perPage + 1}</span> to <span className="font-bold text-foreground">{Math.min(page * perPage, filtered.length)}</span> of <span className="font-bold text-foreground">{filtered.length}</span> employees
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="text-sm font-bold w-12 text-center">
                {page} / {totalPages}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
