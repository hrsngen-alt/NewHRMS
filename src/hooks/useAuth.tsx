import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Role = "admin" | "manager" | "employee" | "hr";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: Role | null;
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
  loading: boolean;
  employeeId: string | null; // Expose linked employee ID directly
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
  const cleanEmail = (email || "").trim().toLowerCase();
  if (ADMIN_EMAILS.some((e) => e.toLowerCase() === cleanEmail)) {
    return "admin";
  }
  try {
    const { data: userRolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const basicRoles = (userRolesData ?? []).map((r) => r.role as Role);
    if (basicRoles.includes("admin")) return "admin";

    // Check profiles table as well
    const { data: profData } = await (supabase.from("profiles") as any)
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profData?.role === "admin") return "admin";
    if (profData?.role === "manager" && !basicRoles.includes("manager")) {
      basicRoles.push("manager");
    }

    // Also check the new Enterprise Access Control custom roles
    const { data: empData } = await (supabase.from("employees") as any)
      .select(`
        id,
        full_name,
        employee_code,
        employee_custom_roles (
          custom_roles (
            name
          )
        )
      `)
      .eq("user_id", userId)
      .maybeSingle();

    if (empData?.employee_custom_roles) {
      for (const ecr of empData.employee_custom_roles) {
        const roleName = ecr.custom_roles?.name?.toLowerCase() || "";
        // Grant admin privileges to HR Admin, System Admin, etc.
        if (roleName.includes("admin") || roleName.includes("hr")) {
          return "admin";
        }
        if (roleName.includes("manager")) {
          if (!basicRoles.includes("manager")) basicRoles.push("manager");
        }
      }
    }

    // Check if this employee is configured as a Reporting Manager for any team members
    if (empData?.full_name || empData?.id) {
      const matchConditions = [
        empData.full_name ? `reporting_manager.eq."${empData.full_name}"` : null,
        empData.id ? `reporting_manager.eq."${empData.id}"` : null,
        empData.employee_code ? `reporting_manager.eq."${empData.employee_code}"` : null
      ].filter(Boolean).join(",");

      const { data: directReports } = await supabase
        .from("employees")
        .select("id")
        .or(matchConditions)
        .limit(1);

      if (directReports && directReports.length > 0) {
        if (!basicRoles.includes("manager")) basicRoles.push("manager");
      }
    }

    return basicRoles.includes("manager") ? "manager" : basicRoles[0] ?? "employee";
  } catch (err) {
    console.error("[Auth] fetchRole error:", err);
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("cached_role") as Role;
        if (cached) return cached;
      } catch {}
    }
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

    let linkedEmpId = null;

    // 2. First check if employee is already linked to this user_id (fast path)
    const { data: alreadyLinked } = await (supabase.from("employees") as any)
      .select("id, user_id, email, full_name, status, login_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (alreadyLinked) {
      if (alreadyLinked.status === "Terminated") {
        await supabase.auth.signOut();
        throw new Error("Your account has been terminated. Please contact HR.");
      }
      if (alreadyLinked.status === "Resigned") {
        await supabase.auth.signOut();
        throw new Error("Your account is deactivated due to resignation.");
      }
      if (alreadyLinked.login_enabled === false) {
        await supabase.auth.signOut();
        throw new Error("Your access has been disabled by HR.");
      }
      console.log("[Auth] Employee already linked:", alreadyLinked.id);
      linkedEmpId = alreadyLinked.id;
    } else {
      // 3. Try to find employee by email (case-insensitive) and link them
      const { data: employee } = await (supabase.from("employees") as any)
        .select("id, user_id, email, full_name, status, login_enabled")
        .ilike("email", email)
        .maybeSingle() as any;

      if (employee) {
        if (employee.status === "Terminated") {
          await supabase.auth.signOut();
          throw new Error("Your account has been terminated. Please contact HR.");
        }
        if (employee.status === "Resigned") {
          await supabase.auth.signOut();
          throw new Error("Your account is deactivated due to resignation.");
        }
        if (employee.login_enabled === false) {
          await supabase.auth.signOut();
          throw new Error("Your access has been disabled by HR.");
        }
        console.log("[Auth] Linking employee record for", email, "-> id:", employee.id);
        const updates: any = { user_id: user.id };
        // If the employee record has no name, use the one from Auth
        if (!employee.full_name) updates.full_name = fullName;

        await (supabase.from("employees") as any).update(updates).eq("id", employee.id);
        linkedEmpId = employee.id;
      } else {
        if (isAdminEmail) {
          console.log("[Auth] Admin email not found in employees table. Continuing as admin without employee record.");
        } else {
          console.log("[Auth] Unauthorized email attempted login:", email);
          await supabase.auth.signOut();
          toast.error(`Access Denied: The email "${email}" is not registered in this system. Please use your official company account (e.g. @sngenelab.com).`);
          throw new Error("Access Denied: Your email is not registered in the system. Please contact HR.");
        }
      }
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
    return linkedEmpId;
  } catch (err) {
    console.error("[Auth] Sync failed:", err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("cached_role") as Role;
        if (cached && ["admin", "manager", "employee", "hr"].includes(cached)) return cached;
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("cached_employee_id") || null;
      } catch {}
    }
    return null;
  });

  useEffect(() => {
    console.log("[Auth] Provider mounted. Starting initial checks...");
    let activeSessionUserId: string | null = null;

    // Safety valve: Ensure loading is always set to false after 5 seconds max
    const safetyTimeout = setTimeout(() => {
      console.warn("[Auth] Initialization taking too long, forcing loading false");
      setRole((prev) => {
        if (prev) return prev;
        if (typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem("cached_role") as Role;
            if (cached) return cached;
          } catch {}
        }
        return "employee";
      });
      setLoading(false);
    }, 5000);

    const handleSessionInit = async (s: Session | null) => {
      if (!s?.user) {
        setSession(null);
        setUser(null);
        setRole(null);
        setEmployeeId(null);
        setLoading(false);
        activeSessionUserId = null;
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("cached_role");
            localStorage.removeItem("cached_employee_id");
          } catch {}
        }
        return;
      }

      setSession(s);
      setUser(s.user);

      // Skip full re-sync if session is already initialized for this user
      if (activeSessionUserId === s.user.id) {
        setLoading(false);
        return;
      }
      activeSessionUserId = s.user.id;

      try {
        console.log("[Auth] Initializing user session for:", s.user.email);

        // 1. Fetch role immediately (fast path - avoids blocking on employee DB sync)
        const r = await fetchRole(s.user.id, s.user.email ?? "");
        console.log("[Auth] Initialized successfully. Role:", r);
        setRole(r);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("cached_role", r);
          } catch {}
        }

        // Release loading immediately once role and user are set!
        setLoading(false);
        clearTimeout(safetyTimeout);

        // 2. Fetch/link employee ID in background without blocking role or UI render
        syncUserRecords(s.user)
          .then((empId) => {
            if (empId) {
              setEmployeeId(empId);
              if (typeof window !== "undefined") {
                try {
                  localStorage.setItem("cached_employee_id", empId);
                } catch {}
              }
            }
          })
          .catch((syncErr) => {
            console.warn("[Auth] Background employee sync warning:", syncErr);
          });
      } catch (err) {
        console.error("[Auth] Initial session check failed:", err);
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    };

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleSessionInit(session);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] onAuthStateChange event:", event, "User:", session?.user?.email);

      if (event === "SIGNED_OUT") {
        handleSessionInit(null);
      } else if (session) {
        handleSessionInit(session);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const isAdminEmail = ADMIN_EMAILS.includes(cleanEmail);

    if (!isAdminEmail) {
      try {
        const { data: emp } = await (supabase.from("employees") as any)
          .select("id, status, login_enabled")
          .ilike("email", cleanEmail)
          .maybeSingle();

        if (!emp) {
          setLoading(false);
          return {
            error: `Access Denied: The email "${email.trim()}" is not registered in this system. Please use your official registered company email (e.g. your @sngenelab.com account) or contact HR.`
          };
        }

        if (emp.status === "Terminated") {
          setLoading(false);
          return { error: "Your employment has been marked as Terminated. Login is disabled. Please contact HR." };
        }
        if (emp.status === "Resigned") {
          setLoading(false);
          return { error: "Your account is deactivated due to resignation. Please contact HR." };
        }
        if (emp.login_enabled === false) {
          setLoading(false);
          return { error: "Your login access has been disabled by HR." };
        }
      } catch (checkErr) {
        console.error("[Auth] Pre-login employee check error:", checkErr);
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    return { error: null };
  };

  const signUp: AuthContextValue["signUp"] = async (email, password, fullName) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const isAdminEmail = ADMIN_EMAILS.includes(cleanEmail);

    try {
      const { data: existingEmp } = await (supabase.from("employees") as any)
        .select("id, user_id, status, login_enabled")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (!existingEmp && !isAdminEmail) {
        setLoading(false);
        return { 
          error: `Access Denied: The email "${email.trim()}" is not registered in this system. Only pre-registered employees can create an account. Please use your official company email (e.g. your @sngenelab.com account) or contact HR.` 
        };
      }

      if (existingEmp && existingEmp.user_id) {
        setLoading(false);
        return { error: "An account already exists for this email. Please sign in instead." };
      }
      if (existingEmp && existingEmp.status === "Terminated") {
        setLoading(false);
        return { error: "This employee record is marked as Terminated." };
      }
      if (existingEmp && existingEmp.login_enabled === false) {
        setLoading(false);
        return { error: "Login access for this employee has been disabled by HR." };
      }
    } catch (err) {
      console.error("[Auth] Existing email check failed:", err);
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
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

  const signInWithGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    return { error: null };
  };

  const signOut = async () => {
    setEmployeeId(null);
    setRole(null);
    setUser(null);
    setSession(null);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("cached_role");
        localStorage.removeItem("cached_employee_id");
      } catch {}
    }
    await supabase.auth.signOut();
  };

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isEmployee = role === "employee";

  return (
    <AuthContext.Provider value={{ user, session, role, isAdmin, isManager, isEmployee, loading, employeeId, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
