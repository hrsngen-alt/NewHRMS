import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @deno-types="npm:@types/web-push@^3.6.0"
import webpush from "npm:web-push@3.6.7";

serve(async (req) => {
  try {
    // We expect a Database Webhook payload (JSON)
    const payload = await req.json();

    // Ensure it's an INSERT on the notifications table
    if (payload.type !== "INSERT" || payload.table !== "notifications") {
      return new Response(JSON.stringify({ message: "Ignored: Not an insert on notifications" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const notification = payload.record;
    if (!notification || !notification.user_id) {
      return new Response(JSON.stringify({ error: "No user_id found in record" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Configure Web Push with VAPID keys
    // You MUST set these secrets using:
    // supabase secrets set VAPID_SUBJECT="mailto:your-email@example.com"
    // supabase secrets set VAPID_PUBLIC_KEY="..."
    // supabase secrets set VAPID_PRIVATE_KEY="..."
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@pulsehr.com";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("VAPID keys not configured in Edge Function secrets.");
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // Initialize Supabase Client (Service Role for admin access to get subscriptions)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's push subscriptions
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", notification.user_id);

    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No push subscriptions for user" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const pushPayload = JSON.stringify({
      title: notification.title || "New Notification",
      body: notification.message || "You have a new notification.",
      data: {
        url: notification.link || "/",
      },
    });

    const results = [];

    // Send push notification to all devices for this user
    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, pushPayload);
        results.push({ endpoint: sub.endpoint, success: true });
      } catch (err: any) {
        // If the subscription is gone (e.g. user revoked permission), delete it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          results.push({ endpoint: sub.endpoint, success: false, reason: "Gone - deleted from DB" });
        } else {
          console.error("Failed to send push:", err);
          results.push({ endpoint: sub.endpoint, success: false, error: err.message });
        }
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error processing push:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
