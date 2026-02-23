const EventEmitter = require('events');
const axios = require('axios');
const config = require('../config');
const dataSources = require('../config/data-sources');
const logger = require('../utils/logger');

class GeckoTerminalConnector extends EventEmitter {
  constructor() {
    super();
    this.config = config.dataSources.geckoterminal;
    this.networks = dataSources.geckoNetworks || ['eth', 'bsc'];
    this.cache = new Map();
    this.pollInterval = null;
    this.isRunning = false;
  }
  
  async start() {
    logger.info('Starting GeckoTerminal connector');
    this.isRunning = true;
    
    try {
      await this.fetchAllPools();
      this.startPolling();
      return true;
    } catch (error) {
      logger.error('Failed to start GeckoTerminal connector:', error);
      return false;
    }
  }
  
  async fetchAllPools() {
    logger.info(`GeckoTerminal: Fetching from ${this.networks.length} networks`);
    
    for (const network of this.networks) {
      try {
        await this.fetchNetworkPools(network);
      } catch (error) {
        logger.error(`GeckoTerminal: Error fetching ${network} pools:`, error.message);
      }
    }
  }
  
  async fetchNetworkPools(network) {
    try {
      const response = await axios.get(
        `${this.config.apiUrl}/networks/${network}/pools`,
        { 
          params: { page: 1 },
          timeout: 5000
        }
      );
      
      if (response.data && response.data.data) {
        const pools = response.data.data.slice(0, 5); // Limit to 5 per network
        
        for (const pool of pools) {
          const normalizedData = this.normalizePoolData(pool, network);
          this.emit('ticker', normalizedData);
          this.cache.set(normalizedData.symbol, normalizedData);
        }
        
        logger.info(`GeckoTerminal: Fetched ${pools.length} pools from ${network}`);
      }
    } catch (error) {
      logger.warn(`GeckoTerminal: Skipping ${network} - ${error.message}`);
    }
  }
  
  normalizePoolData(pool, network) {
    const attributes = pool.attributes;
    
    return {
      symbol: `${attributes.base_token_symbol || 'TOKEN'}_${attributes.quote_token_symbol || 'USDT'}`,
      exchange: 'geckoterminal',
      network: network,
      timestamp: Date.now(),
      price: parseFloat(attributes.base_token_price_usd) || 0,
      volume24h: parseFloat(attributes.volume_usd?.h24) || 0,
      liquidity: parseFloat(attributes.reserve_in_usd) || 0,
      source: 'geckoterminal',
      raw: pool
    };
  }
  
  startPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    this.pollInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.fetchAllPools();
      }
    }, this.config.pollInterval || 30000);
    
    logger.info(`GeckoTerminal: Polling every ${this.config.pollInterval || 30000}ms`);
  }
  
  stop() {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}

module.exports = GeckoTerminalConnector;
