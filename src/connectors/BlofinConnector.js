const BaseConnector = require('./BaseConnector');
const config = require('../config');
const logger = require('../utils/logger');

class BlofinConnector extends BaseConnector {
  constructor() {
    super(config.dataSources.blofin);
    this.connected = false;
  }
  
  async onConnected() {
    logger.info('Blofin: Connected (public feed)');
    this.connected = true;
    
    // Try to subscribe to a test symbol
    setTimeout(() => {
      this.subscribeTestSymbols();
    }, 1000);
  }
  
  subscribeTestSymbols() {
    const symbols = ['BTC-USDT', 'ETH-USDT'];
    
    symbols.forEach(symbol => {
      const payload = {
        op: 'subscribe',
        args: [{
          channel: 'candlesticks',
          instId: symbol,
          bar: '1m'
        }]
      };
      
      logger.info(`Blofin: Attempting to subscribe to ${symbol}`);
      this.send(payload);
    });
  }
  
  handleMessage(message) {
    try {
      const msg = typeof message === 'string' ? JSON.parse(message) : message;
      
      if (msg.event === 'subscribe' || msg.event === 'error') {
        logger.info(`Blofin: ${msg.event}: ${JSON.stringify(msg)}`);
        return;
      }
      
      if (msg.arg && msg.arg.channel === 'candlesticks' && msg.data) {
        const data = msg.data[0];
        const symbol = msg.arg.instId;
        const normalized = this.normalizeKline(data, symbol);
        this.emit('kline', normalized);
        logger.debug(`Blofin: Received data for ${symbol}`);
      }
    } catch (error) {
      logger.debug(`Blofin: Message processing: ${error.message}`);
    }
  }
  
  normalizeKline(data, symbol) {
    return {
      symbol: symbol.replace('-', ''),
      exchange: 'blofin',
      timestamp: parseInt(data[0]) || Date.now(),
      open: parseFloat(data[1]) || 0,
      high: parseFloat(data[2]) || 0,
      low: parseFloat(data[3]) || 0,
      close: parseFloat(data[4]) || 0,
      volume: parseFloat(data[5]) || 0,
      resolution: '1m',
      source: 'blofin',
      raw: data
    };
  }
}

module.exports = BlofinConnector;
