import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Lock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/reset-password" as any)({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a recovery session
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("Password recovery mode active");
      }
    });
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success("Password updated successfully!");
      setSuccess(true);
      setLoading(false);
      setTimeout(() => navigate({ to: "/login" }), 2000);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md text-center space-y-6 rounded-2xl bg-white p-10 shadow-xl border border-slate-100 animate-in zoom-in duration-300">
          <div className="mx-auto size-20 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <CheckCircle2 className="size-10" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Success!</h1>
          <p className="text-slate-500 font-medium">Your password has been updated. Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl border border-slate-100">
        <div className="text-center">
          <div className="mx-auto size-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
            <ShieldCheck className="size-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Set New Password</h1>
          <p className="mt-2 text-sm text-slate-500 font-medium">Choose a strong password for your HR portal.</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 size-4 text-slate-400" />
                <Input 
                  type="password"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••"
                  className="rounded-xl border-2 pl-10 h-12"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 size-4 text-slate-400" />
                <Input 
                  type="password"
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder="••••••••"
                  className="rounded-xl border-2 pl-10 h-12"
                  required
                />
              </div>
            </div>
          </div>
          
          <Button 
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-xl font-black text-lg shadow-lg shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-95"
          >
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
