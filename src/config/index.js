require('dotenv').config();

module.exports = {
  server: {
    port: process.env.PORT || 8080,
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://default:7c178556910c471b9b0ca2877018d36c@fly-websocket.upstash.io:6379',
    ttl: parseInt(process.env.REDIS_TTL) || 3600
  },
  
  dataSources: {
    binance: {
      wsUrl: process.env.BINANCE_WS_URL || 'wss://fstream.binance.com/ws',
      reconnectInterval: 5000,
      maxReconnects: 10,
      type: 'futures'
    },
    
    bybit: {
      wsUrl: process.env.BYBIT_WS_URL || 'wss://stream.bybit.com/v5/public/linear',
      reconnectInterval: 5000,
      maxReconnects: 10,
      type: 'linear'
    },
    
    blofin: {
      wsUrl: process.env.BLOFIN_WS_URL || 'wss://openapi.blofin.com/ws',
      reconnectInterval: 10000,
      maxReconnects: 5,
      type: 'spot'
    },
    
    alpaca: {
      wsUrl: process.env.ALPACA_WS_URL || 'wss://stream.data.alpaca.markets/v2/sip',
      apiKeys: [
        {
          key: process.env.ALPACA_API_KEY_1,
          secret: process.env.ALPACA_SECRET_KEY_1
        },
        {
          key: process.env.ALPACA_API_KEY_2,
          secret: process.env.ALPACA_SECRET_KEY_2
        }
      ],
      reconnectInterval: 5000,
      maxReconnects: 10,
      sandbox: process.env.ALPACA_SANDBOX === 'true'
    },
    
    geckoterminal: {
      apiUrl: process.env.GECKO_API_URL || 'https://api.geckoterminal.com/api/v2',
      pollInterval: parseInt(process.env.GECKO_POLL_INTERVAL) || 60000,
      networks: (process.env.GECKO_NETWORKS || 'eth,bsc').split(','),
      maxPoolsPerNetwork: 5
    },
    
    oddsapi: {
      key: process.env.ODDS_API_KEY,
      pollInterval: parseInt(process.env.ODDS_POLL_INTERVAL) || 30000,
      baseUrl: 'https://api.the-odds-api.com/v4',
      regions: ['us'],
      markets: ['h2h'],
      oddsFormat: 'decimal'
    },
    
    polymarket: {
      apiUrl: process.env.POLYMARKET_API_URL || 'https://gamma-api.polymarket.com',
      pollInterval: parseInt(process.env.POLYMARKET_POLL_INTERVAL) || 15000,
      limit: 10
    }
  },
  
  udf: {
    basePath: process.env.UDF_BASE_PATH || '/udf',
    wsPath: process.env.UDF_WS_PATH || '/udf/ws'
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000
  },
  
  indicators: {
    enabled: process.env.ENABLE_INDICATORS !== 'false',
    defaultPeriods: {
      sma: 14,
      ema: 14,
      rsi: 14,
      macd: { fast: 12, slow: 26, signal: 9 },
      bb: { period: 20, stdDev: 2 }
    }
  },
  
  performance: {
    maxSymbolsPerSource: parseInt(process.env.MAX_SYMBOLS_PER_SOURCE) || 20,
    dataRetentionMs: 3600000, // 1 hour
    trendlineRetentionMs: 86400000 // 24 hours
  }
};