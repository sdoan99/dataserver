const UDFEndpoints = require("./http-endpoints");
const UDFWebSocketServer = require("./websocket-server");
const UDFProtocol = require("./protocol");

class UDFAdapter {
  constructor(calculationEngine, config) {
    this.config = config;
    this.calculationEngine = calculationEngine;
    this.httpEndpoints = null;
    this.webSocketServer = null;
    this.isInitialized = false;
  }

  initialize(httpServer) {
    try {
      console.log("Initializing UDF Adapter...");

      // Initialize HTTP endpoints
      this.httpEndpoints = new UDFEndpoints(this.calculationEngine);

      // Initialize WebSocket server
      this.webSocketServer = new UDFWebSocketServer(
        httpServer,
        this.calculationEngine,
        this.config,
      );

      this.isInitialized = true;
      console.log("UDF Adapter initialized successfully");

      return {
        httpRouter: this.httpEndpoints.getRouter(),
        webSocketServer: this.webSocketServer,
        protocol: UDFProtocol,
      };
    } catch (error) {
      console.error("Failed to initialize UDF Adapter:", error);
      throw error;
    }
  }

  getHTTPRouter() {
    if (!this.httpEndpoints) {
      throw new Error("UDF Adapter not initialized");
    }
    return this.httpEndpoints.getRouter();
  }

  getWebSocketServer() {
    if (!this.webSocketServer) {
      throw new Error("UDF Adapter not initialized");
    }
    return this.webSocketServer;
  }

  broadcastMarketData(data) {
    if (!this.webSocketServer) {
      throw new Error("UDF Adapter not initialized");
    }

    // Process data through calculation engine first
    const enrichedData = this.calculationEngine.processData(data);

    // Broadcast to all subscribed clients
    this.webSocketServer.broadcastData(enrichedData);

    return enrichedData;
  }

  getClientStats() {
    if (!this.webSocketServer) {
      return { clientCount: 0, subscriptions: 0 };
    }

    return {
      clientCount: this.webSocketServer.getClientCount(),
      activeConnections: this.webSocketServer.getActiveConnections(),
      broadcastStats: this.webSocketServer.getBroadcastStats(),
    };
  }

  handleHistoricalRequest(symbol, resolution, from, to, countback) {
    // Validate request
    const validation = this.validateHistoryRequest({
      symbol,
      resolution,
      from,
      to,
      countback,
    });

    if (!validation.isValid) {
      throw new Error(
        `Invalid history request: ${validation.errors.join(", ")}`,
      );
    }

    // Parse symbol
    const { exchange, symbol: symbolName } = UDFProtocol.parseSymbol(symbol);

    // Get historical data
    const history = this.calculationEngine.getHistoricalData(
      symbolName,
      resolution,
      countback,
    );

    // Format for TradingView
    return UDFProtocol.formatHistoryResponse(history);
  }

  validateHistoryRequest(request) {
    const errors = [];

    if (!request.symbol) {
      errors.push("Symbol is required");
    }

    if (!request.resolution) {
      errors.push("Resolution is required");
    } else if (
      !UDFProtocol.getSupportedResolutions().includes(request.resolution)
    ) {
      errors.push(`Unsupported resolution: ${request.resolution}`);
    }

    if (!request.from) {
      errors.push("From timestamp is required");
    } else if (isNaN(request.from) || request.from <= 0) {
      errors.push("Invalid from timestamp");
    }

    if (request.to && (isNaN(request.to) || request.to <= 0)) {
      errors.push("Invalid to timestamp");
    }

    if (
      request.countback &&
      (isNaN(request.countback) || request.countback <= 0)
    ) {
      errors.push("Invalid countback value");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  getSymbolInfo(symbol) {
    if (!symbol) {
      throw new Error("Symbol is required");
    }

    const { exchange, symbol: symbolName } = UDFProtocol.parseSymbol(symbol);

    return UDFProtocol.formatSymbolInfo(symbolName, exchange);
  }

  searchSymbols(query, type, exchange, limit = 50) {
    // This would typically search a database of available symbols
    // For now, return a mock response
    const allSymbols = this.calculationEngine.getAllSymbols();

    const results = allSymbols
      .filter((sym) => {
        const matchesQuery = query
          ? sym.toLowerCase().includes(query.toLowerCase())
          : true;
        const matchesType = type
          ? (type === "crypto" && sym !== "AAPL") ||
            (type === "stock" && sym === "AAPL")
          : true;
        const matchesExchange = exchange
          ? sym.startsWith(exchange + ":")
          : true;

        return matchesQuery && matchesType && matchesExchange;
      })
      .slice(0, limit)
      .map((sym) => {
        const [exch, symbolName] = sym.split(":");
        return {
          symbol: symbolName,
          full_name: sym,
          description: `${symbolName} on ${exch}`,
          exchange: exch,
          type: exch === "alpaca" ? "stock" : "crypto",
        };
      });

    return results;
  }

  getServerConfig() {
    return {
      supported_resolutions: UDFProtocol.getSupportedResolutions(),
      supports_group_request: false,
      supports_marks: false,
      supports_search: true,
      supports_timescale_marks: false,
      supports_time: true,
      supports_replay: false,
      supports_news: false,
      symbols_types: [
        { name: "crypto", value: "crypto" },
        { name: "stock", value: "stock" },
      ],
      exchanges: [
        { value: "binance", name: "Binance", desc: "Binance Futures" },
        { value: "bybit", name: "Bybit", desc: "Bybit Linear" },
        { value: "blofin", name: "Blofin", desc: "Blofin Exchange" },
        { value: "alpaca", name: "Alpaca", desc: "Alpaca Stocks" },
        { value: "geckoterminal", name: "GeckoTerminal", desc: "DEX Pools" },
      ],
      supported_indicators: [
        "SMA",
        "EMA",
        "RSI",
        "MACD",
        "Bollinger Bands",
        "Stochastic",
        "ATR",
        "OBV",
        "Volume",
      ],
    };
  }

  getServerTime() {
    return {
      time: Math.floor(Date.now() / 1000),
    };
  }

  shutdown() {
    if (this.webSocketServer) {
      this.webSocketServer.close();
    }

    this.isInitialized = false;
    console.log("UDF Adapter shutdown completed");
  }
}

module.exports = {
  UDFAdapter,
  UDFEndpoints,
  UDFWebSocketServer,
  UDFProtocol,
};
