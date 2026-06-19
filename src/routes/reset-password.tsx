import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

type PageState = "loading" | "ready" | "success" | "invalid";

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageState, setPageState] = useState<PageState>("loading");
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase sends the recovery token as a URL hash fragment.
    // We listen for the PASSWORD_RECOVERY event which fires automatically
    // when Supabase detects the token in the URL.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        // Recovery session is active — show the form
        setPageState("ready");
      } else if (event === "SIGNED_IN" && session) {
        // Already signed in with recovery session
        setPageState("ready");
      }
    });

    // Also check if there's already a valid session (e.g. page was refreshed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setPageState("ready");
      } else {
        // No session yet — wait for the onAuthStateChange above.
        // If nothing fires within 4 seconds, the link is invalid/expired.
        const timeout = setTimeout(() => {
          setPageState((prev) => {
            if (prev === "loading") return "invalid";
            return prev;
          });
        }, 4000);
        return () => clearTimeout(timeout);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      if (error.message.includes("same password")) {
        toast.error("New password must be different from the current password.");
      } else {
        toast.error(error.message || "Failed to update password. The link may have expired.");
      }
    } else {
      setPageState("success");
      // Sign out so they log in fresh with new password
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/login" }), 3000);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md text-center space-y-5 rounded-2xl bg-white p-10 shadow-xl border border-slate-100">
          <div className="mx-auto size-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
            <Loader2 className="size-8 animate-spin" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Verifying reset link…</h1>
            <p className="mt-1 text-sm text-slate-500">Please wait while we validate your reset token.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Invalid / Expired ──────────────────────────────────────────────────────
  if (pageState === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md text-center space-y-6 rounded-2xl bg-white p-10 shadow-xl border border-slate-100 animate-in zoom-in duration-300">
          <div className="mx-auto size-20 rounded-full bg-red-100 flex items-center justify-center text-red-500">
            <AlertTriangle className="size-10" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Link Expired or Invalid</h1>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              This password reset link is no longer valid. It may have already been used or has expired (links expire after 1 hour).
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium text-left">
            💡 Please go back to the login page and request a new "Forgot Password" reset email.
          </div>
          <Button
            className="w-full h-12 rounded-xl font-bold"
            onClick={() => navigate({ to: "/login" })}
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (pageState === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md text-center space-y-6 rounded-2xl bg-white p-10 shadow-xl border border-slate-100 animate-in zoom-in duration-300">
          <div className="mx-auto size-20 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <CheckCircle2 className="size-10" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Password Updated!</h1>
            <p className="mt-2 text-slate-500 font-medium text-sm">
              Your password has been changed successfully. Redirecting to login in a moment…
            </p>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full animate-[progress_3s_linear_forwards]" style={{ width: "100%" }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-400">
        <div className="text-center">
          <div className="mx-auto size-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
            <ShieldCheck className="size-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Set New Password</h1>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Choose a strong password for your HR portal account.
          </p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-5">
          {/* New Password */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="rounded-xl border-2 pl-10 pr-12 h-12 focus:border-indigo-400"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {/* Strength indicator */}
            {password.length > 0 && (
              <div className="flex gap-1 mt-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      password.length >= i * 3
                        ? password.length < 6
                          ? "bg-red-400"
                          : password.length < 10
                          ? "bg-amber-400"
                          : "bg-green-500"
                        : "bg-slate-100"
                    }`}
                  />
                ))}
                <span className="text-[10px] font-bold text-slate-400 ml-1">
                  {password.length < 6 ? "Weak" : password.length < 10 ? "Fair" : "Strong"}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className={`rounded-xl border-2 pl-10 pr-12 h-12 transition-colors ${
                  confirmPassword && confirmPassword !== password
                    ? "border-red-300 focus:border-red-400"
                    : confirmPassword && confirmPassword === password
                    ? "border-green-400"
                    : "focus:border-indigo-400"
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== password && (
              <p className="text-xs text-red-500 font-medium">Passwords do not match.</p>
            )}
            {confirmPassword && confirmPassword === password && (
              <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Passwords match!
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || !password || !confirmPassword || password !== confirmPassword}
            className="w-full h-14 rounded-xl font-black text-base shadow-lg shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Updating Password…
              </span>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
