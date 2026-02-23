module.exports = {
  alpacaSymbols: {
    set1: ['AAPL', 'MSFT', 'GOOGL'],
    set2: ['TSLA', 'NVDA', 'AMZN'],
  },

  geckoNetworks: ['eth', 'bsc'],

  exchangeConfigs: {
    binance: {
      type: 'futures',
      fetchAllSymbols: false,
      testSymbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
    },
    bybit: {
      type: 'linear',
      fetchAllSymbols: false,
      testSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    },
    blofin: {
      type: 'spot',
      fetchAllSymbols: false,
      testSymbols: ['BTC-USDT', 'ETH-USDT'],
    },
  },

  maxSymbolsPerConnector: {
    binance: 100,
    bybit: 100,
    blofin: 100,
    alpaca: 30,
    geckoterminal: 20,
  },
};
