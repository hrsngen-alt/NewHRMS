import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Html5QrcodeScanner } from "html5-qrcode";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Scan, UserCheck, UserMinus, ShieldAlert, Sparkles, Clock, MapPin, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/kiosk")({ 
  component: () => <KioskPage /> 
});

function KioskPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(() => {
    const saved = localStorage.getItem("kiosk_location");
    return saved ? JSON.parse(saved) : null;
  });
  const [scannedResult, setScannedResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase.from("company_locations" as any).select("*");
      if (data) setLocations(data);
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
        /* verbose= */ false
      );
      scannerRef.current.render(onScanSuccess, onScanFailure);
    }

    return () => {
      scannerRef.current?.clear().catch(console.error);
    };
  }, [selectedLocation]);

  const setLocation = (loc: any) => {
    localStorage.setItem("kiosk_location", JSON.stringify(loc));
    setSelectedLocation(loc);
  };

  async function onScanSuccess(decodedText: string) {
    if (isProcessing || scannedResult) return;
    
    if (decodedText.startsWith("PULSEHR_ID:")) {
      setIsProcessing(true);
      const employeeId = decodedText.split(":")[1];
      await handlePunch(employeeId);
    }
  }

  function onScanFailure(error: any) {}

  const handlePunch = async (employeeId: string) => {
    try {
      const { data: employee, error: empErr } = await supabase
        .from("employees")
        .select("id, full_name, designation")
        .eq("id", employeeId)
        .maybeSingle();

      if (empErr || !employee) throw new Error("Invalid Employee Identity");

      const today = new Date().toLocaleDateString('en-CA');
      const { data: latestRecord } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("date", today)
        .order("check_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      const isCheckingOut = latestRecord && !latestRecord.check_out;

      if (!isCheckingOut) {
        await (supabase.from("attendance") as any).insert({
          employee_id: employeeId,
          date: today,
          check_in: new Date().toISOString(),
          status: "present",
          location_id: selectedLocation.id
        });
        setScannedResult({ employee, type: 'in' });
        toast.success(`Welcome to ${selectedLocation.name}, ${employee.full_name}!`);
      } else {
        const start = new Date(latestRecord.check_in!);
        const hours = Math.max(0, (Date.now() - start.getTime()) / 3_600_000);
        await supabase.from("attendance").update({
          check_out: new Date().toISOString(),
          hours_worked: Number(hours.toFixed(2))
        }).eq("id", latestRecord.id);
        setScannedResult({ employee, type: 'out' });
        toast.success(`Goodbye from ${selectedLocation.name}, ${employee.full_name}!`);
      }

      setTimeout(() => {
        setScannedResult(null);
        setIsProcessing(false);
      }, 4000);

    } catch (err: any) {
      toast.error(err.message);
      setIsProcessing(false);
    }
  };

  if (!selectedLocation) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent)] pointer-events-none" />
        <div className="z-10 space-y-8 max-w-md w-full">
           <div className="size-20 rounded-[24px] bg-primary/20 flex items-center justify-center text-primary mx-auto shadow-lg shadow-primary/20">
              <MapPin className="size-10" />
           </div>
           <div>
             <h1 className="text-4xl font-black tracking-tight mb-2">Setup Terminal</h1>
             <p className="text-slate-400 font-medium">Select the office location where this Kiosk is deployed.</p>
           </div>
           
           <div className="grid gap-3">
              {locations.map((loc) => (
                <Button 
                  key={loc.id} 
                  onClick={() => setLocation(loc)}
                  variant="outline"
                  className="h-16 rounded-2xl border-2 border-slate-800 bg-slate-900/50 hover:bg-primary/10 hover:border-primary transition-all text-left justify-start px-6 gap-4 group"
                >
                   <div className="size-8 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <MapPin className="size-4" />
                   </div>
                   <div className="flex flex-col">
                      <span className="font-bold text-sm tracking-tight">{loc.name}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{loc.address}</span>
                   </div>
                </Button>
              ))}
              {locations.length === 0 && <p className="text-slate-500 italic py-4">No locations found. Configure them in settings first.</p>}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
      
      {/* Location Header */}
      <div className="absolute top-8 left-8 flex items-center gap-4 z-20">
         <div className="size-12 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center text-primary shadow-xl">
            <MapPin className="size-6" />
         </div>
         <div>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Current Terminal</p>
            <p className="text-lg font-black text-white leading-none mt-1">{selectedLocation.name}</p>
         </div>
         <Button 
           variant="ghost" 
           size="sm" 
           onClick={() => setSelectedLocation(null)}
           className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest ml-4 h-8 px-3 rounded-lg border border-white/5"
         >
           Switch
         </Button>
      </div>

      <div className="z-10 w-full max-w-2xl space-y-8 animate-in fade-in duration-1000">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            <Sparkles className="size-3" /> Digital Kiosk Terminal
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter leading-none">Pulse HR Kiosk</h1>
          <p className="text-slate-400 font-medium">Scan your Digital ID to record your session.</p>
        </div>

        <div className="relative group">
           <div className={cn(
             "rounded-[40px] border-8 border-slate-800 bg-slate-900 shadow-[0_0_100px_-20px_rgba(99,102,241,0.3)] overflow-hidden transition-all duration-500",
             scannedResult ? "scale-95 opacity-40 blur-sm" : "scale-100 opacity-100"
           )}>
              <div id="reader" className="w-full aspect-square" />
           </div>

           {scannedResult && (
             <div className="absolute inset-0 z-20 flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                <Card className="w-[85%] rounded-[32px] border-none bg-white/10 backdrop-blur-3xl shadow-2xl p-8 text-white border-t border-white/20">
                   <CardContent className="p-0 flex flex-col items-center text-center">
                      <div className={cn(
                        "size-24 rounded-full flex items-center justify-center mb-6 shadow-lg",
                        scannedResult.type === 'in' ? "bg-green-500 shadow-green-500/30" : "bg-indigo-500 shadow-indigo-500/30"
                      )}>
                        {scannedResult.type === 'in' ? <UserCheck className="size-12" /> : <UserMinus className="size-12" />}
                      </div>
                      
                      <h2 className="text-3xl font-black tracking-tight mb-2">
                        {scannedResult.type === 'in' ? "Welcome Back!" : "See You Soon!"}
                      </h2>
                      <p className="text-xl font-bold text-white/90 mb-1">{scannedResult.employee.full_name}</p>
                      <p className="text-xs font-black uppercase tracking-widest text-white/50">{scannedResult.employee.designation}</p>
                      
                      <div className="mt-8 flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl border border-white/10">
                           <Clock className="size-4 text-primary" />
                           <span className="text-sm font-black font-mono">
                              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl border border-green-500/20">
                           <CheckCircle2 className="size-4" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Verified</span>
                        </div>
                      </div>
                   </CardContent>
                </Card>
             </div>
           )}

           {isProcessing && !scannedResult && (
             <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm rounded-[40px]">
                <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-primary/20" />
                <p className="mt-4 font-black text-xs uppercase tracking-widest text-primary animate-pulse">Authenticating...</p>
             </div>
           )}
        </div>

        <div className="grid grid-cols-3 gap-6">
           <KioskHint icon={Scan} label="Scan Ready" color="text-green-400" />
           <KioskHint icon={ShieldAlert} label="Secure Session" color="text-indigo-400" />
           <KioskHint icon={Sparkles} label="Instant Sync" color="text-amber-400" />
        </div>
      </div>

      <div className="mt-20 text-slate-600 text-[10px] font-black uppercase tracking-[0.4em]">
         Property of Pulse HR Solutions • v2.5.0 • {selectedLocation.name} Branch
      </div>
    </div>
  );
}

function KioskHint({ icon: Icon, label, color }: any) {
  return (
    <div className="flex flex-col items-center gap-3">
       <div className="size-12 rounded-2xl bg-slate-800/50 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
          <Icon className={cn("size-5", color)} />
       </div>
       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}
