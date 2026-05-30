import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"
import Redis from "npm:ioredis@5.4.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Initialize Redis client outside serve loop to support connection pooling
const redisUrl = Deno.env.get("REDIS_URL");
let redis: Redis | null = null;

const isRedisConfigured = redisUrl && redisUrl !== "rediss://default:password@your-redis-cloud-endpoint:port";

if (isRedisConfigured) {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 10000,
    });
    console.log("🔌 Connected to Redis Cloud for employees caching");
  } catch (err) {
    console.error("❌ Failed to initialize Redis Cloud client:", err);
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

    const cacheKey = "hrms:employees";

    // 1. GET Cache / Fetch request
    if (req.method === 'GET') {
      if (redis) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            console.log("⚡ Cache HIT: Returning employees from Redis Cloud");
            return new Response(
              JSON.stringify({ source: 'cache', data: cached }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          console.log("🔍 Cache MISS: Fetching employees from Supabase database");
        } catch (redisError) {
          console.error("❌ Redis Cloud read error:", redisError);
        }
      }

      // DB Fallback on miss or Redis disabled
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("❌ Database query error:", error);
        throw error;
      }

      // Populate Cache
      if (redis) {
        try {
          // setex in ioredis: key, ttl (seconds), value
          await redis.setex(cacheKey, 300, JSON.stringify(data));
          console.log("💾 Cache POPULATED: Saved employees list to Redis Cloud");
        } catch (cacheError) {
          console.error("⚠️ Failed to write to Redis Cloud cache:", cacheError);
        }
      }

      return new Response(
        JSON.stringify({ source: 'database', data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. POST Webhook / Invalidation request
    if (req.method === 'POST') {
      console.log("🔄 Invalidation webhook triggered by database change!");
      
      if (redis) {
        try {
          await redis.del(cacheKey);
          console.log("🗑️ Cache PURGED successfully from Redis Cloud for:", cacheKey);
          
          return new Response(
            JSON.stringify({ success: true, message: 'Redis Cloud cache successfully invalidated.' }),
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
