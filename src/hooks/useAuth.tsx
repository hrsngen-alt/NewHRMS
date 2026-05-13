import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "employee";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: Role | null;
  loading: boolean;
  employeeId: string | null; // Expose linked employee ID directly
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Centralized admin list
const ADMIN_EMAILS = [
  "admin@pulsehr.com",
  "admin@admin.com",
  "admin1@admin.com",
  "hr@pulsehr.com",
  "hardik@pulsehr.com",
  "hrsngen@gmail.com", // Added you as requested
  "admin@pulse.com",    // Added the pulse admin
  "admin12@pulse.com"
];

async function fetchRole(userId: string, email: string): Promise<Role> {
  if (ADMIN_EMAILS.includes(email.toLowerCase())) {
    return "admin";
  }
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (data ?? []).map((r) => r.role as Role);
    return roles.includes("admin") ? "admin" : roles[0] ?? "employee";
  } catch {
    return "employee";
  }
}

/**
 * Self-healing function to link Auth users to their employee records.
 * Returns the linked employee_id if found.
 */
async function syncUserRecords(user: User): Promise<string | null> {
  try {
    const email = user.email;
    if (!email) return null;

    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || email.split("@")[0];

    const isAdminEmail = ADMIN_EMAILS.includes(email.toLowerCase());

    // 1. Ensure profile exists
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!profile) {
      console.log("[Auth] Creating profile for", email);
      await (supabase.from("profiles") as any).upsert({
        id: user.id,
        full_name: fullName,
        role: isAdminEmail ? "admin" : "employee",
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }

    // 2. First check if employee is already linked to this user_id (fast path)
    const { data: alreadyLinked } = await (supabase.from("employees") as any)
      .select("id, user_id, email, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (alreadyLinked) {
      console.log("[Auth] Employee already linked:", alreadyLinked.id);
      return alreadyLinked.id;
    }

    // 3. Try to find employee by email (case-insensitive) and link them
    const { data: employee } = await (supabase.from("employees") as any)
      .select("id, user_id, email, full_name")
      .ilike("email", email)
      .maybeSingle() as any;

    if (employee) {
      console.log("[Auth] Linking employee record for", email, "-> id:", employee.id);
      const updates: any = { user_id: user.id };
      // If the employee record has no name, use the one from Auth
      if (!employee.full_name) updates.full_name = fullName;

      await (supabase.from("employees") as any).update(updates).eq("id", employee.id);
      return employee.id;
    }

    // 4. Ensure roles are set correctly
    const { data: existingRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

    // Check if current role matches our ADMIN_EMAILS list
    const hasAdminRole = existingRoles?.some(r => r.role === "admin");

    if (isAdminEmail && !hasAdminRole) {
      console.log("[Auth] Promoting user to admin based on email list...");
      // Remove any old roles and set as admin
      await supabase.from("user_roles").delete().eq("user_id", user.id);
      await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });
      await (supabase.from("profiles") as any).update({ role: "admin" }).eq("id", user.id);
    } else if (!existingRoles || existingRoles.length === 0) {
      await supabase.from("user_roles").insert({ user_id: user.id, role: "employee" });
      await (supabase.from("profiles") as any).update({ role: "employee" }).eq("id", user.id);
    }

    console.log("[Auth] Sync complete for:", email, "Role:", isAdminEmail ? "admin" : "employee");
    return null;
  } catch (err) {
    console.error("[Auth] Sync failed:", err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    console.log("[Auth] Provider mounted. Starting initial checks...");

    // Safety valve: Ensure loading is always set to false after 5 seconds max
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("[Auth] Initialization taking too long, forcing loading false");
        setLoading(false);
      }
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      try {
        console.log("[Auth] getSession returned:", !!s);
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          // Perform sync but don't block the UI for more than 1.5 seconds total
          const [empId, r] = await Promise.all([
            Promise.race([
              syncUserRecords(s.user),
              new Promise<null>(res => setTimeout(() => res(null), 1500))
            ]),
            Promise.race([
              fetchRole(s.user.id, s.user.email ?? ""),
              new Promise<Role>(res => setTimeout(() => res("employee" as Role), 1500))
            ])
          ]);
          console.log("[Auth] Role:", r, "EmployeeId:", empId);
          setRole(r);
          setEmployeeId(empId as string | null);
        }
      } catch (err) {
        console.error("[Auth] Initial session check failed:", err);
      } finally {
        console.log("[Auth] Setting loading false");
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      console.log("[Auth] onAuthStateChange:", _e, !!s);
      try {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          const [empId, r] = await Promise.all([
            Promise.race([
              syncUserRecords(s.user),
              new Promise<null>(res => setTimeout(() => res(null), 1500))
            ]),
            Promise.race([
              fetchRole(s.user.id, s.user.email ?? ""),
              new Promise<Role>(res => setTimeout(() => res("employee" as Role), 1500))
            ])
          ]);
          console.log("[Auth] Role:", r, "EmployeeId:", empId);
          setRole(r);
          setEmployeeId(empId as string | null);
        } else {
          setRole(null);
          setEmployeeId(null);
        }
      } catch (err) {
        console.error("[Auth] Auth state change processing failed:", err);
      } finally {
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    return { error: null };
  };

  const signUp: AuthContextValue["signUp"] = async (email, password, fullName) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    if (data.user) {
      const empId = await syncUserRecords(data.user);
      setEmployeeId(empId);
    }
    setLoading(false);
    return { error: null };
  };

  const signOut = async () => {
    setEmployeeId(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, employeeId, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
