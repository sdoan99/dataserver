const BaseConnector = require('./BaseConnector');
const config = require('../config');
const SymbolFetcher = require('./SymbolFetcher');
const logger = require('../utils/logger');

class BybitConnector extends BaseConnector {
  constructor() {
    super(config.dataSources.bybit);
    this.subscribedSymbols = [];
  }
  
  async onConnected() {
    logger.info('Bybit connector connected');
    await this.subscribeToAllSymbols();
  }
  
  async subscribeToAllSymbols() {
    try {
      const symbols = await SymbolFetcher.fetchBybitSymbols();
      
      // Bybit allows multiple symbols in one subscription
      const maxPerBatch = 10;
      const batches = [];
      
      for (let i = 0; i < symbols.length; i += maxPerBatch) {
        batches.push(symbols.slice(i, i + maxPerBatch));
      }
      
      // Subscribe to each batch
      for (const batch of batches) {
        for (const symbol of batch) {
          const payload = {
            op: 'subscribe',
            args: [`kline.1.${symbol}`]
          };
          
          this.send(payload);
          this.subscribedSymbols.push(symbol);
        }
        
        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      logger.info(`Bybit: Subscribed to ${this.subscribedSymbols.length} symbols`);
    } catch (error) {
      logger.error('Bybit: Error subscribing to symbols:', error);
      
      // Fallback to major symbols
      const fallbackSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
      
      for (const symbol of fallbackSymbols) {
        const payload = {
          op: 'subscribe',
          args: [`kline.1.${symbol}`]
        };
        
        this.send(payload);
        this.subscribedSymbols.push(symbol);
      }
      
      logger.info(`Bybit: Subscribed to ${fallbackSymbols.length} fallback symbols`);
    }
  }
  
  handleMessage(message) {
    if (message.topic && message.topic.includes('kline')) {
      const data = message.data[0];
      const symbol = data.symbol || message.topic.split('.')[2];
      const normalizedData = this.normalizeKline(data, symbol);
      this.emit('kline', normalizedData);
    }
  }
  
  normalizeKline(data, symbol) {
    return {
      symbol: symbol,
      exchange: 'bybit',
      timestamp: data.start,
      open: parseFloat(data.open),
      high: parseFloat(data.high),
      low: parseFloat(data.low),
      close: parseFloat(data.close),
      volume: parseFloat(data.volume),
      resolution: '1m',
      source: 'bybit_linear',
      raw: data
    };
  }
}

module.exports = BybitConnector;