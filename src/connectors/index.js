const BinanceConnector = require('./BinanceConnector');
const BybitConnector = require('./BybitConnector');
const BlofinConnector = require('./BlofinConnector');
const AlpacaConnector = require('./AlpacaConnector');
const GeckoTerminalConnector = require('./GeckoTerminalConnector');
const { 
  OddsAPIConnector, 
  PolymarketConnector 
} = require('./odds-connector');
const config = require('../config');
const logger = require('../utils/logger');

class TrendlineAggregator {
  constructor() {
    this.trendlines = new Map();
    this.maxPoints = 500;
  }

  addPoint(symbol, point) {
    if (!this.trendlines.has(symbol)) {
      this.trendlines.set(symbol, []);
    }

    const points = this.trendlines.get(symbol);
    points.push({
      ...point,
      aggregated_at: Date.now()
    });

    if (points.length > this.maxPoints) {
      points.shift();
    }

    return points;
  }

  getTrendline(symbol, limit = 100) {
    const points = this.trendlines.get(symbol) || [];
    return points.slice(-limit);
  }

  getLatestPoint(symbol) {
    const points = this.trendlines.get(symbol) || [];
    return points.length > 0 ? points[points.length - 1] : null;
  }

  getAllSymbols() {
    return Array.from(this.trendlines.keys());
  }

  getStats() {
    return {
      totalSymbols: this.trendlines.size,
      totalPoints: Array.from(this.trendlines.values()).reduce((sum, points) => sum + points.length, 0)
    };
  }
}

class ConnectionManager {
  constructor() {
    this.connectors = [];
    this.trendlineConnectors = [];
    this.dataStreams = new Map();
    this.trendlineAggregator = new TrendlineAggregator();
    this.trendlineStreams = new Map();
    this.isInitialized = false;
    this.startTime = Date.now();
  }
  
  async initialize() {
    if (this.isInitialized) {
      logger.info('ConnectionManager already initialized');
      return;
    }
    
    logger.info('Initializing ConnectionManager...');
    
    // Initialize market data connectors
    this.connectors = [
      new BinanceConnector(),
      new BybitConnector(),
      new BlofinConnector(),
      new AlpacaConnector(0),
      new AlpacaConnector(1),
      new GeckoTerminalConnector()
    ];
    
    // Set up event listeners with error handling
    for (const connector of this.connectors) {
      connector.on('kline', (data) => {
        this.handleData(data);
      });
      
      connector.on('ticker', (data) => {
        this.handleData(data);
      });
      
      connector.on('error', (error) => {
        logger.error(`${connector.constructor.name} error:`, error.message);
      });
      
      connector.on('connected', () => {
        logger.info(`${connector.constructor.name} connected`);
      });
      
      connector.on('disconnected', () => {
        logger.warn(`${connector.constructor.name} disconnected`);
      });
    }
    
    // Initialize trendline connectors
    this.trendlineConnectors = [
      new OddsAPIConnector(),
      new PolymarketConnector()
    ];
    
    // Set up trendline event listeners
    for (const connector of this.trendlineConnectors) {
      connector.on('trendline', (data) => {
        this.handleTrendlineData(data);
      });
      
      connector.on('error', (error) => {
        logger.error(`${connector.constructor.name} error:`, error.message);
      });
    }
    
    // Start all connectors with staggered delays
    await this.startConnectorsWithDelay();
    
    this.isInitialized = true;
    logger.info('ConnectionManager initialized successfully');
    this.logStatus();
    
    // Log periodic status
    setInterval(() => {
      this.logStatus();
    }, 60000); // Log every minute
  }
  
  async startConnectorsWithDelay() {
    logger.info('Starting connectors with staggered delays...');
    
    // Start market data connectors first
    for (let i = 0; i < this.connectors.length; i++) {
      const connector = this.connectors[i];
      try {
        if (connector.connect) {
          connector.connect();
        } else if (connector.start) {
          await connector.start();
        }
        logger.info(`Started ${connector.constructor.name} (${i + 1}/${this.connectors.length})`);
      } catch (error) {
        logger.warn(`Failed to start ${connector.constructor.name}:`, error.message);
      }
      
      // Stagger connections to avoid overwhelming
      if (i < this.connectors.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Start trendline connectors after a delay
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    for (const connector of this.trendlineConnectors) {
      try {
        if (connector.start) {
          await connector.start();
          logger.info(`Started trendline connector: ${connector.constructor.name}`);
        }
      } catch (error) {
        logger.warn(`Failed to start trendline connector ${connector.constructor.name}:`, error.message);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  handleData(data) {
    try {
      const key = `${data.exchange}:${data.symbol}`;
      const enrichedData = {
        ...data,
        received_at: Date.now(),
        processing_time: Date.now() - (data.timestamp || Date.now())
      };
      
      this.dataStreams.set(key, enrichedData);
      
      // Emit for WebSocket distribution
      process.emit('market-data', enrichedData);
      
      // Log occasionally
      if (Math.random() < 0.01) { // Log 1% of data points
        logger.debug(`Market data: ${key} - ${data.close || 'N/A'}`);
      }
    } catch (error) {
      logger.error('Error handling market data:', error.message);
    }
  }
  
  handleTrendlineData(data) {
    try {
      const key = `${data.exchange}:${data.symbol}`;
      
      // Add to aggregator
      const points = this.trendlineAggregator.addPoint(key, data);
      
      // Store latest
      this.trendlineStreams.set(key, {
        ...data,
        history_count: points.length,
        updated_at: Date.now()
      });
      
      // Emit for WebSocket distribution
      process.emit('trendline-data', data);
      
      // Log occasionally
      if (Math.random() < 0.05) { // Log 5% of trendline points
        logger.debug(`Trendline data: ${key} - ${data.probability.toFixed(3)}`);
      }
    } catch (error) {
      logger.error('Error handling trendline data:', error.message);
    }
  }
  
  getData(exchange, symbol) {
    const key = `${exchange}:${symbol}`;
    return this.dataStreams.get(key);
  }
  
  getTrendlineData(exchange, symbol) {
    const key = `${exchange}:${symbol}`;
    const latest = this.trendlineStreams.get(key);
    if (!latest) return null;
    
    return {
      ...latest,
      history: this.trendlineAggregator.getTrendline(key, 100)
    };
  }
  
  getAllData() {
    return Array.from(this.dataStreams.values());
  }
  
  getAllTrendlines() {
    return Array.from(this.trendlineStreams.values()).map(stream => ({
      ...stream,
      history: this.trendlineAggregator.getTrendline(stream.symbol, 50)
    }));
  }
  
  getTrendlineHistory(symbol, limit = 100) {
    return this.trendlineAggregator.getTrendline(symbol, limit);
  }
  
  logStatus() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const marketConnectors = this.connectors.filter(c => c.isConnected).length;
    const trendlineConnectors = this.trendlineConnectors.filter(c => c.isConnected).length;
    
    logger.info('ConnectionManager Status:', {
      uptime: `${uptime}s`,
      market_connectors: `${marketConnectors}/${this.connectors.length}`,
      trendline_connectors: `${trendlineConnectors}/${this.trendlineConnectors.length}`,
      market_streams: this.dataStreams.size,
      trendline_streams: this.trendlineStreams.size,
      trendline_points: this.trendlineAggregator.getStats().totalPoints
    });
  }
  
  async disconnect() {
    logger.info('Disconnecting all connectors...');
    
    // Disconnect market data connectors
    for (const connector of this.connectors) {
      try {
        if (connector.disconnect) {
          connector.disconnect();
        } else if (connector.stop) {
          connector.stop();
        }
        logger.info(`Disconnected ${connector.constructor.name}`);
      } catch (error) {
        logger.error(`Error disconnecting ${connector.constructor.name}:`, error);
      }
    }
    
    // Disconnect trendline connectors
    for (const connector of this.trendlineConnectors) {
      try {
        if (connector.stop) {
          connector.stop();
        }
        logger.info(`Disconnected trendline connector ${connector.constructor.name}`);
      } catch (error) {
        logger.error(`Error disconnecting trendline connector ${connector.constructor.name}:`, error);
      }
    }
    
    // Clear data
    this.dataStreams.clear();
    this.trendlineStreams.clear();
    this.trendlineAggregator = new TrendlineAggregator();
    this.isInitialized = false;
    
    logger.info('All connectors disconnected successfully');
  }
  
  getHealth() {
    return {
      initialized: this.isInitialized,
      uptime: Date.now() - this.startTime,
      market_connectors: {
        total: this.connectors.length,
        connected: this.connectors.filter(c => c.isConnected).length,
        streams: this.dataStreams.size
      },
      trendline_connectors: {
        total: this.trendlineConnectors.length,
        connected: this.trendlineConnectors.filter(c => c.isConnected).length,
        streams: this.trendlineStreams.size
      },
      trendline_stats: this.trendlineAggregator.getStats()
    };
  }
}

module.exports = {
  ConnectionManager,
  BinanceConnector,
  BybitConnector,
  BlofinConnector,
  AlpacaConnector,
  GeckoTerminalConnector,
  OddsAPIConnector,
  PolymarketConnector,
  TrendlineAggregator
};