const express = require("express");
const router = express.Router();
const config = require("../config");
const constants = require("../config/constants");
const logger = require("../utils/logger");
const { CalculationEngine } = require("../calculations");

class UDFEndpoints {
  constructor(calculationEngine) {
    this.calculationEngine = calculationEngine;
    this.router = router;
    this.setupRoutes();
  }

  setupRoutes() {
    // TradingView UDF protocol endpoints
    this.router.get("/time", this.getTime.bind(this));
    this.router.get("/config", this.getConfig.bind(this));
    this.router.get("/symbols", this.getSymbol.bind(this));
    this.router.get("/search", this.searchSymbols.bind(this));
    this.router.get("/history", this.getHistory.bind(this));

    // Additional endpoints
    this.router.get("/health", this.healthCheck.bind(this));
    this.router.get("/symbols/list", this.listSymbols.bind(this));
  }

  getTime(req, res) {
    res.json({
      time: Math.floor(Date.now() / 1000),
    });
  }

  getConfig(req, res) {
    res.json({
      supported_resolutions: Object.values(constants.CANDLE_RESOLUTIONS),
      supports_group_request: false,
      supports_marks: false,
      supports_search: true,
      supports_timescale_marks: false,
      symbols_types: [
        { name: "crypto", value: "crypto" },
        { name: "stock", value: "stock" },
      ],
    });
  }

  getSymbol(req, res) {
    const symbol = req.query.symbol;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol parameter is required" });
    }

    // Parse symbol format: EXCHANGE:SYMBOL or just SYMBOL
    let exchange = "binance";
    let symbolName = symbol;

    if (symbol.includes(":")) {
      [exchange, symbolName] = symbol.split(":");
    }

    res.json({
      name: symbolName,
      ticker: `${exchange}:${symbolName}`,
      description: `${symbolName} on ${exchange}`,
      type: exchange === "alpaca" ? "stock" : "crypto",
      session: "24x7",
      exchange: exchange,
      listed_exchange: exchange,
      timezone: "UTC",
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      supported_resolutions: Object.values(constants.CANDLE_RESOLUTIONS),
      volume_precision: 2,
      data_status: "streaming",
      minmov: 1,
      pricescale: 100,
      pointvalue: 1,
    });
  }

  searchSymbols(req, res) {
    const query = req.query.query || "";
    const type = req.query.type || "";
    const exchange = req.query.exchange || "";
    const limit = parseInt(req.query.limit) || 50;

    // Mock response - in production, this would search actual symbols
    const results = [
      {
        symbol: "BTCUSDT",
        full_name: "binance:BTCUSDT",
        description: "Bitcoin/USDT on Binance",
        exchange: "binance",
        type: "crypto",
      },
      {
        symbol: "ETHUSDT",
        full_name: "binance:ETHUSDT",
        description: "Ethereum/USDT on Binance",
        exchange: "binance",
        type: "crypto",
      },
    ];

    res.json(results.slice(0, limit));
  }

  getHistory(req, res) {
    const symbol = req.query.symbol;
    const resolution = req.query.resolution;
    const from = parseInt(req.query.from);
    const to = parseInt(req.query.to);
    const countback = parseInt(req.query.countback) || 100;

    if (!symbol || !resolution || !from) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Parse symbol
    let exchange = "binance";
    let symbolName = symbol;

    if (symbol.includes(":")) {
      [exchange, symbolName] = symbol.split(":");
    }

    // Calculate actual countback
    const actualCountback =
      countback ||
      Math.ceil((to - from) / this.getResolutionInSeconds(resolution));

    // Get historical data from calculation engine
    const history = this.calculationEngine.getHistoricalData(
      symbolName,
      resolution,
      actualCountback,
    );

    // Format for TradingView
    const bars = {
      s: "ok",
      t: [],
      c: [],
      o: [],
      h: [],
      l: [],
      v: [],
    };

    history.forEach((candle) => {
      bars.t.push(Math.floor(candle.timestamp / 1000));
      bars.o.push(candle.open);
      bars.h.push(candle.high);
      bars.l.push(candle.low);
      bars.c.push(candle.close);
      bars.v.push(candle.volume);
    });

    // If no data, return no_data status
    if (bars.t.length === 0) {
      return res.json({ s: "no_data" });
    }

    res.json(bars);
  }

  getResolutionInSeconds(resolution) {
    const resolutionMap = {
      1: 60,
      3: 180,
      5: 300,
      15: 900,
      30: 1800,
      60: 3600,
      120: 7200,
      240: 14400,
      360: 21600,
      480: 28800,
      720: 43200,
      D: 86400,
      "1D": 86400,
      W: 604800,
      "1W": 604800,
      M: 2592000,
      "1M": 2592000,
    };

    return resolutionMap[resolution] || 60;
  }

  healthCheck(req, res) {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  }

  listSymbols(req, res) {
    const symbols = this.calculationEngine.getAllSymbols();
    res.json({
      symbols: symbols,
      count: symbols.length,
    });
  }

  getRouter() {
    return this.router;
  }
}

module.exports = UDFEndpoints;
