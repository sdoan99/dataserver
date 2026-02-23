const WebSocket = require("ws");
const logger = require("../utils/logger");
const { v4: uuidv4 } = require("uuid");

class UDFWebSocketServer {
  constructor(server, calculationEngine) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // clientId -> {ws, subscriptions}
    this.calculationEngine = calculationEngine;

    this.setupWebSocket();
    this.setupDataListener();
  }

  setupWebSocket() {
    this.wss.on("connection", (ws, req) => {
      const clientId = uuidv4();
      const clientIp = req.socket.remoteAddress;

      logger.info(`WebSocket client connected: ${clientId} from ${clientIp}`);

      this.clients.set(clientId, {
        ws,
        ip: clientIp,
        connectedAt: Date.now(),
        subscriptions: new Set(),
      });

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: "welcome",
          clientId,
          timestamp: Date.now(),
          message: "Connected to WebSocket aggregator server",
        }),
      );

      // Handle messages
      ws.on("message", (data) => {
        this.handleMessage(clientId, data);
      });

      // Handle close
      ws.on("close", () => {
        this.handleDisconnect(clientId);
      });

      // Handle errors
      ws.on("error", (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        this.handleDisconnect(clientId);
      });
    });

    logger.info("UDF WebSocket server started");
  }

  setupDataListener() {
    // Listen for market data from connectors
    process.on("market-data", (data) => {
      this.broadcastData(data);
    });
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);

      if (!client) return;

      switch (message.type) {
        case "subscribe":
          this.handleSubscribe(clientId, message);
          break;

        case "unsubscribe":
          this.handleUnsubscribe(clientId, message);
          break;

        case "ping":
          client.ws.send(
            JSON.stringify({
              type: "pong",
              timestamp: Date.now(),
            }),
          );
          break;

        case "list_symbols":
          this.sendSymbolList(clientId);
          break;

        default:
          logger.warn(`Unknown message type from ${clientId}: ${message.type}`);
      }
    } catch (error) {
      logger.error(`Error processing message from ${clientId}:`, error);
    }
  }

  handleSubscribe(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { symbol, indicators = [] } = message;

    if (!symbol) {
      client.ws.send(
        JSON.stringify({
          type: "error",
          message: "Symbol is required for subscription",
        }),
      );
      return;
    }

    // Add to client subscriptions
    client.subscriptions.add(symbol);

    // Register with calculation engine
    this.calculationEngine.subscribe(clientId, symbol, indicators);

    logger.info(`Client ${clientId} subscribed to ${symbol}`);

    client.ws.send(
      JSON.stringify({
        type: "subscribed",
        symbol,
        timestamp: Date.now(),
      }),
    );
  }

  handleUnsubscribe(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { symbol } = message;

    if (symbol) {
      client.subscriptions.delete(symbol);
      this.calculationEngine.unsubscribe(clientId, symbol);

      logger.info(`Client ${clientId} unsubscribed from ${symbol}`);

      client.ws.send(
        JSON.stringify({
          type: "unsubscribed",
          symbol,
          timestamp: Date.now(),
        }),
      );
    } else {
      // Unsubscribe from all
      const symbols = Array.from(client.subscriptions);
      symbols.forEach((symbol) => {
        this.calculationEngine.unsubscribe(clientId, symbol);
      });
      client.subscriptions.clear();

      logger.info(`Client ${clientId} unsubscribed from all symbols`);

      client.ws.send(
        JSON.stringify({
          type: "unsubscribed_all",
          timestamp: Date.now(),
        }),
      );
    }
  }

  broadcastData(data) {
    const enrichedData = this.calculationEngine.processData(data);

    this.clients.forEach((client, clientId) => {
      // Check if client is subscribed to this symbol
      if (client.subscriptions.has(data.symbol)) {
        try {
          client.ws.send(
            JSON.stringify({
              type: "ohlcv_update",
              data: enrichedData,
              timestamp: Date.now(),
            }),
          );
        } catch (error) {
          logger.error(`Error sending data to client ${clientId}:`, error);
        }
      }
    });
  }

  sendSymbolList(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const symbols = this.calculationEngine.getAllSymbols();

    client.ws.send(
      JSON.stringify({
        type: "symbol_list",
        symbols,
        count: symbols.length,
        timestamp: Date.now(),
      }),
    );
  }

  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      // Clean up subscriptions
      const symbols = Array.from(client.subscriptions);
      symbols.forEach((symbol) => {
        this.calculationEngine.unsubscribe(clientId, symbol);
      });

      this.clients.delete(clientId);
      logger.info(`WebSocket client disconnected: ${clientId}`);
    }
  }

  getClientCount() {
    return this.clients.size;
  }

  broadcastToAll(message) {
    this.clients.forEach((client) => {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error("Error broadcasting to client:", error);
      }
    });
  }
}

module.exports = UDFWebSocketServer;
