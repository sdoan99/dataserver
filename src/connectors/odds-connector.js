const axios = require("axios");
const EventEmitter = require("events");
const config = require("../config");
const logger = require("../utils/logger");

class OddsDataNormalizer {
  static usOddsToProbability(odds) {
    if (odds > 0) {
      return 100 / (odds + 100);
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }

  static decimalOddsToProbability(odds) {
    return 1 / odds;
  }

  static priceToProbability(price) {
    return price;
  }

  static normalizeToProbability(value, format = "decimal") {
    switch (format) {
      case "us":
        return this.usOddsToProbability(value);
      case "decimal":
        return this.decimalOddsToProbability(value);
      case "price":
        return this.priceToProbability(value);
      default:
        return value;
    }
  }
}

class OddsAPIConnector extends EventEmitter {
  constructor() {
    super();
    this.config = config.dataSources.oddsapi;
    this.pollTimer = null;
    this.activeEvents = new Map();
    this.isConnected = false;
  }

  async start() {
    logger.info("OddsAPI connector starting...");
    if (!this.config.key) {
      logger.warn("OddsAPI: No API key configured, skipping");
      return false;
    }

    try {
      await this.fetchSports();
      this.startPolling();
      this.isConnected = true;
      logger.info("OddsAPI connector started successfully");
      return true;
    } catch (error) {
      logger.error("OddsAPI: Failed to start:", error.message);
      return false;
    }
  }

  async fetchSports() {
    try {
      const response = await axios.get(`${this.config.baseUrl}/sports`, {
        params: { apiKey: this.config.key },
        timeout: 10000,
      });

      this.sports = response.data.filter((sport) => sport.active).slice(0, 10); // Limit to 10 sports

      logger.info(`OddsAPI: Loaded ${this.sports.length} active sports`);

      // Fetch odds for first 3 popular sports
      const popularSports = [
        "basketball_nba",
        "americanfootball_nfl",
        "soccer_epl",
      ];
      for (const sportKey of popularSports) {
        if (this.sports.find((s) => s.key === sportKey)) {
          await this.fetchOdds(sportKey);
        }
      }
    } catch (error) {
      logger.error("OddsAPI: Failed to fetch sports:", error.message);
      throw error;
    }
  }

  async fetchOdds(sportKey) {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/sports/${sportKey}/odds`,
        {
          params: {
            apiKey: this.config.key,
            regions: "us",
            markets: "h2h",
            oddsFormat: "decimal",
            bookmakers: "fanduel,draftkings",
          },
          timeout: 15000,
        },
      );

      if (response.data && Array.isArray(response.data)) {
        for (const event of response.data) {
          this.processEvent(event);
        }
        logger.debug(
          `OddsAPI: Processed ${response.data.length} events for ${sportKey}`,
        );
      }
    } catch (error) {
      logger.error(
        `OddsAPI: Failed to fetch odds for ${sportKey}:`,
        error.message,
      );
    }
  }

  processEvent(event) {
    try {
      const eventId = event.id;
      const timestamp = new Date(event.commence_time).getTime();
      const eventName = `${event.home_team} vs ${event.away_team}`;

      for (const bookmaker of event.bookmakers || []) {
        for (const market of bookmaker.markets || []) {
          if (market.key === "h2h" && market.outcomes) {
            for (const outcome of market.outcomes) {
              const probability = OddsDataNormalizer.decimalOddsToProbability(
                outcome.price,
              );

              const trendPoint = {
                symbol: `ODDS:${event.sport_key}:${eventId}:${outcome.name}`,
                exchange: "oddsapi",
                timestamp,
                probability,
                price: outcome.price,
                name: outcome.name,
                event: eventName,
                sport: event.sport_key,
                bookmaker: bookmaker.key,
                type: "probability",
                resolution: "event",
                source: "oddsapi",
                last_update: bookmaker.last_update,
              };

              this.emit("trendline", trendPoint);
              this.activeEvents.set(trendPoint.symbol, trendPoint);
            }
          }
        }
      }
    } catch (error) {
      logger.error("OddsAPI: Error processing event:", error.message);
    }
  }

  startPolling() {
    this.pollTimer = setInterval(async () => {
      if (!this.sports || this.sports.length === 0) {
        logger.warn("OddsAPI: No sports available for polling");
        return;
      }

      try {
        // Poll only 2 sports to avoid rate limits
        const sportsToPoll = this.sports.slice(0, 2);
        for (const sport of sportsToPoll) {
          await this.fetchOdds(sport.key);
          // Add delay between sports
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error("OddsAPI: Polling error:", error.message);
      }
    }, this.config.pollInterval);
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isConnected = false;
    this.activeEvents.clear();
    logger.info("OddsAPI connector stopped");
  }

  getStatus() {
    return {
      connected: this.isConnected,
      activeEvents: this.activeEvents.size,
      sportsCount: this.sports ? this.sports.length : 0,
    };
  }
}

class PolymarketConnector extends EventEmitter {
  constructor() {
    super();
    this.config = config.dataSources.polymarket;
    this.pollTimer = null;
    this.activeMarkets = new Map();
    this.isConnected = false;
  }

  async start() {
    logger.info("Polymarket connector starting...");
    try {
      await this.fetchMarkets();
      this.startPolling();
      this.isConnected = true;
      logger.info("Polymarket connector started successfully");
      return true;
    } catch (error) {
      logger.error("Polymarket: Failed to start:", error.message);
      return false;
    }
  }

  async fetchMarkets() {
    try {
      const response = await axios.get(`${this.config.apiUrl}/markets`, {
        params: {
          limit: 10,
          active: true,
          order_by: "volume",
          order_dir: "desc",
        },
        timeout: 10000,
      });

      if (response.data && Array.isArray(response.data)) {
        for (const market of response.data) {
          this.processMarket(market);
        }
        logger.info(`Polymarket: Fetched ${response.data.length} markets`);
      }
    } catch (error) {
      logger.error("Polymarket: Failed to fetch markets:", error.message);
      throw error;
    }
  }

  processMarket(market) {
    try {
      const timestamp = Date.now();
      const marketId = market.slug || market.id;
      const marketQuestion = market.question || "Unknown Market";

      if (market.conditions && Array.isArray(market.conditions)) {
        for (const condition of market.conditions) {
          const probability = condition.lastPrice || 0.5;
          const conditionName =
            condition.title || condition.name || "Unknown Condition";

          const trendPoint = {
            symbol: `POLY:${marketId}:${condition.id}`,
            exchange: "polymarket",
            timestamp,
            probability,
            price: probability,
            name: conditionName,
            market: marketQuestion,
            volume: market.volume || 0,
            liquidity: market.liquidity || 0,
            type: "prediction",
            resolution: "event",
            source: "polymarket",
            condition_id: condition.id,
          };

          this.emit("trendline", trendPoint);
          this.activeMarkets.set(trendPoint.symbol, trendPoint);
        }
      }
    } catch (error) {
      logger.error("Polymarket: Error processing market:", error.message);
    }
  }

  startPolling() {
    this.pollTimer = setInterval(async () => {
      try {
        await this.fetchMarkets();
      } catch (error) {
        logger.error("Polymarket: Polling error:", error.message);
      }
    }, this.config.pollInterval);
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isConnected = false;
    this.activeMarkets.clear();
    logger.info("Polymarket connector stopped");
  }

  getStatus() {
    return {
      connected: this.isConnected,
      activeMarkets: this.activeMarkets.size,
    };
  }
}

module.exports = {
  OddsDataNormalizer,
  OddsAPIConnector,
  PolymarketConnector,
};
