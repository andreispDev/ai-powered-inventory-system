import "server-only";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { LIMITS, memoryLimit, type LimitClass, type LimitResult } from "./limits";

// Sliding window: drop old hits, count, then add this one if there's room.
const SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[3]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return tonumber(oldest[2]) + tonumber(ARGV[2]) - tonumber(ARGV[1])
end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 0
`;

let client: Redis | null | undefined;

function getRedis() {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL;
  if (!url) return (client = null);
  client = new Redis(url, { lazyConnect: false, enableOfflineQueue: false, maxRetriesPerRequest: 1 });
  // Failures fall back to memory limits below, so this only stops unhandled-event crashes.
  client.on("error", () => {});
  return client;
}

/** Redis keeps counts across server instances. If it's down, limits still apply per instance. */
export async function checkLimit(limitClass: LimitClass, key: string): Promise<LimitResult> {
  const redis = getRedis();
  if (!redis) return memoryLimit(limitClass, key);

  const { max, windowMs } = LIMITS[limitClass];
  try {
    const waitMs = (await redis.eval(
      SCRIPT,
      1,
      `limit:${limitClass}:${key}`,
      Date.now(),
      windowMs,
      max,
      randomUUID(),
    )) as number;
    return waitMs > 0 ? { ok: false, retryAfterSeconds: Math.ceil(waitMs / 1000) } : { ok: true };
  } catch {
    return memoryLimit(limitClass, key);
  }
}
