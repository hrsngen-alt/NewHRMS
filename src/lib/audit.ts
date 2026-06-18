import { supabase } from "@/integrations/supabase/client";

interface LogAuditParams {
  action: string;
  module: string;
  details?: string;
}

/**
 * Utility to log security and system actions into the `security_audit_logs` table.
 */
export async function logSecurityAudit({ action, module, details }: LogAuditParams) {
  try {
    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 2. Find employee name
    const { data: employee } = await supabase
      .from("employees")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const employeeName = employee?.full_name || user.email || "Unknown User";

    // 3. Attempt to fetch public IP (non-blocking)
    let ipAddress = "127.0.0.1";
    try {
      const ipRes = await Promise.race([
        fetch("https://api.ipify.org?format=json").then(res => res.json()),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000))
      ]);
      if (ipRes && ipRes.ip) {
        ipAddress = ipRes.ip;
      }
    } catch {
      // Fallback if IP fetch fails or times out
    }

    // 4. Insert log
    await supabase.from("security_audit_logs" as any).insert({
      user_id: user.id,
      employee_name: employeeName,
      action,
      module,
      details: details || "",
      ip_address: ipAddress
    });
  } catch (err) {
    console.error("[logSecurityAudit] Failed to log action:", err);
  }
}
