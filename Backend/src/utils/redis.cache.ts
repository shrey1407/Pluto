import Redis from 'ioredis';

let client: Redis | null = null;

function getClient(): Redis | null {
  if (client) return client;
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  try {
    client = new Redis(url, { maxRetriesPerRequest: 3 });
    client.on('error', (err) => console.error('[Redis]', err.message));
    return client;
  } catch (err) {
    console.error('[Redis] Failed to connect:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Get a cached string value. Returns null if cache miss or Redis unavailable.
 */
export async function cacheGet(key: string): Promise<string | null> {
  const redis = getClient();
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

/**
 * Set a cached value with TTL in seconds.
 */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, value);
  } catch (err) {
    console.error('[Redis] cacheSet error:', err instanceof Error ? err.message : err);
  }
}

/** TTL constants (seconds) */
export const CACHE_TTL = {
  CHAINLENS_HOURS: 1,
  TRENDCRAFT_MINUTES: 30,
  PULSEBOT_ASK_MINUTES: 2,
} as const;
