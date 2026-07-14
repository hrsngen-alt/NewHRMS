import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"
import Redis from "npm:ioredis@5.4.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const redisUrl = Deno.env.get("REDIS_URL");
let redis: Redis | null = null;
const isRedisConfigured = redisUrl && redisUrl !== "rediss://default:password@your-redis-cloud-endpoint:port";

if (isRedisConfigured) {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 10000,
    });
    console.log("🔌 Connected to Redis Cloud for attendance caching");
  } catch (err) {
    console.error("❌ Failed to initialize Redis Cloud client for attendance:", err);
  }
} else {
  console.warn("⚠️ REDIS_URL not configured. Running direct database fallback mode.");
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. GET Request: Read cache or fetch from DB
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const role = url.searchParams.get("role") || "employee";
      const employeeId = url.searchParams.get("employee_id");
      const isAdmin = role === "admin";

      let cacheKey = "hrms:attendance:admin";
      if (!isAdmin && employeeId) {
        cacheKey = `hrms:attendance:employee:${employeeId}`;
      } else if (!isAdmin && !employeeId) {
        throw new Error("Missing employee_id parameter for employee query.");
      }

      if (redis) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            console.log(`⚡ Cache HIT: Returning attendance logs from Redis Cloud for: ${cacheKey}`);
            return new Response(
              JSON.stringify({ source: 'cache', data: cached }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          console.log(`🔍 Cache MISS: Fetching attendance logs from DB for: ${cacheKey}`);
        } catch (redisError) {
          console.error("❌ Redis Cloud read error:", redisError);
        }
      }

      // Process auto checkouts before querying database
      try {
        await supabase.rpc('process_auto_checkouts');
      } catch (err) {
        console.error("Error executing process_auto_checkouts RPC:", err);
      }

      // Query Database
      let dbQuery = supabase
        .from("attendance")
        .select("*, employees(full_name, employee_code, department, attendance_policy_id)")
        .order("check_in", { ascending: false });

      if (!isAdmin && employeeId) {
        dbQuery = dbQuery.eq("employee_id", employeeId).limit(200);
      } else {
        dbQuery = dbQuery.limit(500);
      }

      const { data, error } = await dbQuery;
      if (error) throw error;

      // Populate Cache
      if (redis) {
        try {
          await redis.setex(cacheKey, 300, JSON.stringify(data));
          console.log(`💾 Cache POPULATED: Saved attendance logs to Redis Cloud for ${cacheKey}`);
        } catch (cacheError) {
          console.error("⚠️ Failed to write to Redis Cloud cache:", cacheError);
        }
      }

      return new Response(
        JSON.stringify({ source: 'database', data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. POST Request: Webhook invalidation on attendance logs update
    if (req.method === 'POST') {
      let targetEmployeeId: string | null = null;
      try {
        const body = await req.json();
        const record = body.record || body.old_record || body;
        targetEmployeeId = record?.employee_id || null;
      } catch (parseError) {
        console.warn("Could not parse JSON body of webhook invalidation:", (parseError as any).message);
      }

      if (redis) {
        try {
          // Always invalidate the admin cache
          await redis.del("hrms:attendance:admin");
          console.log("🗑️ Purged admin attendance cache from Redis Cloud");

          // Invalidate the specific employee's cache if employee_id is resolved
          if (targetEmployeeId) {
            const empCacheKey = `hrms:attendance:employee:${targetEmployeeId}`;
            await redis.del(empCacheKey);
            console.log(`🗑️ Purged individual employee attendance cache: ${empCacheKey}`);
          }

          return new Response(
            JSON.stringify({ success: true, message: 'Attendance cache purged from Redis Cloud successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (redisError) {
          console.error("❌ Redis Cloud purge error:", redisError);
          return new Response(
            JSON.stringify({ error: 'Failed to purge cache', details: (redisError as any).message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Redis Cloud not configured, invalidation skipped.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: corsHeaders }
    )
  } catch (error) {
    console.error("🔥 Edge Function error:", error);
    return new Response(
      JSON.stringify({ error: (error as any).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
