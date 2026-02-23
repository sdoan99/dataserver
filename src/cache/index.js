const RedisClient = require("./redis-client");

class CacheManager {
  constructor() {
    this.redisClient = new RedisClient();
    this.memoryCache = new Map();
    this.useRedis = true;
  }

  async initialize() {
    try {
      await this.redisClient.connect();
      this.useRedis = true;
      console.log("Cache manager initialized with Redis");
    } catch (error) {
      console.warn("Redis not available, falling back to memory cache");
      this.useRedis = false;
    }
  }

  async set(key, value, ttl = 3600) {
    if (this.useRedis) {
      return await this.redisClient.set(key, value, ttl);
    } else {
      this.memoryCache.set(key, {
        value,
        expires: ttl ? Date.now() + ttl * 1000 : null,
      });

      // Auto-clean expired entries
      if (ttl) {
        setTimeout(() => {
          this.memoryCache.delete(key);
        }, ttl * 1000);
      }

      return true;
    }
  }

  async get(key) {
    if (this.useRedis) {
      return await this.redisClient.get(key);
    } else {
      const entry = this.memoryCache.get(key);
      if (!entry) return null;

      if (entry.expires && entry.expires < Date.now()) {
        this.memoryCache.delete(key);
        return null;
      }

      return entry.value;
    }
  }

  async del(key) {
    if (this.useRedis) {
      return await this.redisClient.del(key);
    } else {
      return this.memoryCache.delete(key);
    }
  }

  async cacheOHLCV(symbol, data, ttl = 300) {
    const key = `ohlcv:${symbol}:${data.timestamp}`;
    return await this.set(key, data, ttl);
  }

  async getOHLCVHistory(symbol, from, to) {
    // This is a simplified version
    // In production, you'd use Redis sorted sets or time series
    const prefix = `ohlcv:${symbol}:`;
    const results = [];

    if (this.useRedis) {
      // Redis implementation would go here
      return results;
    } else {
      // Memory cache implementation
      for (const [key, entry] of this.memoryCache.entries()) {
        if (key.startsWith(prefix)) {
          const timestamp = parseInt(key.split(":")[2]);
          if (timestamp >= from && timestamp <= to) {
            results.push(entry.value);
          }
        }
      }

      return results.sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  async clear() {
    if (this.useRedis) {
      // Note: This clears ALL Redis keys - use with caution
      // In production, you'd use a more selective approach
      const client = this.redisClient.client;
      if (client) {
        await client.flushAll();
      }
    } else {
      this.memoryCache.clear();
    }
  }

  async disconnect() {
    if (this.useRedis) {
      await this.redisClient.disconnect();
    }
  }
}

module.exports = {
  CacheManager,
  RedisClient,
};
