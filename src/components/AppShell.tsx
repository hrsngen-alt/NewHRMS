import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { 
  LayoutDashboard, Users, Clock, CalendarDays, Wallet, FileText, 
  LogOut, Settings, Sparkles, Sun, Moon, Bell, BarChart3, Info, CheckCircle2, AlertTriangle, AlertCircle, Award, User, QrCode,
  Megaphone, FolderOpen, Receipt, Calendar as CalendarIcon, Search, Menu, X, IndianRupee, Fingerprint
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

type NavItem = { to: string; label: string; icon: any; allowedRoles?: ("admin" | "manager" | "employee")[]; external?: boolean };
const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Employees", icon: Users, allowedRoles: ["admin"] },
  { to: "/employee-360", label: "Employee 360", icon: Sparkles, allowedRoles: ["admin", "manager"] },
  { to: "/attendance", label: "Attendance", icon: Clock },
  { to: "/monthly-attendance", label: "Monthly Attendance", icon: CalendarIcon, allowedRoles: ["admin", "manager"] },
  { to: "/leaves", label: "Leaves", icon: CalendarDays },
  { to: "/performance", label: "Performance", icon: Award },
  { to: "/payroll", label: "Payroll", icon: Wallet, allowedRoles: ["admin"] },
  { to: "/salary-structure", label: "Salary Structure", icon: IndianRupee, allowedRoles: ["admin"] },
  { to: "/reports", label: "Reports", icon: BarChart3, allowedRoles: ["admin", "manager"] },
  { to: "/payslips", label: "Salary Slips", icon: FileText },
  { to: "/profile", label: "My Profile", icon: User },
  { to: "/kiosk", label: "Kiosk Terminal", icon: QrCode, allowedRoles: ["admin"], external: true },
  { to: "/settings", label: "Settings", icon: Settings, allowedRoles: ["admin"] },
  { to: "/resignation", label: "Resignation", icon: LogOut },
];

const essNav: NavItem[] = [
  { to: "/announcements", label: "SN Gene Bulletin", icon: Megaphone },
  { to: "/holidays", label: "Holidays", icon: CalendarIcon },
  { to: "/directory", label: "Team Directory", icon: Search },
  { to: "/documents", label: "Policy Hub", icon: FolderOpen },
  { to: "/expenses", label: "Expense Claims", icon: Receipt },
];

const ROUTE_PERMISSIONS: Record<string, { module: string; action: string; requireWiderScope?: boolean }> = {
  "/employees": { module: "Employee Directory", action: "view" },
  "/employee-360": { module: "Performance Management", action: "view" },
  "/attendance": { module: "Attendance", action: "view" },
  "/monthly-attendance": { module: "Attendance", action: "view", requireWiderScope: true },
  "/leaves": { module: "Leave", action: "view" },
  "/performance": { module: "Performance Management", action: "view" },
  "/payroll": { module: "Payroll", action: "view" },
  "/salary-structure": { module: "Payroll", action: "manage" },
  "/reports": { module: "Reports", action: "view" },
  "/kiosk": { module: "Attendance", action: "manage" },
  "/settings": { module: "Settings", action: "view" },
  "/announcements": { module: "Announcements", action: "view" },
  "/holidays": { module: "Holidays", action: "view" },
  "/directory": { module: "Employee Directory", action: "view" },
};

function NavContent({ role, location, onNavClick }: { role: string | null, location: any, onNavClick?: () => void }) {
  const { hasPermission, getScope } = usePermissions();

  const isRouteAllowed = (to: string) => {
    const requirement = ROUTE_PERMISSIONS[to];
    if (!requirement) return true; // public/self-service routes
    
    const permitted = hasPermission(requirement.module, requirement.action);
    if (!permitted) return false;

    if (requirement.requireWiderScope) {
      const scope = getScope(requirement.module, requirement.action);
      const hasApprove = hasPermission(requirement.module, "approve");
      const hasManage = hasPermission(requirement.module, "manage");
      return scope !== "self" || hasApprove || hasManage;
    }

    return true;
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-2 -mr-2 custom-scrollbar py-4">
      <nav className="space-y-1">
        <p className="px-3 mb-2 text-[10px] font-black text-sidebar-foreground/40 md:text-sidebar-foreground/40 text-muted-foreground/60 uppercase tracking-widest">Main Menu</p>
        {nav.filter((n) => isRouteAllowed(n.to)).map((n) => {
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
        {essNav.filter((n) => isRouteAllowed(n.to)).map((n) => {
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

// Global lock state to persist across TanStack Router unmounts/remounts
let isAppUnlockedGlobally = false;

export function AppShell({ children }: { children?: ReactNode }) {
  const qc = useQueryClient();
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [pullStart, setPullStart] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        setPullStart(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (pullStart === null || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const dist = currentY - pullStart;

      if (dist > 0 && window.scrollY === 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        setPullDistance(Math.min(dist * 0.4, 120));
      } else {
        setPullStart(null);
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (pullStart === null || isRefreshing) return;

      if (pullDistance > 60) {
        setIsRefreshing(true);
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        setPullDistance(0);
      }
      setPullStart(null);
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullStart, pullDistance, isRefreshing]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  const [isAppLocked, setIsAppLocked] = useState(() => {
    if (typeof window !== "undefined") {
      const passcodeEnabled = localStorage.getItem("pwa_passcode_enabled") === "true";
      if (passcodeEnabled) {
        return !isAppUnlockedGlobally;
      }
    }
    return false;
  });

  const handleSignOut = () => {
    isAppUnlockedGlobally = false;
    signOut();
  };
  const [pinInput, setPinInput] = useState("");
  const [isAuthenticatingBiometrics, setIsAuthenticatingBiometrics] = useState(false);

  // Helper to check if biometrics is enabled
  const isBiometricsEnabled = typeof window !== "undefined" && 
    localStorage.getItem("pwa_passcode_enabled") === "true" &&
    localStorage.getItem("pwa_biometrics_enabled") === "true";

  // Trigger WebAuthn Biometric unlock
  const handleBiometricUnlock = async () => {
    if (!isBiometricsEnabled || isAuthenticatingBiometrics) return;
    setIsAuthenticatingBiometrics(true);
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const options: CredentialRequestOptions = {
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: "required",
        },
      };

      const assertion = await navigator.credentials.get(options);
      if (assertion) {
        isAppUnlockedGlobally = true;
        setIsAppLocked(false);
        setPinInput("");
        toast.success("Unlocked with biometrics");
      }
    } catch (err: any) {
      console.error("Biometric unlock error:", err);
      // Don't show error if they manually cancelled
      if (err.name !== "NotAllowedError") {
        toast.error("Biometric authentication failed");
      }
    } finally {
      setIsAuthenticatingBiometrics(false);
    }
  };

  // Run biometric unlock automatically when screen is locked on mount
  useEffect(() => {
    if (isAppLocked && isBiometricsEnabled) {
      const timer = setTimeout(() => {
        handleBiometricUnlock();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAppLocked]);

  // Listener for visibility changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const passcodeEnabled = localStorage.getItem("pwa_passcode_enabled") === "true";
        if (passcodeEnabled && !isAuthenticatingBiometrics) {
          isAppUnlockedGlobally = false;
          setIsAppLocked(true);
          setPinInput("");
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticatingBiometrics]);

  // Handle dialpad press
  const handleKeyPress = async (num: string) => {
    if (pinInput.length >= 4) return;
    
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(20);
    }

    const nextPin = pinInput + num;
    setPinInput(nextPin);

    if (nextPin.length === 4) {
      // Verify PIN
      const encoder = new TextEncoder();
      const data = encoder.encode(nextPin);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      const storedHash = localStorage.getItem("pwa_passcode_hash");
      if (hash === storedHash) {
        isAppUnlockedGlobally = true;
        setIsAppLocked(false);
        setPinInput("");
      } else {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([50, 50]);
        }
        toast.error("Incorrect Passcode");
        setTimeout(() => {
          setPinInput("");
        }, 200);
      }
    }
  };

  const handleBackspace = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(15);
    }
    setPinInput(prev => prev.slice(0, -1));
  };

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

  useEffect(() => {
    if (!user) return;

    // Request browser notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    // Subscribe to new notifications in real-time
    const channel = supabase
      .channel(`realtime-notifications-${user.id}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          console.log("[AppShell] Real-time notification received:", payload.new);
          // Invalidate notifications query to refresh badge and dropdown list
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });

          // 1. Show real-time in-app toast fallback
          toast(payload.new.title || "New Notification", {
            description: payload.new.message || "",
            action: {
              label: "View",
              onClick: () => {
                const link = payload.new.link || getNotificationFallbackLink(payload.new);
                if (link) navigate({ to: link });
              }
            }
          });

          // 2. Show browser notification
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            const title = payload.new.title || "New Notification";
            const options = {
              body: payload.new.message || "",
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: payload.new.id,
            };
            const notif = new Notification(title, options);
            notif.onclick = () => {
              window.focus();
              const link = payload.new.link || getNotificationFallbackLink(payload.new);
              if (link) {
                navigate({ to: link });
              }
            };
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc, navigate]);

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      const { error } = await supabase.from("notifications" as any).update({ is_read: true }).eq("user_id", user?.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    } catch (err: any) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const clearAll = async () => {
    if (notifications.length === 0) return;
    if (!confirm("Are you sure you want to clear all notifications?")) return;
    try {
      const { error } = await supabase.from("notifications" as any).delete().eq("user_id", user?.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
      toast.success("Notifications cleared");
    } catch (err: any) {
      console.error("Failed to clear notifications:", err);
      toast.error("Failed to clear notifications: " + err.message);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase.from("notifications" as any).delete().eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    } catch (err: any) {
      console.error("Failed to delete notification:", err);
      toast.error("Failed to delete notification: " + err.message);
    }
  };

  const getNotificationFallbackLink = (n: any) => {
    const title = (n.title || "").toLowerCase();
    const msg = (n.message || "").toLowerCase();
    if (title.includes("resignation") || msg.includes("resignation")) {
      return "/resignation";
    }
    if (
      title.includes("announcement") ||
      title.includes("bulletin") ||
      title.includes("event") ||
      msg.includes("announcement") ||
      msg.includes("bulletin") ||
      msg.includes("event")
    ) {
      return "/announcements";
    }
    if (title.includes("appraisal") || title.includes("performance") || msg.includes("appraisal") || msg.includes("performance")) {
      return "/performance";
    }
    return null;
  };

  const handleNotificationClick = async (n: any) => {
    try {
      if (!n.is_read) {
        const { error } = await supabase.from("notifications" as any).update({ is_read: true }).eq("id", n.id);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }

    const targetLink = n.link || getNotificationFallbackLink(n);
    if (targetLink) {
      navigate({ to: targetLink });
    }
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
          <div className="h-16 w-40 rounded-2xl bg-white p-2.5 flex items-center justify-center animate-pulse shadow-md">
            <SNLogo className="h-10 w-auto" />
          </div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Initializing SN Gene Lab...</p>
        </div>
      </div>
    );
  }

  if (isAppLocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-2xl text-white select-none">
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-6px); }
            40%, 80% { transform: translateX(6px); }
          }
          .animate-shake {
            animation: shake 0.3s ease-in-out;
          }
          @media (max-height: 500px) {
            .lock-container {
              flex-direction: row !important;
              max-width: 580px !important;
              justify-content: space-between !important;
              gap: 3rem !important;
              text-align: left !important;
              padding: 0 1.5rem !important;
            }
            .lock-info {
              align-items: flex-start !important;
              text-align: left !important;
            }
            .lock-dots {
              margin-top: 1rem !important;
              margin-bottom: 1rem !important;
            }
            .lock-signout-std {
              display: none !important;
            }
            .lock-signout {
              display: flex !important;
            }
          }
        `}</style>

        <div className="lock-container flex flex-col items-center max-w-sm w-full px-8 text-center animate-in fade-in zoom-in-95 duration-500">
          {/* Info Section */}
          <div className="lock-info flex flex-col items-center">
            {/* Avatar/Branding */}
            <div className="relative mb-6">
              <div className="h-16 w-36 rounded-[22px] bg-gradient-to-tr from-primary via-indigo-500 to-purple-600 p-[3px] shadow-2xl shadow-primary/30">
                <div className="size-full rounded-[19px] bg-white p-2 flex items-center justify-center">
                  <SNLogo className="h-10 w-auto" />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-500 border-4 border-slate-950 flex items-center justify-center">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
              </div>
            </div>

            <h2 className="font-display text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              SN Gene Lab
            </h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Workspace Lock
            </p>

            {/* Dots Indicator */}
            <div className={cn(
              "lock-dots flex gap-4 my-8 transition-transform duration-300",
              pinInput.length === 4 && "scale-105"
            )}>
              {[0, 1, 2, 3].map((index) => {
                const active = pinInput.length > index;
                return (
                  <div
                    key={index}
                    className={cn(
                      "size-3.5 rounded-full border-2 border-primary/40 transition-all duration-300",
                      active 
                        ? "bg-primary scale-110 shadow-lg shadow-primary/50 border-primary" 
                        : "bg-transparent"
                    )}
                  />
                );
              })}
            </div>
            
            {/* Signout button for landscape */}
            <button
              onClick={handleSignOut}
              className="lock-signout hidden mt-2 text-[10px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 transition-colors items-center gap-2"
            >
              Sign out
            </button>
          </div>

          {/* Dialpad Section */}
          <div className="flex flex-col items-center">
            <div className="grid grid-cols-3 gap-x-4 gap-y-3 w-full max-w-[240px]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num)}
                  className="size-14 rounded-full border border-white/5 bg-white/5 backdrop-blur-md text-lg font-bold transition-all hover:bg-white/10 active:scale-95 flex items-center justify-center focus:outline-none"
                >
                  {num}
                </button>
              ))}
              
              {/* Biometric trigger */}
              {isBiometricsEnabled ? (
                <button
                  onClick={handleBiometricUnlock}
                  className="size-14 rounded-full border border-primary/10 bg-primary/10 text-primary transition-all hover:bg-primary/25 active:scale-95 flex items-center justify-center focus:outline-none"
                >
                  <Fingerprint className="size-6 animate-pulse" />
                </button>
              ) : (
                <div className="size-14" />
              )}

              <button
                onClick={() => handleKeyPress("0")}
                className="size-14 rounded-full border border-white/5 bg-white/5 backdrop-blur-md text-lg font-bold transition-all hover:bg-white/10 active:scale-95 flex items-center justify-center focus:outline-none"
              >
                0
              </button>

              <button
                onClick={handleBackspace}
                disabled={pinInput.length === 0}
                className="size-14 rounded-full border border-white/5 bg-white/5 backdrop-blur-md transition-all hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none active:scale-95 flex items-center justify-center focus:outline-none"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Standard Signout for portrait */}
          <button
            onClick={handleSignOut}
            className="lock-signout-std mt-10 text-xs font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-2"
          >
            Sign out of account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background font-sans transition-colors duration-300">
      {/* Pull to Refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="fixed left-0 right-0 z-[100] flex justify-center pointer-events-none transition-all duration-200"
          style={{ 
            top: isRefreshing ? '20px' : `${Math.max(-40, pullDistance - 40)}px`,
            opacity: isRefreshing ? 1 : Math.min(1, pullDistance / 60)
          }}
        >
          <div className="size-10 rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl flex items-center justify-center animate-in fade-in zoom-in-75">
            <svg 
              className={cn(
                "size-5 text-primary", 
                isRefreshing ? "animate-spin" : ""
              )}
              style={{
                transform: isRefreshing ? undefined : `rotate(${pullDistance * 4}deg)`
              }}
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.72 2.78L21 8" />
              <polyline points="21 3 21 8 16 8" />
            </svg>
          </div>
        </div>
      )}

      <aside className="hidden w-72 shrink-0 flex-col bg-sidebar border-r border-sidebar-border p-6 text-sidebar-foreground md:flex shadow-2xl relative z-10">
        <Link to="/dashboard" className="mb-10 flex items-center justify-center px-2 shrink-0">
          <div className="h-16 w-40 bg-white rounded-2xl p-2.5 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
            <SNLogo className="h-10 w-auto" />
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
          <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-rose-400 hover:bg-rose-500/10 transition-all group">
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
                   <SheetTitle className="flex items-center">
                     <div className="h-10 w-24 bg-white rounded-xl p-1.5 flex items-center justify-center shadow-sm shrink-0">
                       <SNLogo className="h-7 w-auto" />
                     </div>
                   </SheetTitle>
                 </SheetHeader>
                 <NavContent role={role} location={location} onNavClick={() => {}} />
                 <div className="mt-auto pt-6 border-t">
                    <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-50 transition-all">
                      <LogOut className="size-5" /> Sign out
                    </button>
                 </div>
               </SheetContent>
             </Sheet>

             <div className="md:hidden flex items-center">
                <div className="h-10 w-24 bg-white rounded-xl p-1.5 flex items-center justify-center shadow-sm shrink-0">
                   <SNLogo className="h-7 w-auto" />
                </div>
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
                    <DropdownMenuItem 
                      key={n.id} 
                      onClick={() => handleNotificationClick(n)}
                      className="rounded-xl p-3 flex gap-3 cursor-pointer focus:bg-primary/5 group/item relative"
                    >
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
                       <div className="flex flex-col gap-0.5 min-w-0 pr-4 text-left">
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
            {role === "admin" && (
              <>
                <div className="h-9 w-px bg-border mx-2" />
                <Button variant="outline" size="icon" className="rounded-full border-2 hover:bg-primary/10 hover:text-primary transition-all shadow-sm" asChild>
                   <Link to="/settings"><Settings className="size-4" /></Link>
                </Button>
              </>
            )}
          </div>
        </header>
        
        <div className="p-8 max-w-[1600px] mx-auto w-full flex-1">
           {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}


