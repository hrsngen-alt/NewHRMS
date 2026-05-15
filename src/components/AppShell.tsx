import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { 
  LayoutDashboard, Users, Clock, CalendarDays, Wallet, FileText, 
  LogOut, Settings, Sparkles, Sun, Moon, Bell, BarChart3, Info, CheckCircle2, AlertTriangle, AlertCircle, Award, User, QrCode,
  Megaphone, FolderOpen, Receipt, Calendar as CalendarIcon, Search, Menu, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavItem = { to: string; label: string; icon: any; adminOnly?: boolean; external?: boolean };
const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Employees", icon: Users, adminOnly: true },
  { to: "/attendance", label: "Attendance", icon: Clock },
  { to: "/monthly-attendance", label: "Monthly Attendance", icon: CalendarIcon, adminOnly: true },
  { to: "/leaves", label: "Leaves", icon: CalendarDays },
  { to: "/performance", label: "Performance", icon: Award },
  { to: "/payroll", label: "Payroll", icon: Wallet, adminOnly: true },
  { to: "/reports", label: "Reports", icon: BarChart3, adminOnly: true },
  { to: "/payslips", label: "Salary Slips", icon: FileText },
  { to: "/profile", label: "My Profile", icon: User },
  { to: "/kiosk", label: "Kiosk Terminal", icon: QrCode, adminOnly: true, external: true },
  { to: "/settings", label: "Settings", icon: Settings, adminOnly: true },
  { to: "/resignation", label: "Resignation", icon: LogOut },
];

const essNav: NavItem[] = [
  { to: "/announcements", label: "SN Gene Bulletin", icon: Megaphone },
  { to: "/holidays", label: "Holidays", icon: CalendarIcon },
  { to: "/directory", label: "Team Directory", icon: Search },
  { to: "/documents", label: "Policy Hub", icon: FolderOpen },
  { to: "/expenses", label: "Expense Claims", icon: Receipt },
];

function NavContent({ role, location, onNavClick }: { role: string | null, location: any, onNavClick?: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-2 -mr-2 custom-scrollbar py-4">
      <nav className="space-y-1">
        <p className="px-3 mb-2 text-[10px] font-black text-sidebar-foreground/40 md:text-sidebar-foreground/40 text-muted-foreground/60 uppercase tracking-widest">Main Menu</p>
        {nav.filter((n) => !n.adminOnly || role === "admin").map((n) => {
          const active = location.pathname.startsWith(n.to);
          const content = (
            <>
              <n.icon className={cn("size-5 transition-transform duration-300 group-hover:scale-110", active ? "text-white" : "text-muted-foreground/40")} /> 
              {n.label}
            </>
          );

          if (n.external) {
            return (
              <a key={n.to} href={n.to} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 group text-foreground hover:bg-primary/10 hover:text-primary md:text-sidebar-foreground md:hover:bg-sidebar-accent md:hover:text-white">
                {content}
              </a>
            );
          }

          return (
            <Link key={n.to} to={n.to} onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 group",
                active 
                  ? "bg-primary text-white shadow-lg shadow-primary/30" 
                  : "text-foreground hover:bg-primary/10 hover:text-primary md:text-sidebar-foreground md:hover:bg-sidebar-accent md:hover:text-white"
              )}>
              {content}
            </Link>
          );
        })}
      </nav>

      <nav className="space-y-1">
        <p className="px-3 mb-2 text-[10px] font-black text-sidebar-foreground/40 md:text-sidebar-foreground/40 text-muted-foreground/60 uppercase tracking-widest">Employee Services</p>
        {essNav.map((n) => {
          const active = location.pathname.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 group",
                active 
                  ? "bg-primary text-white shadow-lg shadow-primary/30" 
                  : "text-foreground hover:bg-primary/10 hover:text-primary md:text-sidebar-foreground md:hover:bg-sidebar-accent md:hover:text-white"
              )}>
              <n.icon className={cn("size-5 transition-transform duration-300 group-hover:scale-110", active ? "text-white" : "text-muted-foreground/40")} /> 
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

import { SNLogo } from "@/components/SNLogo";

export function AppShell({ children }: { children?: ReactNode }) {
  const qc = useQueryClient();
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return data;
    },
  });

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    await supabase.from("notifications" as any).update({ is_read: true }).eq("user_id", user?.id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  const clearAll = async () => {
    if (notifications.length === 0) return;
    if (!confirm("Are you sure you want to clear all notifications?")) return;
    await supabase.from("notifications" as any).delete().eq("user_id", user?.id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    toast.success("Notifications cleared");
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };

  useEffect(() => {
    // Only navigate if we're not already on the login page to avoid loops
    // Also check if we're actually logged out and not just loading
    if (!loading && !user && location.pathname !== "/login") {
      console.log("[AppShell] User not authenticated, redirecting to login...");
      navigate({ to: "/login" });
    }
  }, [loading, user, navigate, location.pathname]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
            <SNLogo className="size-8" />
          </div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Initializing SN Gene HR...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background font-sans transition-colors duration-300">
      <aside className="hidden w-72 shrink-0 flex-col bg-sidebar border-r border-sidebar-border p-6 text-sidebar-foreground md:flex shadow-2xl relative z-10">
        <Link to="/dashboard" className="mb-10 flex items-center gap-3 px-2">
          <div className="size-10 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-primary/20">
            <SNLogo className="size-8" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-xl font-black tracking-tight text-white leading-none">SN Gene HR</span>
            <span className="text-[10px] font-bold text-primary tracking-widest uppercase mt-1">Enterprise</span>
          </div>
        </Link>
        
        <NavContent role={role} location={location} />

        <div className="space-y-4 border-t border-sidebar-border/50 pt-8 mt-6">
          <Link to="/profile" className="flex items-center gap-3 px-2 group hover:opacity-80 transition-opacity">
            <div className="size-10 rounded-full bg-sidebar-accent flex items-center justify-center text-white font-black border-2 border-primary/20 shadow-inner group-hover:border-primary/50 transition-colors">
               {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="truncate text-sm font-black text-white group-hover:text-primary transition-colors">{user.email?.split('@')[0]}</div>
              <div className="text-[10px] text-primary uppercase tracking-wider font-black">{role ?? "EMPLOYEE"}</div>
            </div>
          </Link>
          <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-rose-400 hover:bg-rose-500/10 transition-all group">
            <LogOut className="size-5 transition-transform group-hover:-translate-x-1" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden flex flex-col">
        <header className="flex items-center justify-between border-b bg-card/40 px-4 md:px-8 py-5 backdrop-blur-xl sticky top-0 z-20 transition-colors duration-300">
          <div className="flex items-center gap-4">
             <Sheet>
               <SheetTrigger asChild>
                 <Button variant="outline" size="icon" className="md:hidden rounded-xl border-2 shadow-sm">
                   <Menu className="size-5" />
                 </Button>
               </SheetTrigger>
               <SheetContent side="left" className="w-[300px] p-6 flex flex-col">
                 <SheetHeader className="text-left mb-6">
                   <SheetTitle className="flex items-center gap-3">
                     <div className="size-8 rounded-lg bg-white flex items-center justify-center">
                       <SNLogo className="size-6" />
                     </div>
                     <span className="font-display font-black text-xl">SN Gene HR</span>
                   </SheetTitle>
                 </SheetHeader>
                 <NavContent role={role} location={location} onNavClick={() => {}} />
                 <div className="mt-auto pt-6 border-t">
                    <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-50 transition-all">
                      <LogOut className="size-5" /> Sign out
                    </button>
                 </div>
               </SheetContent>
             </Sheet>

             <div className="md:hidden flex items-center gap-2">
                <div className="size-8 rounded-lg bg-white flex items-center justify-center">
                   <SNLogo className="size-6" />
                </div>
                <span className="font-display font-black text-lg text-foreground">SN Gene HR</span>
             </div>
             
             <div className="hidden md:flex items-center gap-6">
                <div className="h-4 w-px bg-border" />
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{location.pathname.replace('/', '').replace('-', ' ') || 'Dashboard'}</div>
             </div>
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu onOpenChange={(open) => open && markAllAsRead()}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl border-2 hover:bg-primary/10 hover:text-primary transition-all shadow-sm relative group">
                  <Bell className="size-4 group-hover:rotate-12 transition-transform" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 border-2 border-background text-[8px] font-bold text-white flex items-center justify-center">
                        {unreadCount}
                      </span>
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 rounded-2xl p-2 shadow-elegant border-2 border-primary/5">
                <DropdownMenuLabel className="font-black text-xs uppercase tracking-widest px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      Notifications
                      {unreadCount > 0 && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{unreadCount} New</span>}
                    </div>
                    {notifications.length > 0 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); clearAll(); }} 
                        className="text-[9px] font-black text-rose-500 hover:text-rose-600 transition-colors bg-rose-50 px-2 py-1 rounded-lg"
                      >
                        Clear All
                      </button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-96 overflow-y-auto space-y-1 p-1">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground font-medium">No recent notifications.</div>
                   ) : notifications.map((n: any) => (
                    <DropdownMenuItem key={n.id} className="rounded-xl p-3 flex gap-3 cursor-default focus:bg-primary/5 group/item relative">
                       <div className={cn(
                         "size-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                         n.type === 'success' ? "bg-green-100 text-green-600" :
                         n.type === 'warning' ? "bg-amber-100 text-amber-600" :
                         n.type === 'error' ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"
                       )}>
                         {n.type === 'success' ? <CheckCircle2 className="size-4" /> :
                          n.type === 'warning' ? <AlertTriangle className="size-4" /> :
                          n.type === 'error' ? <AlertCircle className="size-4" /> : <Info className="size-4" />}
                       </div>
                       <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                          <p className={cn("text-xs font-bold leading-none truncate", !n.is_read && "text-primary")}>{n.title}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{n.message}</p>
                          <p className="text-[8px] font-black uppercase text-muted-foreground/40 mt-1">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                       </div>
                       <button 
                         onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                         className="absolute top-2 right-2 size-5 rounded-md flex items-center justify-center text-muted-foreground hover:bg-rose-50 hover:text-rose-500 opacity-0 group-hover/item:opacity-100 transition-all"
                       >
                          <X className="size-3" />
                       </button>
                    </DropdownMenuItem>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="justify-center text-[10px] font-black uppercase tracking-widest text-primary cursor-pointer rounded-xl">
                   View All Activity
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-9 w-px bg-border mx-2" />
            <Button 
              variant="outline" 
              size="icon" 
              onClick={toggleTheme}
              className="rounded-xl border-2 hover:bg-primary/10 hover:text-primary transition-all shadow-sm group"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
               {theme === 'light' ? (
                 <Moon className="size-4 transition-transform group-hover:rotate-12" />
               ) : (
                 <Sun className="size-4 transition-transform group-hover:rotate-45" />
               )}
            </Button>
            <div className="h-9 w-px bg-border mx-2" />
            <Button variant="outline" size="icon" className="rounded-full border-2 hover:bg-primary/10 hover:text-primary transition-all shadow-sm" asChild>
               <Link to="/settings"><Settings className="size-4" /></Link>
            </Button>
          </div>
        </header>
        
        <div className="p-8 max-w-[1600px] mx-auto w-full flex-1">
           {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}


