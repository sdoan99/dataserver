const WebSocket = require("ws");
const logger = require("../utils/logger");
const EventEmitter = require("events");

class BaseConnector extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.symbols = [];
    this.heartbeatInterval = null;
  }

  connect() {
    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.on("open", () => {
      logger.info(`${this.constructor.name} connected to ${this.config.wsUrl}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.onConnected();
      this.startHeartbeat();
    });

    this.ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        logger.error(`${this.constructor.name} parse error:`, error);
      }
    });

    this.ws.on("close", (code, reason) => {
      logger.warn(`${this.constructor.name} disconnected: ${code} - ${reason}`);
      this.isConnected = false;
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on("error", (error) => {
      logger.error(`${this.constructor.name} error:`, error);
    });
  }

  onConnected() {
    // To be implemented by child classes
  }

  handleMessage(message) {
    // To be implemented by child classes
  }

  send(data) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(data));
    }
  }

  subscribe(symbols, interval = "1m") {
    // To be implemented by child classes
  }

  startHeartbeat() {
    if (this.config.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, this.config.heartbeatInterval);
    }
  }

  sendHeartbeat() {
    // To be implemented if needed
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnects) {
      logger.error(
        `${this.constructor.name} max reconnection attempts reached`,
      );
      return;
    }

    const delay =
      this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts++;

    logger.info(
      `${this.constructor.name} reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = BaseConnector;
