import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Mail, Phone, Calendar, Fingerprint, ShieldCheck, Download, Share2, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/profile")({ 
  component: () => (
    <AppShell>
      <ProfilePage />
    </AppShell>
  ) 
});

function ProfilePage() {
  const { user } = useAuth();

  const { data: employee, isLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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
          <Button variant="outline" className="gap-2 rounded-xl border-2"><Download className="size-4" /> Download PDF</Button>
          <Button className="gap-2 rounded-xl shadow-lg shadow-primary/20"><Share2 className="size-4" /> Share ID</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-12 items-start">
        {/* Physical Card Representation */}
        <div className="md:col-span-5 perspective-1000">
           <div className="relative w-full aspect-[2/3] max-w-[320px] mx-auto rounded-[32px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] group transition-transform duration-700 hover:rotate-y-12">
              {/* Card Header Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-indigo-600 to-purple-700" />
              <div className="absolute top-0 inset-x-0 h-40 bg-white/10 backdrop-blur-3xl rounded-b-[40px]" />
              
              <div className="relative h-full flex flex-col items-center p-8 text-white">
                 <div className="flex items-center gap-2 mb-8 opacity-90">
                    <div className="size-6 rounded-lg bg-white flex items-center justify-center">
                       <ShieldCheck className="size-4 text-primary" />
                    </div>
                    <span className="font-display font-black tracking-widest text-xs uppercase">SN Gene HR Enterprise</span>
                 </div>

                 <div className="size-32 rounded-3xl border-4 border-white/20 p-1 mb-6 shadow-2xl group-hover:scale-105 transition-transform">
                    <div className="size-full rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-5xl font-black">
                       {employee.full_name?.charAt(0)}
                    </div>
                 </div>

                 <h2 className="text-2xl font-black tracking-tight text-center">{employee.full_name}</h2>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mt-1 mb-6">{employee.designation}</p>

                 <div className="grid grid-cols-2 gap-4 w-full mt-auto mb-10">
                    <div className="flex flex-col">
                       <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">Employee ID</span>
                       <span className="text-sm font-bold font-mono tracking-tighter">{employee.employee_code}</span>
                    </div>
                    <div className="flex flex-col text-right">
                       <span className="text-[8px] font-black uppercase text-white/40 tracking-widest">Department</span>
                       <span className="text-sm font-bold tracking-tight">{employee.department}</span>
                    </div>
                 </div>

                 <div className="w-full h-20 bg-white rounded-2xl p-2 flex items-center justify-center shadow-inner overflow-hidden">
                    <QRCodeSVG 
                      value={`SNGENE_ID:${employee.id}`} 
                      size={64}
                      level="H"
                      includeMargin={false}
                      imageSettings={{
                        src: "/favicon.ico",
                        height: 12,
                        width: 12,
                        excavate: true,
                        x: undefined,
                        y: undefined
                      }}
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* Details Section */}
        <div className="md:col-span-7 space-y-8">
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
