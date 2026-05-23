import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const inviteInputSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string(),
});

export const inviteEmployeeServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(inviteInputSchema)
  .handler(async ({ data }) => {
    if (!data.email) {
      throw new Error("Email is required for invitation");
    }

    const { data: inviteData, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      {
        redirectTo: data.redirectTo,
      }
    );

    if (error) {
      console.error(`[Invite Server Fn] Failed to invite ${data.email}:`, error);
      throw new Error(error.message);
    }

    console.log(`[Invite Server Fn] Successfully invited ${data.email}`);
    return inviteData;
  });
