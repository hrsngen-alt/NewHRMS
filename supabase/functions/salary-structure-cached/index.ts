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
    console.log("🔌 Connected to Redis Cloud for active salary structure caching");
  } catch (err) {
    console.error("❌ Failed to initialize Redis Cloud client for salary structure:", err);
  }
} else {
  console.warn("⚠️ REDIS_URL not configured. Running direct database fallback mode.");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cacheKey = "hrms:salary-structure:active";

    // 1. GET Request: Read cache or fetch from DB
    if (req.method === 'GET') {
      if (redis) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            console.log("⚡ Cache HIT: Returning active salary structures from Redis Cloud");
            return new Response(
              JSON.stringify({ source: 'cache', data: cached }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          console.log("🔍 Cache MISS: Fetching active salary structures from Supabase database");
        } catch (redisError) {
          console.error("❌ Redis Cloud read error:", redisError);
        }
      }

      // Query database
      const { data, error } = await supabase
        .from("employees")
        .select("id,full_name,department,designation,basic_salary,hra,bonus,pf_amount,esic_amount,gratuity_amount,employee_code")
        .eq("status", "active")
        .order("full_name");

      if (error) {
        console.error("❌ Database query error:", error);
        throw error;
      }

      // Populate Cache
      if (redis) {
        try {
          await redis.setex(cacheKey, 300, JSON.stringify(data));
          console.log("💾 Cache POPULATED: Saved active salary structures list to Redis Cloud");
        } catch (cacheError) {
          console.error("⚠️ Failed to write to Redis Cloud cache:", cacheError);
        }
      }

      return new Response(
        JSON.stringify({ source: 'database', data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. POST Request: Webhook invalidation on employee updates
    if (req.method === 'POST') {
      console.log("Invalidation webhook triggered for salary structure!");
      
      if (redis) {
        try {
          await redis.del(cacheKey);
          console.log("🗑️ Cache PURGED successfully from Redis Cloud for:", cacheKey);

          return new Response(
            JSON.stringify({ success: true, message: 'Salary structure cache successfully invalidated from Redis Cloud.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } catch (redisError) {
          console.error("❌ Failed to invalidate Redis Cloud cache:", redisError);
          return new Response(
            JSON.stringify({ error: 'Failed to purge cache', details: redisError.message }),
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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
