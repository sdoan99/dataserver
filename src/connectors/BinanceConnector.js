const BaseConnector = require("./BaseConnector");
const config = require("../config");
const SymbolFetcher = require("./SymbolFetcher");
const logger = require("../utils/logger");

class BinanceConnector extends BaseConnector {
  constructor() {
    super(config.dataSources.binance);
    this.symbolCache = new Map();
    this.subscribedSymbols = [];
  }

  async onConnected() {
    logger.info("Binance connector connected");
    await this.subscribeToAllSymbols();
  }

  async subscribeToAllSymbols() {
    try {
      // Fetch all available symbols
      const symbols = await SymbolFetcher.fetchBinanceSymbols();

      // Binance has a limit of 200 streams per connection
      const maxStreamsPerConnection = 200;
      const chunks = [];

      for (let i = 0; i < symbols.length; i += maxStreamsPerConnection) {
        chunks.push(symbols.slice(i, i + maxStreamsPerConnection));
      }

      // Subscribe to each chunk (create multiple connections if needed)
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const streamNames = chunk.map(
          (symbol) => `${symbol.toLowerCase()}@kline_1m`,
        );

        if (i === 0) {
          // Use main connection for first chunk
          this.send({
            method: "SUBSCRIBE",
            params: streamNames,
            id: Date.now(),
          });
          this.subscribedSymbols.push(...chunk);
        } else {
          // For additional chunks, we'd need to create additional connections
          logger.warn(
            `Binance: Additional chunk of ${chunk.length} symbols needs separate connection`,
          );
          // In production, you'd implement connection pooling here
        }
      }

      logger.info(
        `Binance: Subscribed to ${this.subscribedSymbols.length} symbols`,
      );
    } catch (error) {
      logger.error("Binance: Error subscribing to symbols:", error);

      // Fallback to major symbols
      const fallbackSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"];
      const streamNames = fallbackSymbols.map(
        (s) => `${s.toLowerCase()}@kline_1m`,
      );

      this.send({
        method: "SUBSCRIBE",
        params: streamNames,
        id: Date.now(),
      });

      this.subscribedSymbols = fallbackSymbols;
      logger.info(
        `Binance: Subscribed to ${fallbackSymbols.length} fallback symbols`,
      );
    }
  }

  handleMessage(message) {
    if (message.e === "kline") {
      const kline = message.k;
      const normalizedData = this.normalizeKline(kline, message.s);
      this.emit("kline", normalizedData);

      // Cache for calculations
      this.symbolCache.set(normalizedData.symbol, normalizedData);
    }
  }

  normalizeKline(kline, symbol) {
    return {
      symbol: symbol.toUpperCase(),
      exchange: "binance",
      timestamp: kline.t,
      open: parseFloat(kline.o),
      high: parseFloat(kline.h),
      low: parseFloat(kline.l),
      close: parseFloat(kline.c),
      volume: parseFloat(kline.v),
      resolution: "1m",
      source: "binance_futures",
      raw: kline,
    };
  }
}

module.exports = BinanceConnector;
