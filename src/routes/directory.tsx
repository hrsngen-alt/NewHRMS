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
          <Table className="w-full table-fixed md:table-auto">
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="pl-4 sm:pl-6 h-12 text-xs sm:text-sm font-semibold whitespace-nowrap w-[45%] md:w-[20%]">Employee</TableHead>
                <TableHead className="px-3 sm:px-4 h-12 text-xs sm:text-sm font-semibold whitespace-nowrap w-[55%] md:w-[25%]">Contact Info</TableHead>
                <TableHead className="hidden md:table-cell px-4 h-12 text-xs sm:text-sm font-semibold whitespace-nowrap md:w-[15%]">Department</TableHead>
                <TableHead className="hidden md:table-cell px-4 h-12 text-xs sm:text-sm font-semibold whitespace-nowrap md:w-[25%]">Designation</TableHead>
                <TableHead className="hidden md:table-cell pr-6 h-12 text-right text-xs sm:text-sm font-semibold whitespace-nowrap md:w-[15%]">Employee ID</TableHead>
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
                    <TableCell className="pl-4 sm:pl-6 py-3 overflow-hidden">
                      <div className="flex items-center gap-3">
                        <div className="hidden xs:flex size-10 rounded-full bg-primary/10 items-center justify-center text-primary font-bold shadow-sm shrink-0">
                          {e.full_name?.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0 w-full">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm whitespace-normal break-words max-w-full">
                            {e.full_name}
                          </span>
                          {/* Mobile-only stacked column info */}
                          <div className="flex flex-col min-w-0 w-full gap-0.5 mt-0.5 md:hidden text-[10px] text-muted-foreground leading-normal">
                            <span className="font-medium truncate max-w-full">{e.designation || "No Designation"}</span>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[8px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                {e.department || "No Department"}
                              </span>
                              <span className="font-mono text-muted-foreground/80 font-bold text-[8px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                {e.employee_code || "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 sm:px-4 py-3 overflow-hidden">
                      <div className="flex flex-col gap-0.5 sm:gap-1 text-xs sm:text-sm text-muted-foreground min-w-0 w-full">
                        {e.email ? (
                          <a href={`mailto:${e.email}`} className="flex items-center gap-1.5 sm:gap-2 hover:text-primary transition-colors cursor-pointer w-fit min-w-0 max-w-full">
                            <Mail className="size-3.5 shrink-0" />
                            <span className="truncate max-w-[110px] sm:max-w-[200px]">{e.email}</span>
                          </a>
                        ) : (
                          <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground/50 w-fit min-w-0 max-w-full">
                            <Mail className="size-3.5 shrink-0" />
                            <span className="truncate max-w-[110px] sm:max-w-[200px]">Not shared</span>
                          </div>
                        )}
                        {e.phone && (
                          <a href={`tel:${e.phone}`} className="flex items-center gap-1.5 sm:gap-2 hover:text-primary transition-colors cursor-pointer w-fit min-w-0 max-w-full">
                            <Phone className="size-3.5 shrink-0" />
                            <span className="whitespace-nowrap">{e.phone}</span>
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-4 py-3 overflow-hidden">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 max-w-full truncate block w-fit">
                        {e.department || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell px-4 py-3 overflow-hidden">
                      <span className="font-medium text-slate-700 dark:text-slate-300 max-w-full truncate sm:whitespace-normal block">
                        {e.designation || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell pr-6 py-3 text-right font-mono text-xs sm:text-sm text-muted-foreground font-bold whitespace-nowrap overflow-hidden">
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
