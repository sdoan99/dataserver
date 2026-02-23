// index.js (main entry point)
const WebSocketAggregatorServer = require("./server");
const logger = require("./utils/logger");

async function startServer() {
  try {
    const server = new WebSocketAggregatorServer();

    logger.info("Starting WebSocket Aggregator Server...");
    logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    logger.info(`Port: ${process.env.PORT || 8080}`);

    // Initialize all components
    await server.initialize();

    // Start the server
    server.start();

    return server;
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer()
    .then(() => {
      logger.info("Server startup complete");
    })
    .catch((error) => {
      logger.error("Server startup failed:", error);
      process.exit(1);
    });
}

module.exports = {
  startServer,
  WebSocketAggregatorServer,
};
