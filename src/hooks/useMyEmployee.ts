/**
 * useMyEmployee — Fetches the current user's employee record.
 * 
 * Uses a multi-strategy approach:
 *  1. First tries user_id match (fast path after auth sync)
 *  2. Falls back to email match if user_id lookup fails
 *  3. Returns null + isLinked=false if no employee record is found
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useMyEmployee() {
  const { user } = useAuth();

  const { data: myEmployee, isLoading, refetch } = useQuery({
    queryKey: ["my-employee", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 min cache
    queryFn: async () => {
      if (!user) return null;

      // Strategy 1: Find by user_id (fast path — works after syncUserRecords runs)
      const { data: byUserId } = await (supabase.from("employees") as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (byUserId) return byUserId;

      // Strategy 2: Find by email and auto-link (fallback for first-time login)
      if (user.email) {
        const { data: byEmail } = await (supabase.from("employees") as any)
          .select("*")
          .ilike("email", user.email)
          .maybeSingle();

        if (byEmail) {
          console.log("[useMyEmployee] Auto-linking employee by email:", user.email);
          // Link user_id
          await (supabase.from("employees") as any)
            .update({ user_id: user.id })
            .eq("id", byEmail.id);

          return { ...byEmail, user_id: user.id };
        } else {
          // If no employee record at all, create one
          console.log("[useMyEmployee] No employee record found by email. Creating one...");
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split("@")[0];
          const { data: newEmp, error: insertErr } = await (supabase.from("employees") as any)
            .insert({
              user_id: user.id,
              full_name: fullName,
              email: user.email.toLowerCase(),
              status: 'active',
              joining_date: new Date().toISOString().split('T')[0],
              basic_salary: 0,
              hra: 0,
              conveyance: 0,
              medical: 0,
              special_allowance: 0
            })
            .select("*")
            .maybeSingle();

          if (insertErr) {
            console.error("[useMyEmployee] Failed to create new employee record:", insertErr);
          } else if (newEmp) {
            return newEmp;
          }
        }
      }

      console.warn("[useMyEmployee] No employee record found for user:", user.email);
      return null;
    },
  });

  const isLinked = !!myEmployee;

  return { myEmployee, isLoading, isLinked, refetch };
}
