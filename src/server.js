const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const config = require("./config");
const logger = require("./utils/logger");
const { ConnectionManager } = require("./connectors");
const { CalculationEngine } = require("./calculations");
const { UDFEndpoints, UDFWebSocketServer } = require("./udf");
const { CacheManager } = require("./cache");

class WebSocketAggregatorServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.connectionManager = null;
    this.calculationEngine = null;
    this.cacheManager = null;
    this.udfEndpoints = null;
    this.udfWebSocketServer = null;

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(
      cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      }),
    );
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use((req, res, next) => {
      logger.request(req);
      next();
    });
  }

  setupRoutes() {
    this.app.get("/", (req, res) => {
      const status = {
        name: "WebSocket Aggregator Server",
        version: "2.0.0",
        status: "running",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        endpoints: {
          udf: config.udf.basePath,
          ws: config.udf.wsPath,
          health: "/health",
          status: "/status",
          symbols: "/symbols/list",
          trendlines: "/trendlines",
        },
        features: {
          market_data: true,
          trendlines: true,
          indicators: config.indicators.enabled,
          caching: true,
        },
      };

      res.json(status);
    });

    this.app.get("/health", (req, res) => {
      const health = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        connections: this.udfWebSocketServer
          ? this.udfWebSocketServer.getClientCount()
          : 0,
        connectors: this.connectionManager
          ? this.connectionManager.getHealth()
          : "not initialized",
      };

      res.json(health);
    });

    this.app.get("/status", (req, res) => {
      const status = {
        server: {
          env: config.server.env,
          port: config.server.port,
          log_level: config.server.logLevel,
          connections: this.udfWebSocketServer
            ? this.udfWebSocketServer.getClientCount()
            : 0,
        },
        connectors: this.connectionManager ? "running" : "stopped",
        cache: this.cacheManager ? "initialized" : "not initialized",
        calculationEngine: this.calculationEngine ? "running" : "stopped",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };

      res.json(status);
    });

    this.app.get("/symbols/list", (req, res) => {
      if (!this.connectionManager) {
        return res.status(503).json({ error: "Connectors not initialized" });
      }

      const marketSymbols = this.connectionManager
        .getAllData()
        .map((d) => d.symbol);
      const trendlineSymbols = this.connectionManager
        .getAllTrendlines()
        .map((t) => t.symbol);

      res.json({
        market_symbols: {
          count: marketSymbols.length,
          symbols: marketSymbols.slice(0, 50),
        },
        trendline_symbols: {
          count: trendlineSymbols.length,
          symbols: trendlineSymbols.slice(0, 50),
        },
        total_symbols: marketSymbols.length + trendlineSymbols.length,
      });
    });

    this.app.get("/trendlines", (req, res) => {
      if (!this.connectionManager) {
        return res.status(503).json({ error: "Connectors not initialized" });
      }

      const trendlines = this.connectionManager.getAllTrendlines();
      const limit = parseInt(req.query.limit) || 20;

      res.json({
        count: trendlines.length,
        trendlines: trendlines.slice(0, limit).map((t) => ({
          symbol: t.symbol,
          exchange: t.exchange,
          probability: t.probability,
          name: t.name,
          timestamp: t.timestamp,
          history_count: t.history_count || 0,
        })),
      });
    });

    this.app.get("/trendlines/:symbol", (req, res) => {
      if (!this.connectionManager) {
        return res.status(503).json({ error: "Connectors not initialized" });
      }

      const { symbol } = req.params;
      const limit = parseInt(req.query.limit) || 100;

      const history = this.connectionManager.getTrendlineHistory(symbol, limit);

      if (!history || history.length === 0) {
        return res.status(404).json({ error: "Trendline not found" });
      }

      res.json({
        symbol,
        count: history.length,
        history: history.map((point) => ({
          timestamp: point.timestamp,
          probability: point.probability,
          price: point.price,
          name: point.name,
          source: point.source,
        })),
      });
    });
  }

  async initialize() {
    logger.info("Initializing WebSocket Aggregator Server...");

    try {
      // Initialize cache manager
      this.cacheManager = new CacheManager();
      await this.cacheManager.initialize();
      logger.info("Cache manager initialized");

      // Initialize calculation engine
      this.calculationEngine = new CalculationEngine();
      logger.info("Calculation engine initialized");

      // Initialize UDF endpoints
      this.udfEndpoints = new UDFEndpoints(this.calculationEngine);
      this.app.use(config.udf.basePath, this.udfEndpoints.getRouter());
      logger.info("UDF endpoints registered");

      // Initialize WebSocket server
      this.udfWebSocketServer = new UDFWebSocketServer(
        this.server,
        this.calculationEngine,
      );
      logger.info("WebSocket server initialized");

      // Initialize connection manager (data sources)
      this.connectionManager = new ConnectionManager();
      await this.connectionManager.initialize();
      logger.info("Connection manager initialized");

      // Set up data distribution
      this.setupDataDistribution();

      logger.info("WebSocket Aggregator Server initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize server:", error);
      throw error;
    }
  }

  setupDataDistribution() {
    // Market data distribution
    process.on("market-data", (data) => {
      if (this.udfWebSocketServer) {
        this.udfWebSocketServer.broadcastData(data);
      }

      // Cache market data
      if (this.cacheManager && data.symbol) {
        const cacheKey = `market:${data.exchange}:${data.symbol}:${data.timestamp}`;
        this.cacheManager.set(cacheKey, data, 300); // Cache for 5 minutes
      }
    });

    // Trendline data distribution
    process.on("trendline-data", (data) => {
      if (this.udfWebSocketServer) {
        // Convert trendline to UDF format
        const udfData = {
          ...data,
          type: "trendline",
          value: data.probability,
          close: data.probability,
          open: data.probability,
          high: data.probability,
          low: data.probability,
          volume: 0,
        };
        this.udfWebSocketServer.broadcastData(udfData);
      }

      // Cache trendline data
      if (this.cacheManager && data.symbol) {
        const cacheKey = `trendline:${data.exchange}:${data.symbol}:${data.timestamp}`;
        this.cacheManager.set(cacheKey, data, 600); // Cache for 10 minutes
      }
    });
  }

  start() {
    const port = config.server.port;
    const host = "0.0.0.0";

    this.server.listen(port, host, () => {
      logger.info(`Server is running on ${host}:${port}`);
      logger.info(`HTTP endpoints:`);
      logger.info(`  • Main: http://localhost:${port}/`);
      logger.info(`  • Health: http://localhost:${port}/health`);
      logger.info(`  • Status: http://localhost:${port}/status`);
      logger.info(`  • Symbols: http://localhost:${port}/symbols/list`);
      logger.info(`  • Trendlines: http://localhost:${port}/trendlines`);
      logger.info(`  • UDF: http://localhost:${port}${config.udf.basePath}`);
      logger.info(`WebSocket: ws://localhost:${port}${config.udf.wsPath}`);
    });

    // Handle graceful shutdown
    process.on("SIGTERM", () => this.shutdown());
    process.on("SIGINT", () => this.shutdown());

    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception:", error);
      this.shutdown(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled rejection at:", promise, "reason:", reason);
    });
  }

  async shutdown(exitCode = 0) {
    logger.info("Shutting down server...");

    try {
      // Disconnect all data sources
      if (this.connectionManager) {
        await this.connectionManager.disconnect();
      }

      // Disconnect cache
      if (this.cacheManager) {
        await this.cacheManager.disconnect();
      }

      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          logger.info("HTTP server closed");
          process.exit(exitCode);
        });

        setTimeout(() => {
          logger.warn("Forcing shutdown after timeout");
          process.exit(exitCode);
        }, 10000);
      } else {
        process.exit(exitCode);
      }
    } catch (error) {
      logger.error("Error during shutdown:", error);
      process.exit(1);
    }
  }
}

module.exports = WebSocketAggregatorServer;
