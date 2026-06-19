import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Mail, Phone, Calendar, Fingerprint, ShieldCheck, Download, Share2, Scan, Camera, Lock, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/profile")({ 
  component: () => (
    <AppShell>
      <ProfilePage />
    </AppShell>
  ) 
});

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function ProfilePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const [passcodeEnabled, setPasscodeEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pwa_passcode_enabled") === "true";
    }
    return false;
  });
  const [biometricsEnabled, setBiometricsEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pwa_biometrics_enabled") === "true";
    }
    return false;
  });
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinStep, setPinStep] = useState<"set" | "confirm" | "disable">("set");
  const [pinValue, setPinValue] = useState("");
  const [confirmPinValue, setConfirmPinValue] = useState("");
  const [verificationPinValue, setVerificationPinValue] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => setIsBiometricsSupported(available))
        .catch(() => setIsBiometricsSupported(false));
    }
  }, []);

  const handlePasscodeToggle = (checked: boolean) => {
    if (checked) {
      setPinStep("set");
      setPinValue("");
      setConfirmPinValue("");
      setIsPinModalOpen(true);
    } else {
      setPinStep("disable");
      setVerificationPinValue("");
      setIsPinModalOpen(true);
    }
  };

  const handleBiometricsToggle = async (checked: boolean) => {
    if (checked) {
      if (!passcodeEnabled) {
        toast.error("Please enable a Passcode lock first before configuring biometrics.");
        return;
      }
      await registerBiometrics();
    } else {
      localStorage.setItem("pwa_biometrics_enabled", "false");
      setBiometricsEnabled(false);
      toast.success("Biometric lock disabled");
    }
  };

  const registerBiometrics = async () => {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: "SN Gene HR",
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: employee?.email || "user@sngene.com",
            displayName: employee?.full_name || "User",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      });

      if (credential) {
        localStorage.setItem("pwa_biometrics_enabled", "true");
        setBiometricsEnabled(true);
        toast.success("Biometric authentication enabled successfully!");
      }
    } catch (err: any) {
      console.error("Biometric registration error:", err);
      toast.error(err.message || "Failed to register biometrics. Please ensure your device supports biometric credentials.");
    }
  };

  const handlePinComplete = async (value: string) => {
    if (pinStep === "set") {
      setPinValue(value);
      setPinStep("confirm");
    } else if (pinStep === "confirm") {
      if (value === pinValue) {
        const hash = await hashPin(value);
        localStorage.setItem("pwa_passcode_hash", hash);
        localStorage.setItem("pwa_passcode_enabled", "true");
        setPasscodeEnabled(true);
        setIsPinModalOpen(false);
        toast.success("Passcode lock enabled!");
      } else {
        toast.error("PINs do not match. Let's try again.");
        setPinValue("");
        setConfirmPinValue("");
        setPinStep("set");
      }
    } else if (pinStep === "disable") {
      const hash = await hashPin(value);
      const storedHash = localStorage.getItem("pwa_passcode_hash");
      if (hash === storedHash) {
        localStorage.setItem("pwa_passcode_enabled", "false");
        localStorage.setItem("pwa_biometrics_enabled", "false");
        setPasscodeEnabled(false);
        setBiometricsEnabled(false);
        setIsPinModalOpen(false);
        toast.success("Passcode lock disabled!");
      } else {
        toast.error("Incorrect passcode. Try again.");
        setVerificationPinValue("");
      }
    }
  };

  const { data: employee, isLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handleDownload = async () => {
    if (!cardRef.current || !employee) return;
    setDownloading(true);
    const toastId = toast.loading("Generating your high-fidelity Digital ID...");
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, // High quality
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 170; // mm
      const pageHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [imgWidth, pageHeight]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, pageHeight);
      pdf.save(`SNGENE_ID_${employee.employee_code}.pdf`);
      toast.success("ID Card downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF. Please try again.", { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!employee) return;
    const shareData = {
      title: `Digital ID - ${employee.full_name}`,
      text: `Official Digital ID for ${employee.full_name} (${employee.employee_code}) at SN Gene HR.`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Profile link copied to clipboard!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    setDownloading(true);
    const tid = toast.loading("Uploading your official photo...");

    try {
      const ext = file.name.split('.').pop();
      const path = `${employee.id}/photo_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("employee_documents").upload(path, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("employee_documents").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("employees").update({ photo_url: publicUrl } as any).eq("id", employee.id);
      if (dbErr) throw dbErr;

      toast.success("Photo updated successfully!", { id: tid });
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload photo", { id: tid });
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <div className="p-12 text-center animate-pulse font-black text-primary">Loading Digital ID...</div>;
  if (!employee) return <div className="p-12 text-center text-muted-foreground">Employee record not found. Please contact HR.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight text-foreground text-center md:text-left">Digital ID Card</h1>
          <p className="text-muted-foreground font-medium mt-1 text-center md:text-left">Your official corporate identity and employment summary.</p>
        </div>
         <div className="flex gap-3">
           <Button 
             variant="outline" 
             className="gap-2 rounded-xl border-2"
             onClick={handleDownload}
             disabled={downloading}
           >
             <Download className="size-4" /> {downloading ? "Generating..." : "Download PDF"}
           </Button>
           <Button 
             className="gap-2 rounded-xl shadow-lg shadow-primary/20"
             onClick={handleShare}
           >
             <Share2 className="size-4" /> Share ID
           </Button>
         </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-12 items-start">
        {/* Double-sided ID Card Display */}
        <div className="lg:col-span-7 md:col-span-12 flex flex-col items-center">
          
          {/* 3D Flipping Card Wrapper */}
          <div 
            onClick={() => setIsFlipped(!isFlipped)}
            className="relative w-[280px] h-[420px] cursor-pointer select-none shrink-0"
            style={{ perspective: '1000px' }}
          >
            <div 
              className="relative w-full h-full transition-transform duration-700"
              style={{ 
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
              }}
            >
              {/* Front Side */}
              <div 
                className="absolute inset-0 rounded-[32px] overflow-hidden shadow-[0_16px_32px_rgba(0,0,0,0.15)] flex flex-col items-center p-6 text-white bg-gradient-to-br from-primary via-indigo-600 to-purple-700"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="absolute top-0 inset-x-0 h-32 bg-white/5 backdrop-blur-2xl rounded-b-[40px]" />
                
                {/* Header branding */}
                <div className="relative flex items-center gap-2 mb-6 opacity-90">
                  <div className="size-6 rounded-lg bg-white flex items-center justify-center">
                    <ShieldCheck className="size-4 text-primary" />
                  </div>
                  <span className="font-display font-black tracking-widest text-xs uppercase">SNGene Lab</span>
                </div>

                {/* Photo container */}
                <div className="relative group/photo mt-2">
                  <div className="w-32 h-40 rounded-[40px] border-4 border-white/30 p-1 mb-4 shadow-2xl group-hover:scale-105 transition-transform overflow-hidden bg-white/10 backdrop-blur-md">
                    {(employee as any).photo_url ? (
                      <img src={(employee as any).photo_url} alt={employee.full_name} className="size-full object-cover rounded-[32px]" />
                    ) : (
                      <div className="size-full rounded-[32px] flex items-center justify-center text-6xl font-black">
                        {employee.full_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <label 
                    onClick={(e) => e.stopPropagation()} 
                    className="absolute inset-0 mb-4 flex items-center justify-center bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity cursor-pointer rounded-3xl"
                  >
                    <Camera className="size-8 text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={downloading} />
                  </label>
                </div>

                {/* Name & Title */}
                <div className="relative text-center mt-2">
                  <h2 className="text-2xl font-black tracking-tight">{employee.full_name}</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mt-1">{employee.designation}</p>
                </div>

                {/* Card tag */}
                <div className="mt-auto py-1 px-4 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[9px] font-bold tracking-widest uppercase text-white/80">
                  Official Identity Card
                </div>
              </div>

              {/* Back Side */}
              <div 
                className="absolute inset-0 rounded-[32px] overflow-hidden shadow-[0_16px_32px_rgba(0,0,0,0.15)] flex flex-col p-6 text-slate-900 bg-white border border-slate-100"
                style={{ 
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
              >
                {/* Header branding small */}
                <div className="flex items-center gap-1.5 opacity-90 border-b border-slate-100 pb-3 mb-6">
                  <ShieldCheck className="size-4 text-indigo-600" />
                  <span className="font-display font-black tracking-wider text-[10px] uppercase text-slate-800">SNGene Lab</span>
                </div>

                {/* Info fields list */}
                <div className="space-y-4 text-sm font-medium">
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Employee ID</span>
                    <span className="font-bold font-mono tracking-tighter text-slate-800">{employee.employee_code}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Department</span>
                    <span className="font-bold text-slate-800">{employee.department || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Phone Number</span>
                    <span className="font-bold text-slate-800">{employee.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Email Contact</span>
                    <span className="font-bold text-slate-800 text-xs truncate block max-w-full">{employee.email}</span>
                  </div>
                </div>

                {/* QR Code container */}
                <div className="mt-auto flex flex-col items-center gap-2">
                  <div className="p-1">
                    <QRCodeSVG 
                      value={`SNGENE_ID:${employee.id}`} 
                      size={80}
                      level="H"
                      includeMargin={false}
                      fgColor="#0f172a"
                      bgColor="transparent"
                    />
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center mt-1">Scan to Verify Status</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 font-bold uppercase tracking-widest animate-pulse select-none">💡 Tap card to flip sides</p>

          {/* Hidden Container for high-quality landscape side-by-side PDF generation */}
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <div ref={cardRef} className="flex flex-row gap-6 p-6 bg-slate-900 rounded-[40px] items-center">
              
              {/* Front Card PDF layout */}
              <div className="relative w-[280px] h-[420px] rounded-[32px] overflow-hidden flex flex-col items-center p-6 text-white bg-gradient-to-br from-primary via-indigo-600 to-purple-700 shrink-0">
                <div className="absolute top-0 inset-x-0 h-32 bg-white/5 backdrop-blur-2xl rounded-b-[40px]" />
                <div className="relative flex items-center gap-2 mb-6 opacity-90">
                  <div className="size-6 rounded-lg bg-white flex items-center justify-center">
                    <ShieldCheck className="size-4 text-primary" />
                  </div>
                  <span className="font-display font-black tracking-widest text-xs uppercase">SNGene Lab</span>
                </div>
                <div className="relative mt-2">
                  <div className="w-32 h-40 rounded-[40px] border-4 border-white/30 p-1 mb-4 overflow-hidden bg-white/10 backdrop-blur-md">
                    {(employee as any).photo_url ? (
                      <img src={(employee as any).photo_url} alt={employee.full_name} className="size-full object-cover rounded-[32px]" />
                    ) : (
                      <div className="size-full rounded-[32px] flex items-center justify-center text-6xl font-black">
                        {employee.full_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="relative text-center mt-2">
                  <h2 className="text-2xl font-black tracking-tight">{employee.full_name}</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mt-1">{employee.designation}</p>
                </div>
                <div className="mt-auto py-1 px-4 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[9px] font-bold tracking-widest uppercase text-white/80">
                  Official Identity Card
                </div>
              </div>

              {/* Back Card PDF layout */}
              <div className="relative w-[280px] h-[420px] rounded-[32px] overflow-hidden flex flex-col p-6 text-slate-900 bg-white border border-slate-100 shrink-0">
                <div className="flex items-center gap-1.5 opacity-90 border-b border-slate-100 pb-3 mb-6">
                  <ShieldCheck className="size-4 text-indigo-600" />
                  <span className="font-display font-black tracking-wider text-[10px] uppercase text-slate-800">SNGene Lab</span>
                </div>
                <div className="space-y-4 text-sm font-medium">
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Employee ID</span>
                    <span className="font-bold font-mono tracking-tighter text-slate-800">{employee.employee_code}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Department</span>
                    <span className="font-bold text-slate-800">{employee.department || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Phone Number</span>
                    <span className="font-bold text-slate-800">{employee.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Email Contact</span>
                    <span className="font-bold text-slate-800 text-xs truncate block max-w-full">{employee.email}</span>
                  </div>
                </div>
                <div className="mt-auto flex flex-col items-center gap-2">
                  <div className="p-1">
                    <QRCodeSVG 
                      value={`SNGENE_ID:${employee.id}`} 
                      size={80}
                      level="H"
                      includeMargin={false}
                      fgColor="#0f172a"
                      bgColor="transparent"
                    />
                  </div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center mt-1">Scan to Verify Status</span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="lg:col-span-5 md:col-span-12 space-y-8">
           <section className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                 <Building2 className="size-4" /> Professional Record
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                 <InfoItem icon={Calendar} label="Joining Date" value={employee.joining_date} />
                 <InfoItem icon={Fingerprint} label="Employee Code" value={employee.employee_code} />
                 <InfoItem icon={ShieldCheck} label="Employment Status" value={employee.status} badge />
              </div>
           </section>

           <section className="space-y-4 pt-4 border-t">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                 <Mail className="size-4" /> Contact Information
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                 <InfoItem icon={Mail} label="Work Email" value={employee.email} />
                 <InfoItem icon={Phone} label="Contact Number" value={employee.phone} />
              </div>
           </section>

            <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 space-y-4">
               <p className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                  <Scan className="size-4" /> Identity Verification
               </p>
               <p className="text-sm text-muted-foreground leading-relaxed">
                  This Digital ID card is valid for office entry, security clearance, and benefits verification. 
                  Scan the QR code to verify real-time status with the SN Gene HR secure server.
               </p>
            </div>

            <section className="space-y-4 pt-4 border-t">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                 <ShieldCheck className="size-4" /> App Security
              </h3>
              <Card className="rounded-2xl border-2 border-primary/5 shadow-none overflow-hidden">
                 <CardContent className="p-6 space-y-6">
                    <div className="flex items-center justify-between gap-4">
                       <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-foreground">Passcode Lock</span>
                          <span className="text-xs text-muted-foreground">Require a 4-digit PIN passcode on app startup and refocus.</span>
                       </div>
                       <Switch 
                          checked={passcodeEnabled} 
                          onCheckedChange={handlePasscodeToggle}
                       />
                    </div>

                    {passcodeEnabled && (
                       <div className="flex items-center justify-between gap-4 border-t border-muted/50 pt-4">
                          <div className="flex flex-col gap-1">
                             <span className="text-sm font-bold text-foreground">Change Passcode PIN</span>
                             <span className="text-xs text-muted-foreground">Reset your local device passcode lock PIN.</span>
                          </div>
                          <Button 
                             variant="outline" 
                             className="rounded-xl border-2 gap-2 text-xs font-black uppercase"
                             onClick={() => {
                                setPinStep("set");
                                setPinValue("");
                                setConfirmPinValue("");
                                setIsPinModalOpen(true);
                             }}
                          >
                             <KeyRound className="size-4" /> Change PIN
                          </Button>
                       </div>
                    )}

                    <div className="flex items-center justify-between gap-4 border-t border-muted/50 pt-4">
                       <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-foreground">Biometric Lock</span>
                          <span className="text-xs text-muted-foreground">Use Face ID, Touch ID, or fingerprint verification to unlock.</span>
                       </div>
                       <Switch 
                          checked={biometricsEnabled} 
                          onCheckedChange={handleBiometricsToggle}
                          disabled={!passcodeEnabled || !isBiometricsSupported}
                       />
                    </div>
                    
                    {!isBiometricsSupported && passcodeEnabled && (
                       <p className="text-[10px] text-muted-foreground/60 italic">
                          * Biometrics is not supported or not configured on this browser/device.
                       </p>
                    )}
                 </CardContent>
              </Card>
           </section>

           <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
             <DialogContent className="max-w-md rounded-3xl p-6 border-2 border-primary/5">
               <DialogHeader className="flex flex-col items-center text-center">
                 <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                   <Lock className="size-6 animate-pulse" />
                 </div>
                 <DialogTitle className="font-display font-black text-xl">
                   {pinStep === "set" && "Set 4-Digit Passcode"}
                   {pinStep === "confirm" && "Confirm Passcode"}
                   {pinStep === "disable" && "Enter Passcode to Disable"}
                 </DialogTitle>
                 <DialogDescription className="text-sm text-muted-foreground mt-1">
                   {pinStep === "set" && "Create a secure PIN to lock SN Gene HR PWA on this device."}
                   {pinStep === "confirm" && "Re-enter the 4-digit PIN to confirm accuracy."}
                   {pinStep === "disable" && "Verify your current device PIN to disable security lock."}
                 </DialogDescription>
               </DialogHeader>

               <div className="flex flex-col items-center justify-center py-6">
                 <InputOTP
                   maxLength={4}
                   value={
                     pinStep === "set" ? pinValue :
                     pinStep === "confirm" ? confirmPinValue :
                     verificationPinValue
                   }
                   onChange={(val) => {
                     if (pinStep === "set") setPinValue(val);
                     else if (pinStep === "confirm") setConfirmPinValue(val);
                     else setVerificationPinValue(val);
                   }}
                   onComplete={handlePinComplete}
                   autoFocus
                 >
                   <InputOTPGroup className="gap-2">
                     <InputOTPSlot index={0} className="w-12 h-12 rounded-xl border-2 text-lg font-black" />
                     <InputOTPSlot index={1} className="w-12 h-12 rounded-xl border-2 text-lg font-black" />
                     <InputOTPSlot index={2} className="w-12 h-12 rounded-xl border-2 text-lg font-black" />
                     <InputOTPSlot index={3} className="w-12 h-12 rounded-xl border-2 text-lg font-black" />
                   </InputOTPGroup>
                 </InputOTP>
               </div>
               
               <DialogFooter className="sm:justify-center">
                 <Button
                   variant="ghost"
                   className="rounded-xl font-bold hover:bg-muted"
                   onClick={() => setIsPinModalOpen(false)}
                 >
                   Cancel
                 </Button>
               </DialogFooter>
             </DialogContent>
           </Dialog>
         </div>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value, badge }: any) {
  if (!value) return null;
  return (
    <Card className="rounded-2xl border-2 border-primary/5 shadow-none overflow-hidden hover:bg-primary/5 transition-colors group">
       <CardContent className="p-4 flex items-center gap-4">
          <div className="size-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
             <Icon className="size-5" />
          </div>
          <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">{label}</span>
             {badge ? (
                <span className="w-fit px-2 py-0.5 rounded-lg bg-green-100 text-green-700 text-[10px] font-black uppercase mt-1 tracking-tighter">
                   {value}
                </span>
             ) : (
                <span className="text-sm font-bold text-foreground leading-none mt-1">{value}</span>
             )}
          </div>
       </CardContent>
    </Card>
  );
}
