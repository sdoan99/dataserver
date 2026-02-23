const winston = require("winston");
const config = require("../config");

const logger = winston.createLogger({
  level: config.server.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: "websocket-aggregator" },
  transports: [
    // Always log to console on Fly.io
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  ],
});

// Create a stream object for Morgan (HTTP logging)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Helper methods
logger.request = (req) => {
  logger.info("HTTP Request", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
};

logger.errorWithContext = (error, context = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context,
  });
};

logger.marketData = (data) => {
  logger.debug("Market Data", {
    symbol: data.symbol,
    exchange: data.exchange,
    timestamp: data.timestamp,
    close: data.close,
  });
};

logger.websocketEvent = (event, clientId, details = {}) => {
  logger.info(`WebSocket ${event}`, {
    clientId,
    ...details,
  });
};

module.exports = logger;
