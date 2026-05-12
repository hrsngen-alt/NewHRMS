import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/dev-reset" as any)({
  component: DevResetPage,
});

function DevResetPage() {
  const [email, setEmail] = useState("hrsngen@gmail.com");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleReset = async () => {
    setLoading(true);
    try {
      // Note: This only works if the user is already logged in as an admin 
      // or if we use the reset flow. For dev, we'll try to sign up/reset.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      toast.success("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl border border-slate-100">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900">Dev Account Recovery</h1>
          <p className="mt-2 text-sm text-slate-500 font-medium">Use this to regain access to test accounts.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Email</label>
            <Input 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="email@example.com"
              className="rounded-xl border-2"
            />
          </div>
          
          <Button 
            onClick={handleReset} 
            disabled={loading}
            className="w-full h-12 rounded-xl font-black text-lg shadow-lg shadow-indigo-100"
          >
            {loading ? "Sending..." : "Send Reset Email"}
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={() => navigate({ to: "/login" })}
            className="w-full font-bold text-slate-400"
          >
            Back to Login
          </Button>
        </div>
        
        <div className="mt-6 rounded-xl bg-amber-50 p-4 border border-amber-100">
          <p className="text-[10px] text-amber-700 font-bold leading-relaxed uppercase tracking-tight">
            Tip: If you have access to the Supabase Dashboard, it is faster to reset it there under "Authentication &gt; Users".
          </p>
        </div>
      </div>
    </div>
  );
}
