import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve directory to load local .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const redisUrl = process.env.REDIS_URL;

console.log("🔍 Checking Redis Cloud Connection...");
console.log("Endpoint details parsed from .env");

if (!redisUrl || redisUrl.includes("your-redis-cloud-endpoint")) {
  console.error("❌ Error: REDIS_URL in .env is not configured with actual credentials!");
  process.exit(1);
}

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  connectTimeout: 5000,
});

async function runDiagnostics() {
  try {
    // 1. PING
    console.log("📡 Sending PING request...");
    const pingResponse = await redis.ping();
    console.log(`✅ PING successful! Server responded: "${pingResponse}"`);

    // 2. Set Test Key
    console.log("💾 Setting diagnostic key 'hrms:test-key'...");
    await redis.setex("hrms:test-key", 60, "Redis Cloud is working perfectly! ⚡");

    // 3. Get Test Key
    const value = await redis.get("hrms:test-key");
    console.log(`📖 Retrieved diagnostic key value: "${value}"`);

    // 4. Clean up
    console.log("🗑️ Cleaning up diagnostic key...");
    await redis.del("hrms:test-key");

    console.log("\n==================================================");
    console.log("🎉 SUCCESS: Your Redis Cloud connection is 100% working!");
    console.log("==================================================");
  } catch (error) {
    console.error("\n==================================================");
    console.error("❌ CONNECTION FAILED: Could not reach Redis Cloud!");
    console.error("==================================================");
    console.error("Error details:", error.message);
  } finally {
    redis.disconnect();
  }
}

runDiagnostics();
