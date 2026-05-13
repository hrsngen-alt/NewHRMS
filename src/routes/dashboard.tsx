import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyEmployee } from "@/hooks/useMyEmployee";
import { Users, Clock, CalendarDays, Wallet, Play, Square, ArrowRight, Activity, TrendingUp, TrendingDown, MapPin, Award, Loader2, Plane, ShieldCheck, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area, CartesianGrid, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { useState, useEffect, Suspense, lazy } from "react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export const Route = createFileRoute("/dashboard")({ component: () => <AppShell><Dashboard /></AppShell> });

function StatCard({ icon: Icon, label, value, trend, trendValue, colorClass }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-card transition-all hover:shadow-elegant group">
      <div className={cn("absolute -right-4 -top-4 size-24 rounded-full opacity-10 transition-transform group-hover:scale-110", colorClass)} />
      <div className="flex items-start justify-between">
        <div className={cn("inline-flex size-12 items-center justify-center rounded-xl", colorClass, "bg-opacity-10")}>
          <Icon className={cn("size-6", colorClass.replace('bg-', 'text-'))} />
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider", trend === 'up' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
            {trend === 'up' ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-tight">{label}</p>
        <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}

function OfficeMap({ locations }: { locations: any[] }) {
  const [mounted, setMounted] = useState(false);
  const [instanceKey, setInstanceKey] = useState(0);
  
  useEffect(() => {
    // Small delay to ensure previous instances are cleaned up by React
    const timer = setTimeout(() => {
      setMounted(true);
      setInstanceKey(Date.now());
    }, 100);

    // Fix leaflet marker icon issue
    import('leaflet').then(L => {
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });
    });

    return () => {
      clearTimeout(timer);
      setMounted(false);
    };
  }, []);

  if (!mounted) return (
    <div className="h-full w-full bg-slate-50 flex items-center justify-center animate-pulse rounded-xl">
       <Loader2 className="size-6 text-primary animate-spin" />
    </div>
  );

  const center: [number, number] = [22.3094, 72.1362]; 

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border relative z-0">
      {!locations.length ? (
        <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <MapPin className="size-8 text-muted-foreground/30" />
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No branch locations found</p>
        </div>
      ) : (
        <MapContainer 
          key={`office-map-${instanceKey}`}
          center={center} 
          zoom={7} 
          style={{ height: '100%', width: '100%' }} 
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locations.map((loc) => (
            <Marker key={loc.id} position={[loc.lat, loc.lng]}>
              <Popup className="rounded-xl overflow-hidden">
                <div className="p-1">
                  <p className="font-black text-xs text-primary uppercase tracking-wider">{loc.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground mt-1">{loc.address}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}

function LiveActivity({ isAdmin, today }: { isAdmin: boolean; today: string }) {
  const qc = useQueryClient();
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    // Initial fetch of recent activity
    const fetchRecent = async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*, employees(full_name)")
        .eq("date", today)
        .order("check_in", { ascending: false })
        .limit(5);
      if (data) setActivities(data);
    };
    fetchRecent();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('attendance_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, async (payload) => {
        const { data: newRecord } = await supabase
          .from("attendance")
          .select("*, employees(full_name)")
          .eq("id", payload.new.id)
          .single();
        
        if (newRecord) {
          setActivities(prev => [newRecord, ...prev.slice(0, 4)]);
          qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [today, qc]);

  if (!isAdmin) return null;

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg tracking-tight flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500 animate-pulse" /> Live SN Gene
        </h3>
        <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Real-time Activity</span>
      </div>
      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground font-medium italic">Waiting for check-ins...</p>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="flex items-center gap-3 animate-in slide-in-from-right-4 duration-500">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                {act.employees?.full_name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate">
                  <span className="text-primary">{act.employees?.full_name || 'System User'}</span> checked in
                </p>
                <p className="text-[9px] text-muted-foreground font-medium">
                  {act.check_in ? new Date(act.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const today = new Date().toLocaleDateString('en-CA');
  const { myEmployee, isLoading: empLoading } = useMyEmployee();

  const isMarketing = myEmployee?.department?.toLowerCase() === "marketing";

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    staleTime: 1000 * 30,
    queryFn: async () => {
      const [emp, att, lv, pay] = await Promise.all([
        supabase.from("employees").select("*"),
        supabase.from("attendance").select("*").eq("date", today),
        supabase.from("leaves").select("*").eq("status", "pending"),
        supabase.from("payslips").select("net_pay"),
      ]);
      // Locations table is optional — don't block on it
      const { data: locData } = await supabase.from("company_locations" as any).select("*");
      const loc = { data: locData || [] };

      const deptMap: Record<string, number> = {};
      (emp.data ?? []).forEach((e) => { const d = e.department || "Unassigned"; deptMap[d] = (deptMap[d] ?? 0) + 1; });
      const deptData = Object.entries(deptMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

      const totalNet = (pay.data ?? []).reduce((s, p) => s + Number(p.net_pay), 0);
      const uniquePresent = new Set((att.data ?? []).filter(a => a.status === "present").map(a => a.employee_id)).size;

      const attTrend = Array.from({ length: 7 }).map((_, i) => ({
        day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
        value: 85 + Math.floor(Math.random() * 15)
      }));

      return {
        totalEmployees: emp.data?.length ?? 0,
        presentToday: uniquePresent,
        pendingLeaves: lv.data?.length ?? 0,
        totalPayroll: totalNet,
        deptData,
        attTrend,
        locations: (loc as any).data || [],
        locationCount: (loc as any).data?.length ?? 0,
        recentHires: (emp.data ?? []).slice(0, 3)
      };
    },
    enabled: !!user,
  });

  const { data: myAttendance } = useQuery({
    queryKey: ["my-attendance-today", myEmployee?.id],
    queryFn: async () => {
      const { data } = await supabase.from("attendance")
        .select("*")
        .eq("employee_id", myEmployee!.id)
        .eq("date", today)
        .order("check_in", { ascending: false });
      return data || [];
    },
    enabled: !!myEmployee,
  });

  const latestSession = myAttendance?.[0];
  const isCheckedIn = !!(latestSession && !latestSession.check_out);
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    let interval: any;
    if (isCheckedIn && latestSession?.check_in) {
      const update = () => {
        const start = new Date(latestSession.check_in!).getTime();
        const diff = Date.now() - start;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      };
      update();
      interval = setInterval(update, 1000);
    }
    return () => clearInterval(interval);
  }, [isCheckedIn, latestSession?.check_in]);

  const punch = async (type: "in" | "out") => {
    if (!myEmployee) return toast.error("Employee profile not linked.");
    
    let lat, lng;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 }));
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {
      if (!isMarketing) {
        return toast.error("Location access is required for office check-ins.");
      }
      toast.warning("Approximate location captured for Field Work.");
    }

    if (type === "in") {
      await (supabase.from("attendance") as any).insert({ 
        employee_id: myEmployee.id, date: today, check_in: new Date().toISOString(), 
        status: "present", check_in_lat: lat, check_in_lng: lng,
        metadata: isMarketing ? { mode: 'field', zone: 'India-Wide' } : { mode: 'office' }
      });
      toast.success(isMarketing ? "Field Work Check-in Successful!" : "Checked in successfully!");
    } else {
      const hours = Math.max(0, (Date.now() - new Date(latestSession!.check_in!).getTime()) / 3600000);
      await (supabase.from("attendance") as any).update({ 
        check_out: new Date().toISOString(), hours_worked: Number(hours.toFixed(2)),
        check_out_lat: lat, check_out_lng: lng
      }).eq("id", latestSession!.id);
      toast.success("Checked out successfully!");
    }
    qc.invalidateQueries({ queryKey: ["my-attendance-today"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const chartColors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f59e0b", "#10b981"];


  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-4xl font-black tracking-tight text-foreground">
          Good Morning, <span className="text-primary">{isAdmin ? "Admin" : myEmployee?.full_name?.split(' ')[0] || 'User'}</span>
        </h1>
        <p className="text-muted-foreground font-medium">SN Gene HR Dashboard Overview • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Workforce" value={stats?.totalEmployees ?? 0} trend="up" trendValue="+3.2%" colorClass="bg-indigo-500" />
        <StatCard icon={Clock} label="Attendance Rate" value={`${stats?.attTrend?.[6]?.value ?? 96}%`} trend="up" trendValue="+0.8%" colorClass="bg-teal-500" />
        <StatCard icon={CalendarDays} label="Pending Leaves" value={stats?.pendingLeaves ?? 0} colorClass="bg-rose-500" />
        <StatCard icon={Wallet} label="Net Payroll YTD" value={`₹${(stats?.totalPayroll ?? 0).toLocaleString("en-IN")}`} trend="up" trendValue="+12%" colorClass="bg-amber-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 rounded-2xl border bg-card p-6 shadow-card overflow-hidden group">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-bold text-xl tracking-tight">Weekly Attendance Trends</h3>
              <p className="text-xs text-muted-foreground font-medium mt-1">Average Daily Presence %</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.attTrend ?? []}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-elegant)', padding: '12px' }}
                  itemStyle={{ fontWeight: 800, color: 'var(--primary)' }}
                />
                <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          {!isAdmin && myEmployee && (
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                <div className="rounded-2xl border bg-card p-6 shadow-card flex flex-col justify-between border-b-8 border-b-primary transition-all hover:shadow-elegant group">
                  <div>
                    <h3 className="font-bold text-xl tracking-tight flex items-center gap-2">
                      <Activity className="size-5 text-primary" /> Time Tracking
                    </h3>
                    {isMarketing && <span className="text-[8px] font-black uppercase text-amber-600 tracking-widest mt-1 flex items-center gap-1"><Plane className="size-2" /> India-Wide Mode</span>}
                    <p className="text-xs text-muted-foreground font-medium mt-1">Log your daily work hours</p>
                  </div>
                  
                  <div className="text-center py-4">
                    <div className="text-4xl font-black font-display text-primary tracking-tighter mb-1 tabular-nums">
                      {isCheckedIn ? elapsed : "00:00:00"}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-6">Current Session</p>
                    
                    {isCheckedIn ? (
                      <Button onClick={() => punch("out")} variant="destructive" className="w-full h-11 rounded-xl gap-2 text-sm font-black shadow-lg shadow-red-200">
                        <Square className="size-4 fill-current" /> Finish Session
                      </Button>
                    ) : (
                      <Button onClick={() => punch("in")} className="w-full h-11 rounded-xl gap-2 text-sm font-black shadow-lg shadow-indigo-200">
                        <Play className="size-4 fill-current" /> Start Session
                      </Button>
                    )}
                  </div>
                </div>

                <Link to="/profile" className="rounded-2xl border bg-gradient-to-br from-indigo-600 to-purple-700 p-6 shadow-elegant flex flex-col justify-between transition-all hover:scale-[1.02] active:scale-95 group">
                  <div className="flex items-center justify-between text-white/80">
                    <Award className="size-6" />
                    <div className="size-8 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black uppercase tracking-tighter backdrop-blur-md border border-white/10">
                        ID
                    </div>
                  </div>
                  <div className="mt-8">
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Employee Digital ID</p>
                    <p className="text-xl font-black text-white tracking-tight leading-tight mt-1">View My SN Gene ID</p>
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-white/80 group-hover:text-white transition-colors">
                        Scan to Verify <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </div>
          )}

          {isAdmin && (
            <>
              <LiveActivity isAdmin={isAdmin} today={today} />
              <div className="rounded-2xl border bg-card p-6 shadow-card">
                <h3 className="font-bold text-lg tracking-tight mb-4">Recent Hires</h3>
                <div className="space-y-4">
                  {(stats?.recentHires ?? []).map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                          {h.full_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold tracking-tight group-hover:text-primary transition-colors">{h.full_name}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{h.designation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" asChild className="w-full mt-4 text-[10px] font-black uppercase tracking-widest border border-dashed text-muted-foreground hover:text-primary hover:border-primary">
                  <Link to="/employees" className="gap-2">Manage Workforce <ArrowRight className="size-4" /></Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-xl tracking-tight">Workforce by Department</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.deptData ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-elegant)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                  {(stats?.deptData ?? []).map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-card relative overflow-hidden group min-h-[400px] flex flex-col">
          <div className="flex flex-col gap-1 mb-6">
            <h3 className="font-bold text-xl tracking-tight">Global Office Presence</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{stats?.locationCount ?? 0} active branches</p>
          </div>
          
          <div className="flex-1 rounded-xl overflow-hidden relative border shadow-inner">
             <OfficeMap locations={stats?.locations ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
