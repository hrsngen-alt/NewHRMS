import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/dashboard" }); }, [user, navigate]);

  const handleSubmit = (mode: "in" | "up") => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
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

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden gradient-hero p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2 text-primary-foreground">
          <div className="size-9 rounded-xl bg-white/15 backdrop-blur" />
          <span className="font-display text-xl font-bold">Pulse HR</span>
        </div>
        <div className="text-primary-foreground">
          <h2 className="font-display text-4xl font-bold leading-tight">People ops, refined.</h2>
          <p className="mt-3 max-w-sm text-white/80">Onboard, track, pay — all in one beautifully simple workspace.</p>
        </div>
        <div className="text-xs text-white/60">© Pulse HR · Modern HRMS</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="font-display text-2xl font-bold">Welcome to Pulse HR</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your portal or create a new account if this is your first time.</p>
          <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10 text-[10px] font-bold text-primary uppercase tracking-widest leading-relaxed">
            💡 Note: If you were added by HR, please use the "Create account" tab to register your email first.
          </div>

          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form className="mt-4 space-y-4" onSubmit={handleSubmit("in")}>
                <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
                <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required /></div>
                <Button className="w-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="mt-4 space-y-4" onSubmit={handleSubmit("up")}>
                <div><Label htmlFor="fullName">Full name</Label><Input id="fullName" name="fullName" required /></div>
                <div><Label htmlFor="email2">Email</Label><Input id="email2" name="email" type="email" required /></div>
                <div><Label htmlFor="password2">Password</Label><Input id="password2" name="password" type="password" minLength={8} required /></div>
                <Button className="w-full" disabled={busy}>{busy ? "Creating..." : "Create account"}</Button>
                <p className="text-center text-xs text-muted-foreground">First user can be promoted to admin from the database.</p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 font-black text-slate-400 tracking-widest">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              className="h-12 rounded-xl border-2 font-bold gap-3 hover:bg-slate-50 transition-all"
              onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}
            >
              <svg className="size-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </Button>
            <Button 
              variant="outline" 
              className="h-12 rounded-xl border-2 font-bold gap-3 hover:bg-slate-50 transition-all"
              onClick={() => supabase.auth.signInWithOAuth({ provider: 'azure', options: { redirectTo: window.location.origin } })}
            >
              <svg className="size-5" viewBox="0 0 23 23">
                <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              Microsoft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
