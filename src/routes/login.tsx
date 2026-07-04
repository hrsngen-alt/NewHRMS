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
import { Eye, EyeOff, Mail, ArrowLeft, CheckCircle2, KeyRound, Smartphone, Download, X, Share, PlusSquare } from "lucide-react";
import { cn } from "@/lib/utils";

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

  // App download status
  const [isIOS, setIsIOS] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [activeGuide, setActiveGuide] = useState<"ios" | "mac" | "chrome" | "apk">("ios");

  useEffect(() => {
    const ua = navigator.userAgent;
    
    // iOS check
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Android check
    const isAndroidDevice = /Android/i.test(ua);
    setIsAndroid(isAndroidDevice);

    // Mac check
    const isMacDevice = /Macintosh|MacIntel|MacPPC|Mac68K/i.test(ua) && !isIOSDevice;
    setIsMac(isMacDevice);

    // Safari check (must exclude Chrome, Edge, etc.)
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua);
    setIsSafari(isSafariBrowser);

    // Set initial active guide tab
    if (isIOSDevice) {
      setActiveGuide("ios");
    } else if (isMacDevice) {
      setActiveGuide("mac");
    } else if (isAndroidDevice) {
      setActiveGuide("apk");
    } else {
      setActiveGuide("chrome");
    }

    // Intercept native PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const timer = setTimeout(() => {
      const dismissed = sessionStorage.getItem("pwa_download_banner_dismissed") === "true";
      if (!dismissed) {
        setShowBanner(true);
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setActiveGuide("ios");
      setShowInstallGuide(true);
    } else if (isMac && isSafari) {
      setActiveGuide("mac");
      setShowInstallGuide(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toast.success("Thank you for installing SN Gene HR!");
        setDeferredPrompt(null);
        setShowBanner(false);
      }
    } else if (isAndroid) {
      toast.success("Starting APK download...");
      const link = document.createElement("a");
      link.href = "/app-release.apk";
      link.download = "app-release.apk";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      setActiveGuide(isMac ? "mac" : "chrome");
      setShowInstallGuide(true);
    }
  };

  const getBannerDetails = () => {
    if (isIOS) {
      return {
        description: "Add to home screen for quick entry and live updates",
        buttonText: "Install App",
      };
    }
    if (isMac) {
      return {
        description: isSafari 
          ? "Add SN Gene HR to your Mac Dock for instant access" 
          : "Install SN Gene HR App on your Mac",
        buttonText: "Install App",
      };
    }
    if (isAndroid) {
      return {
        description: "Install APK for instant check-in/out on Android",
        buttonText: "Download APK",
      };
    }
    return {
      description: "Install SN Gene HR on your desktop or mobile device",
      buttonText: "Install App",
    };
  };

  const dismissBanner = () => {
    setShowBanner(false);
    sessionStorage.setItem("pwa_download_banner_dismissed", "true");
  };

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
    <div className="flex flex-col min-h-screen lg:grid lg:grid-cols-2">
      {/* Mobile-only branding banner */}
      <div className="relative lg:hidden bg-blue-600 pt-8 pb-10 px-6 flex flex-col items-center text-center text-white overflow-visible">
        {/* Stacked Wavy Divider Layers (Horizontal) */}
        <div className="absolute left-0 right-0 bottom-0 w-full h-8 pointer-events-none translate-y-[99%] z-20">
          {/* Layer 1 (Backmost - Sky Blue) */}
          <svg className="absolute inset-0 h-full w-full fill-blue-200/50 dark:fill-blue-900/30" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,0 L100,20 C75,55 65,20 50,32 C35,55 15,20 0,20 Z" />
          </svg>
          
          {/* Layer 2 (Medium Blue) */}
          <svg className="absolute inset-0 h-full w-full fill-blue-300/70 dark:fill-blue-800/40" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,0 L100,15 C75,45 65,15 50,25 C35,45 15,15 0,15 Z" />
          </svg>
          
          {/* Layer 3 (Vibrant Blue) */}
          <svg className="absolute inset-0 h-full w-full fill-blue-400/90 dark:fill-blue-700/60" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,0 L100,10 C75,35 65,10 50,18 C35,35 15,10 0,10 Z" />
          </svg>
          
          {/* Layer 4 (Frontmost - Matches solid bg-blue-600) */}
          <svg className="absolute inset-0 h-full w-full fill-blue-600" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,0 L100,5 C75,25 65,5 50,10 C35,25 15,5 0,5 Z" />
          </svg>
        </div>

        <SNLogo className="h-12 w-auto mb-2" />
        <p className="text-xs text-blue-100/90 font-medium max-w-xs leading-relaxed">
          People ops, refined. Onboard, track, pay — all in one simple workspace.
        </p>
      </div>

      {/* Left branding panel (Desktop) */}
      <div className="relative hidden bg-blue-600 p-16 lg:flex lg:flex-col lg:justify-between border-r border-slate-100 dark:border-border/10">
        
        {/* Stacked Wavy Divider Layers (Vertical) */}
        <div className="absolute left-full top-0 bottom-0 w-48 h-full pointer-events-none z-20">
          {/* Layer 1 (Backmost - Sky Blue) */}
          <svg className="absolute inset-0 h-full w-full fill-blue-200/50 dark:fill-blue-900/30" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 C45,15 35,35 60,55 C85,75 50,85 0,100 Z" />
          </svg>
          
          {/* Layer 2 (Medium Blue) */}
          <svg className="absolute inset-0 h-full w-full fill-blue-300/70 dark:fill-blue-800/40" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 C35,15 28,35 48,55 C68,75 40,85 0,100 Z" />
          </svg>
          
          {/* Layer 3 (Vibrant Blue) */}
          <svg className="absolute inset-0 h-full w-full fill-blue-400/90 dark:fill-blue-700/60" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 C25,15 20,35 38,55 C56,75 30,85 0,100 Z" />
          </svg>
          
          {/* Layer 4 (Frontmost - matches solid bg-blue-600) */}
          <svg className="absolute inset-0 h-full w-full fill-blue-600" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 C15,15 12,35 28,55 C44,75 20,85 0,100 Z" />
          </svg>
        </div>

        <div className="relative z-10 flex items-center">
          <SNLogo className="h-16 w-auto" />
        </div>

        <div className="relative z-10 text-white space-y-4">
          <h2 className="font-display text-5xl font-black leading-tight tracking-tight text-white drop-shadow-sm">
            People ops, <br />
            <span className="text-blue-200">refined.</span>
          </h2>
          <p className="max-w-md text-base text-blue-100/90 leading-relaxed font-semibold">
            Onboard, track, pay — all in one beautifully simple workspace tailored for modern growth.
          </p>
        </div>

        <div className="relative z-10 text-xs text-blue-200/60 font-semibold">
          © SN Gene Lab · Modern HRMS
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/40 dark:bg-slate-950/20 pt-12 lg:pt-6">
        <div className="w-full max-w-md bg-white/85 dark:bg-card/85 backdrop-blur-md border border-slate-200/50 dark:border-border/50 rounded-3xl p-8 shadow-2xl shadow-slate-100 dark:shadow-none animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* ─── FORGOT PASSWORD SENT ─────────────────────────────── */}
          {view === "forgot-sent" && (
            <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mx-auto size-20 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                <CheckCircle2 className="size-10" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-black text-foreground">Check your inbox!</h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  We sent a password reset link to <span className="font-bold text-foreground">{forgotEmail}</span>.
                  Check your email and click the link to set a new password.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/50 text-amber-800 text-xs font-medium text-left">
                💡 If you don't see the email within a few minutes, check your spam folder.
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
                      className="pl-10 h-12 rounded-xl border-2 focus:border-primary/50 bg-slate-50/50 dark:bg-slate-900/50"
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
              <h1 className="font-display text-2xl font-black text-foreground tracking-tight">Welcome to SN Gene Lab</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sign in or register your account if this is your first time.</p>
              <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10 text-[10px] font-bold text-primary uppercase tracking-widest leading-relaxed">
                💡 Note: If you were added by HR, please use the "Create account" tab to register your email first.
              </div>

              <Tabs defaultValue="signin" className="mt-6">
                <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl h-11">
                  <TabsTrigger value="signin" className="rounded-lg font-semibold">Sign in</TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg font-semibold">Create account</TabsTrigger>
                </TabsList>

                {/* Sign In */}
                <TabsContent value="signin">
                  <form className="mt-4 space-y-4" onSubmit={handleSubmit("in")}>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-sm font-bold">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input id="email" name="email" type="email" required placeholder="you@company.com" className="pl-10 h-12 rounded-xl border-2 focus:border-primary/50 bg-slate-50/50 dark:bg-slate-900/50" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm font-bold">Password</Label>
                        <button
                          type="button"
                          onClick={() => setView("forgot")}
                          className="text-xs text-primary font-bold hover:underline underline-offset-2 transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Input id="password" name="password" type={showPassword ? "text" : "password"} required placeholder="••••••••" className="pr-12 h-12 rounded-xl border-2 focus:border-primary/50 bg-slate-50/50 dark:bg-slate-900/50" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <Button className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]" disabled={busy}>
                      {busy ? "Signing in..." : "Sign in"}
                    </Button>
                  </form>
                </TabsContent>

                {/* Sign Up */}
                <TabsContent value="signup">
                  <form className="mt-4 space-y-4" onSubmit={handleSubmit("up")}>
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" className="text-sm font-bold">Full name</Label>
                      <Input id="fullName" name="fullName" required placeholder="John Doe" className="h-12 rounded-xl border-2 focus:border-primary/50 bg-slate-50/50 dark:bg-slate-900/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email2" className="text-sm font-bold">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input id="email2" name="email" type="email" required placeholder="you@company.com" className="pl-10 h-12 rounded-xl border-2 focus:border-primary/50 bg-slate-50/50 dark:bg-slate-900/50" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password2" className="text-sm font-bold">Password</Label>
                      <div className="relative">
                        <Input id="password2" name="password" type={showPassword ? "text" : "password"} minLength={8} required placeholder="••••••••" className="pr-12 h-12 rounded-xl border-2 focus:border-primary/50 bg-slate-50/50 dark:bg-slate-900/50" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <Button className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]" disabled={busy}>
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
                  <span className="bg-white dark:bg-card px-3 text-muted-foreground font-medium">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2 border-2 hover:bg-muted/50 transition-all hover:scale-[1.01] active:scale-[0.99] bg-white dark:bg-card text-foreground"
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

      {/* Floating App Download Banner */}
      {showBanner && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-blue-500/20 dark:border-blue-500/10 shadow-2xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Smartphone className="size-6" />
            </div>
            <div>
              <h4 className="font-display font-black text-sm text-foreground">Get the SN Gene HR Mobile App</h4>
              <p className="text-xs text-muted-foreground font-medium mt-0.5 leading-relaxed">
                {getBannerDetails().description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              {getBannerDetails().buttonText}
            </button>
            <button
              onClick={dismissBanner}
              className="size-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground transition-colors cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Universal Install/Download Guide Modal */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowInstallGuide(false)}
              className="absolute top-4 right-4 size-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
            
            <div className="text-center space-y-1 mb-4">
              <div className="mx-auto size-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
                <Smartphone className="size-7" />
              </div>
              <h3 className="font-display font-black text-xl text-foreground mt-2">Install SN Gene HR</h3>
              <p className="text-xs text-muted-foreground font-medium px-2">
                Choose your device platform to view installation instructions.
              </p>
            </div>

            {/* Custom Tab headers */}
            <div className="grid grid-cols-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-bold uppercase tracking-wider mb-6">
              {[
                { id: "ios", label: "iPhone" },
                { id: "mac", label: "Macbook" },
                { id: "chrome", label: "Chrome" },
                { id: "apk", label: "Android APK" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveGuide(tab.id as any)}
                  className={cn(
                    "py-2 rounded-lg transition-all text-center cursor-pointer font-bold",
                    activeGuide === tab.id
                      ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="space-y-4 min-h-[220px]">
              {activeGuide === "ios" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest leading-relaxed">
                    👉 Open in Safari on your iPhone/iPad
                  </div>
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
                      <p className="text-muted-foreground font-medium"><span className="font-bold text-foreground">Tap Safari's Share button</span> <Share className="size-3.5 text-blue-600 inline mx-0.5 animate-pulse" /> at the bottom or top of your browser.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
                      <p className="text-muted-foreground font-medium"><span className="font-bold text-foreground">Select "Add to Home Screen"</span> <PlusSquare className="size-3.5 text-blue-600 inline mx-0.5" /> from the actions menu list.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
                      <p className="text-muted-foreground font-medium"><span className="font-bold text-foreground">Tap "Add"</span> in the upper-right corner of the prompt screen to confirm.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeGuide === "mac" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-xl text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest leading-relaxed">
                    👉 Requires Safari on macOS Sonoma or newer
                  </div>
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
                      <p className="text-muted-foreground font-medium"><span className="font-bold text-foreground">Open "File" in macOS top menu bar</span> while browsing this website in Safari.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
                      <p className="text-muted-foreground font-medium"><span className="font-bold text-foreground">Click "Add to Dock..."</span> from the dropdown file menu items.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
                      <p className="text-muted-foreground font-medium"><span className="font-bold text-foreground">Click "Add"</span> in the prompt window. SN Gene HR will now be in your Dock!</p>
                    </div>
                  </div>
                </div>
              )}

              {activeGuide === "chrome" && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
                      <p className="text-muted-foreground font-medium"><span className="font-bold text-foreground">Look at your address bar</span> at the top of your desktop browser.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
                      <p className="text-muted-foreground font-medium"><span className="font-bold text-foreground">Click the Install icon</span> (looks like a monitor with a down arrow, or a '+' sign) on the right side of the address bar.</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
                      <p className="text-muted-foreground font-medium">Or open the browser's menu (three dots <span className="font-bold text-foreground">⋮</span>) and select <span className="font-bold text-foreground">"Install SN Gene HR"</span>.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeGuide === "apk" && (
                <div className="space-y-5 animate-in fade-in duration-300 text-center py-2">
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed px-4">
                    Download the compiled Android APK file directly to install natively on any Android smartphone.
                  </p>
                  <Button
                    onClick={() => {
                      toast.success("Starting APK download...");
                      const link = document.createElement("a");
                      link.href = "/app-release.apk";
                      link.download = "app-release.apk";
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="h-12 w-full max-w-xs rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-500/15"
                  >
                    <Download className="size-4" /> Download APK File
                  </Button>
                </div>
              )}
            </div>

            <Button
              onClick={() => setShowInstallGuide(false)}
              className="w-full h-12 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 mt-6 cursor-pointer"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
