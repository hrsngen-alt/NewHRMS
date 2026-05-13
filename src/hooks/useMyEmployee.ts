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
        }
      }

      console.warn("[useMyEmployee] No employee record found for user:", user.email);
      return null;
    },
  });

  const isLinked = !!myEmployee;

  return { myEmployee, isLoading, isLinked, refetch };
}
