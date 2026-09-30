import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Clock, CalendarDays, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const location = useLocation();

  const navItems = [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/attendance", label: "Attendance", icon: Clock },
    { to: "/leaves", label: "Leaves", icon: CalendarDays },
    { to: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 rounded-xl transition-colors",
                isActive 
                  ? "text-primary font-bold" 
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              )}
            >
              <item.icon className={cn("size-5", isActive && "animate-in zoom-in-75 duration-300")} />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
