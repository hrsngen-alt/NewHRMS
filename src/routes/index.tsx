import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Clock, FileText, TrendingUp } from "lucide-react";

import { SNLogo } from "@/components/SNLogo";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center">
          <div className="h-12 w-32 bg-white rounded-xl p-2 flex items-center justify-center shadow-lg shrink-0">
            <SNLogo className="h-8 w-auto" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/login"><Button>Get started</Button></Link>
        </div>
      </header>

      <section className="container mx-auto px-6 pt-16 pb-24 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-card">
          <span className="size-1.5 rounded-full bg-success" /> Now with automated payroll
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
          Run your people ops <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">like clockwork</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          A modern HRMS for startups and growing teams. Employees, attendance, leaves and payroll — beautifully unified.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/login"><Button size="lg" className="gap-2">Start free <ArrowRight className="size-4" /></Button></Link>
          <Button size="lg" variant="outline">Book demo</Button>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-4 md:grid-cols-4">
          {[
            { icon: Users, title: "Employees", desc: "Profiles, docs, lifecycle" },
            { icon: Clock, title: "Attendance", desc: "Check-in & overtime" },
            { icon: FileText, title: "Leaves", desc: "Requests & approvals" },
            { icon: TrendingUp, title: "Payroll", desc: "Auto slips in PDF" },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 text-left shadow-card">
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl gradient-primary text-primary-foreground">
                <f.icon className="size-5" />
              </div>
              <div className="font-semibold">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
