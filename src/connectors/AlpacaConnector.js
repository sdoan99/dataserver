const BaseConnector = require("./BaseConnector");
const config = require("../config");
const dataSources = require("../config/data-sources");
const logger = require("../utils/logger");

class AlpacaConnector extends BaseConnector {
  constructor(apiKeyIndex = 0) {
    const alpacaConfig = config.dataSources.alpaca;
    super({
      ...alpacaConfig,
      wsUrl: alpacaConfig.wsUrl,
      apiKey: alpacaConfig.apiKeys[apiKeyIndex],
    });

    this.apiKeyIndex = apiKeyIndex;
    this.symbols = dataSources.alpacaSymbols[`set${apiKeyIndex + 1}`] || [];
  }

  async onConnected() {
    logger.info(`Alpaca connector ${this.apiKeyIndex + 1} connected`);
    await this.authenticate();
    await this.subscribeToSymbols();
  }

  async authenticate() {
    const authMessage = {
      action: "auth",
      key: this.config.apiKey.key,
      secret: this.config.apiKey.secret,
    };

    this.send(authMessage);
  }

  async subscribeToSymbols() {
    const subscribeMessage = {
      action: "subscribe",
      bars: this.symbols,
    };

    this.send(subscribeMessage);
    logger.info(
      `Alpaca ${this.apiKeyIndex + 1}: Subscribed to ${this.symbols.length} symbols`,
    );
  }

  handleMessage(message) {
    if (message.T === "b") {
      // Bar data
      const normalizedData = this.normalizeBar(message);
      this.emit("kline", normalizedData);
    }
  }

  normalizeBar(bar) {
    return {
      symbol: bar.S,
      exchange: "alpaca",
      timestamp: new Date(bar.t).getTime(),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      resolution: "1m",
      source: `alpaca_${this.apiKeyIndex + 1}`,
      raw: bar,
    };
  }
}

module.exports = AlpacaConnector;
