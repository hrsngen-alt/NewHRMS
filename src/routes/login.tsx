import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SNLogo } from "@/components/SNLogo";
import { Eye, EyeOff, Mail, ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

type View = "auth" | "forgot" | "forgot-sent";

function LoginPage() {
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState<View>("auth");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/dashboard" }); }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(error);
      setBusy(false);
    }
  };

  const handleSubmit = (mode: "in" | "up") => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || fd.get("email2"));
    const password = String(fd.get("password"));
    setBusy(true);
    if (mode === "in") {
      const { error } = await signIn(email, password);
      if (error) toast.error(error); else toast.success("Welcome back!");
    } else {
      const fullName = String(fd.get("fullName"));
      const { error } = await signUp(email, password, fullName);
      if (error) toast.error(error); else toast.success("Account created. You're in!");
    }
    setBusy(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return toast.error("Please enter your email address.");
    setForgotBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotBusy(false);
    if (error) {
      toast.error(error.message || "Failed to send reset email.");
    } else {
      setView("forgot-sent");
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left branding panel */}
      <div className="hidden gradient-hero p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center text-indigo-950">
          <div className="h-16 w-40 bg-white rounded-2xl p-2.5 flex items-center justify-center shadow-lg shrink-0">
            <SNLogo className="h-10 w-auto" />
          </div>
        </div>
        <div className="text-indigo-950">
          <h2 className="font-display text-4xl font-bold leading-tight">People ops, refined.</h2>
          <p className="mt-3 max-w-sm text-indigo-900/80">Onboard, track, pay — all in one beautifully simple workspace.</p>
        </div>
        <div className="text-xs text-indigo-900/60">© SN Gene Lab · Modern HRMS</div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* ─── FORGOT PASSWORD SENT ─────────────────────────────── */}
          {view === "forgot-sent" && (
            <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mx-auto size-20 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <CheckCircle2 className="size-10" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-black text-foreground">Check your inbox!</h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  We sent a password reset link to <span className="font-bold text-foreground">{forgotEmail}</span>.
                  Check your email and click the link to set a new password.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium text-left">
                💡 If you don't see the email within a few minutes, check your spam or junk folder.
              </div>
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl font-bold gap-2"
                onClick={() => { setView("auth"); setForgotEmail(""); }}
              >
                <ArrowLeft className="size-4" /> Back to Sign In
              </Button>
            </div>
          )}

          {/* ─── FORGOT PASSWORD FORM ────────────────────────────────── */}
          {view === "forgot" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={() => { setView("auth"); setForgotEmail(""); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 font-medium"
              >
                <ArrowLeft className="size-4" /> Back to Sign In
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <KeyRound className="size-6" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-black text-foreground">Forgot Password?</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">No worries, we'll send you a reset link.</p>
                </div>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email" className="text-sm font-bold">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="pl-10 h-12 rounded-xl border-2 focus:border-primary/50"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={forgotBusy}
                  className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {forgotBusy ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Sending reset link...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Mail className="size-4" /> Send Reset Link
                    </span>
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* ─── SIGN IN / SIGN UP TABS ──────────────────────────────── */}
          {view === "auth" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="font-display text-2xl font-bold">Welcome to SN Gene Lab</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to your portal or create a new account if this is your first time.</p>
              <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10 text-[10px] font-bold text-primary uppercase tracking-widest leading-relaxed">
                💡 Note: If you were added by HR, please use the "Create account" tab to register your email first.
              </div>

              <Tabs defaultValue="signin" className="mt-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create account</TabsTrigger>
                </TabsList>

                {/* Sign In */}
                <TabsContent value="signin">
                  <form className="mt-4 space-y-4" onSubmit={handleSubmit("in")}>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" required className="mt-1 h-11 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <button
                          type="button"
                          onClick={() => setView("forgot")}
                          className="text-xs text-primary font-bold hover:underline underline-offset-2 transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Input id="password" name="password" type={showPassword ? "text" : "password"} required className="pr-12 h-11 rounded-xl" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <Button className="w-full h-12 rounded-xl text-sm font-bold shadow-md shadow-primary/20" disabled={busy}>
                      {busy ? "Signing in..." : "Sign in"}
                    </Button>
                  </form>
                </TabsContent>

                {/* Sign Up */}
                <TabsContent value="signup">
                  <form className="mt-4 space-y-4" onSubmit={handleSubmit("up")}>
                    <div>
                      <Label htmlFor="fullName">Full name</Label>
                      <Input id="fullName" name="fullName" required className="mt-1 h-11 rounded-xl" />
                    </div>
                    <div>
                      <Label htmlFor="email2">Email</Label>
                      <Input id="email2" name="email" type="email" required className="mt-1 h-11 rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password2">Password</Label>
                      <div className="relative">
                        <Input id="password2" name="password" type={showPassword ? "text" : "password"} minLength={8} required className="pr-12 h-11 rounded-xl" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <Button className="w-full h-12 rounded-xl text-sm font-bold" disabled={busy}>
                      {busy ? "Creating..." : "Create account"}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">First user can be promoted to admin from the database.</p>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-3 text-muted-foreground font-medium">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 border-2 hover:bg-muted/50 transition-all hover:scale-[1.01] active:scale-[0.99]"
                onClick={handleGoogleSignIn}
                disabled={busy}
              >
                <svg className="size-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Sign in with Google
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
