import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { Search, LayoutDashboard, Users, CalendarDays, Wallet, FileText, Settings, User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] animate-in fade-in duration-200">
      <div className="w-full max-w-2xl mx-4 bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border">
        <Command className="w-full h-full flex flex-col" label="Global Command Menu">
          <div className="flex items-center border-b px-4">
            <Search className="size-5 mr-3 text-muted-foreground" />
            <Command.Input 
              autoFocus 
              className="flex h-16 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50" 
              placeholder="Search or jump to... (e.g. 'Payroll')" 
            />
            <div className="text-[10px] font-bold text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md ml-2 border uppercase tracking-widest">ESC</div>
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-12 text-center text-sm text-muted-foreground font-medium">No results found.</Command.Empty>
            
            <Command.Group heading="Navigation" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2 mt-2">
              <Command.Item onSelect={() => runCommand(() => navigate({ to: "/dashboard" }))} className="flex items-center px-3 py-3 rounded-xl text-sm font-semibold text-foreground hover:bg-primary/5 hover:text-primary cursor-pointer data-[selected='true']:bg-primary/5 data-[selected='true']:text-primary transition-colors">
                <LayoutDashboard className="mr-3 size-4 opacity-70" /> Dashboard
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate({ to: "/employees" }))} className="flex items-center px-3 py-3 rounded-xl text-sm font-semibold text-foreground hover:bg-primary/5 hover:text-primary cursor-pointer data-[selected='true']:bg-primary/5 data-[selected='true']:text-primary transition-colors">
                <Users className="mr-3 size-4 opacity-70" /> Employee Directory
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate({ to: "/attendance" }))} className="flex items-center px-3 py-3 rounded-xl text-sm font-semibold text-foreground hover:bg-primary/5 hover:text-primary cursor-pointer data-[selected='true']:bg-primary/5 data-[selected='true']:text-primary transition-colors">
                <Clock className="mr-3 size-4 opacity-70" /> Attendance Log
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate({ to: "/leaves" }))} className="flex items-center px-3 py-3 rounded-xl text-sm font-semibold text-foreground hover:bg-primary/5 hover:text-primary cursor-pointer data-[selected='true']:bg-primary/5 data-[selected='true']:text-primary transition-colors">
                <CalendarDays className="mr-3 size-4 opacity-70" /> Leave Management
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate({ to: "/payroll" }))} className="flex items-center px-3 py-3 rounded-xl text-sm font-semibold text-foreground hover:bg-primary/5 hover:text-primary cursor-pointer data-[selected='true']:bg-primary/5 data-[selected='true']:text-primary transition-colors">
                <Wallet className="mr-3 size-4 opacity-70" /> Payroll Processing
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate({ to: "/reports" }))} className="flex items-center px-3 py-3 rounded-xl text-sm font-semibold text-foreground hover:bg-primary/5 hover:text-primary cursor-pointer data-[selected='true']:bg-primary/5 data-[selected='true']:text-primary transition-colors">
                <FileText className="mr-3 size-4 opacity-70" /> Reports & Analytics
              </Command.Item>
            </Command.Group>
            
            <Command.Group heading="Settings" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 py-2 mt-2">
              <Command.Item onSelect={() => runCommand(() => navigate({ to: "/profile" }))} className="flex items-center px-3 py-3 rounded-xl text-sm font-semibold text-foreground hover:bg-primary/5 hover:text-primary cursor-pointer data-[selected='true']:bg-primary/5 data-[selected='true']:text-primary transition-colors">
                <User className="mr-3 size-4 opacity-70" /> My Profile
              </Command.Item>
              <Command.Item onSelect={() => runCommand(() => navigate({ to: "/settings" }))} className="flex items-center px-3 py-3 rounded-xl text-sm font-semibold text-foreground hover:bg-primary/5 hover:text-primary cursor-pointer data-[selected='true']:bg-primary/5 data-[selected='true']:text-primary transition-colors">
                <Settings className="mr-3 size-4 opacity-70" /> System Settings
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
        <div className="bg-slate-50 dark:bg-slate-900/50 border-t p-3 flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-1.5"><Search className="size-3"/> Search anything</span>
          <button onClick={() => setOpen(false)} className="hover:text-foreground transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}
