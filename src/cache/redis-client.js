const redis = require("redis");
const config = require("../config");
const logger = require("../utils/logger");

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: config.redis.url,
      });

      this.client.on("error", (err) => {
        logger.error("Redis client error:", err);
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        logger.info("Redis client connected");
        this.isConnected = true;
      });

      this.client.on("reconnecting", () => {
        logger.info("Redis client reconnecting");
      });

      await this.client.connect();

      return this.client;
    } catch (error) {
      logger.error("Failed to connect to Redis:", error);
      throw error;
    }
  }

  async set(key, value, ttl = null) {
    if (!this.isConnected) return null;

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error);
      return false;
    }
  }

  async get(key) {
    if (!this.isConnected) return null;

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  async del(key) {
    if (!this.isConnected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis del error for key ${key}:`, error);
      return false;
    }
  }

  async hSet(key, field, value) {
    if (!this.isConnected) return false;

    try {
      const serialized = JSON.stringify(value);
      await this.client.hSet(key, field, serialized);
      return true;
    } catch (error) {
      logger.error(`Redis hSet error for key ${key}:`, error);
      return false;
    }
  }

  async hGet(key, field) {
    if (!this.isConnected) return null;

    try {
      const data = await this.client.hGet(key, field);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Redis hGet error for key ${key}:`, error);
      return null;
    }
  }

  async hGetAll(key) {
    if (!this.isConnected) return {};

    try {
      const data = await this.client.hGetAll(key);
      const result = {};

      for (const [field, value] of Object.entries(data)) {
        result[field] = JSON.parse(value);
      }

      return result;
    } catch (error) {
      logger.error(`Redis hGetAll error for key ${key}:`, error);
      return {};
    }
  }

  async publish(channel, message) {
    if (!this.isConnected) return false;

    try {
      const serialized = JSON.stringify(message);
      await this.client.publish(channel, serialized);
      return true;
    } catch (error) {
      logger.error(`Redis publish error for channel ${channel}:`, error);
      return false;
    }
  }

  async subscribe(channel, callback) {
    if (!this.isConnected) return false;

    try {
      const subscriber = this.client.duplicate();
      await subscriber.connect();

      await subscriber.subscribe(channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (error) {
          logger.error("Error parsing subscribed message:", error);
        }
      });

      return subscriber;
    } catch (error) {
      logger.error(`Redis subscribe error for channel ${channel}:`, error);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info("Redis client disconnected");
    }
  }

  async healthCheck() {
    if (!this.isConnected) return false;

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = RedisClient;
