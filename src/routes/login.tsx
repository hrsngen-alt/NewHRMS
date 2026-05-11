import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

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
        </div>
      </div>
    </div>
  );
}
