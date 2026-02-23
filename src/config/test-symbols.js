// Simplified symbols for testing
module.exports = {
  alpacaSymbols: {
    set1: ['AAPL', 'MSFT', 'GOOGL'],  // Just 3 for testing
    set2: ['TSLA', 'NVDA', 'AMZN']    // Just 3 for testing
  },
  
  geckoNetworks: ['eth', 'bsc'],  // Only 2 networks for testing
  
  exchangeConfigs: {
    binance: {
      fetchAllSymbols: false,  // Don't fetch all for testing
      testSymbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']
    },
    bybit: {
      fetchAllSymbols: false,
      testSymbols: ['BTCUSDT', 'ETHUSDT']
    },
    blofin: {
      fetchAllSymbols: false,
      testSymbols: ['BTC-USDT', 'ETH-USDT']
    }
  }
};
