const axios = require("axios");
const logger = require("../utils/logger");
const dataSources = require("../config/data-sources");

class SymbolFetcher {
  static async fetchBinanceSymbols() {
    try {
      const response = await axios.get(
        "https://fapi.binance.com/fapi/v1/exchangeInfo",
      );
      const symbols = response.data.symbols
        .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
        .map((s) => s.symbol);

      logger.info(`Fetched ${symbols.length} Binance symbols`);
      return symbols.slice(0, dataSources.maxSymbolsPerConnector.binance);
    } catch (error) {
      logger.error("Failed to fetch Binance symbols:", error.message);
      return ["BTCUSDT", "ETHUSDT", "BNBUSDT"]; // Fallback symbols
    }
  }

  static async fetchBybitSymbols() {
    try {
      const response = await axios.get(
        "https://api.bybit.com/v5/market/instruments-info?category=linear",
      );
      const symbols = response.data.result.list
        .filter((i) => i.status === "Trading" && i.quoteCoin === "USDT")
        .map((i) => i.symbol);

      logger.info(`Fetched ${symbols.length} Bybit symbols`);
      return symbols.slice(0, dataSources.maxSymbolsPerConnector.bybit);
    } catch (error) {
      logger.error("Failed to fetch Bybit symbols:", error.message);
      return ["BTCUSDT", "ETHUSDT", "SOLUSDT"]; // Fallback symbols
    }
  }

  static async fetchBlofinSymbols() {
    try {
      const response = await axios.get(
        "https://openapi.blofin.com/api/v1/market/tickers",
      );
      const symbols = response.data.data
        .filter((t) => t.instType === "SPOT" && t.instId.includes("-USDT"))
        .map((t) => t.instId);

      logger.info(`Fetched ${symbols.length} Blofin symbols`);
      return symbols.slice(0, dataSources.maxSymbolsPerConnector.blofin);
    } catch (error) {
      logger.error("Failed to fetch Blofin symbols:", error.message);
      return ["BTC-USDT", "ETH-USDT", "SOL-USDT"]; // Fallback symbols
    }
  }

  static async fetchGeckoTerminalPools(network) {
    try {
      const response = await axios.get(
        `https://api.geckoterminal.com/api/v2/networks/${network}/pools`,
        { params: { page: 1 } },
      );

      const pools = response.data.data || [];
      logger.info(
        `Fetched ${pools.length} pools from GeckoTerminal ${network}`,
      );

      return pools.slice(0, dataSources.maxSymbolsPerConnector.geckoterminal);
    } catch (error) {
      logger.error(
        `Failed to fetch GeckoTerminal pools for ${network}:`,
        error.message,
      );
      return [];
    }
  }

  static async fetchAllGeckoTerminalPools() {
    const networks = dataSources.geckoNetworks;
    const allPools = [];

    for (const network of networks) {
      try {
        const pools = await this.fetchGeckoTerminalPools(network);
        allPools.push(
          ...pools.map((pool) => ({
            ...pool,
            network,
          })),
        );
      } catch (error) {
        logger.error(`Error fetching pools for network ${network}:`, error);
      }
    }

    logger.info(`Total GeckoTerminal pools fetched: ${allPools.length}`);
    return allPools;
  }

  static async getAllSymbols() {
    try {
      const [binanceSymbols, bybitSymbols, blofinSymbols, geckoPools] =
        await Promise.allSettled([
          this.fetchBinanceSymbols(),
          this.fetchBybitSymbols(),
          this.fetchBlofinSymbols(),
          this.fetchAllGeckoTerminalPools(),
        ]);

      const result = {
        binance:
          binanceSymbols.status === "fulfilled" ? binanceSymbols.value : [],
        bybit: bybitSymbols.status === "fulfilled" ? bybitSymbols.value : [],
        blofin: blofinSymbols.status === "fulfilled" ? blofinSymbols.value : [],
        geckoterminal:
          geckoPools.status === "fulfilled" ? geckoPools.value : [],
        alpaca: {
          set1: dataSources.alpacaSymbols.set1,
          set2: dataSources.alpacaSymbols.set2,
        },
      };

      logger.info("Symbol fetching complete:", {
        binance: result.binance.length,
        bybit: result.bybit.length,
        blofin: result.blofin.length,
        geckoterminal: result.geckoterminal.length,
        alpaca: result.alpaca.set1.length + result.alpaca.set2.length,
      });

      return result;
    } catch (error) {
      logger.error("Error fetching all symbols:", error);
      return this.getDefaultSymbols();
    }
  }

  static getDefaultSymbols() {
    return {
      binance: ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"],
      bybit: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
      blofin: ["BTC-USDT", "ETH-USDT"],
      geckoterminal: [],
      alpaca: {
        set1: dataSources.alpacaSymbols.set1,
        set2: dataSources.alpacaSymbols.set2,
      },
    };
  }
}

module.exports = SymbolFetcher;
