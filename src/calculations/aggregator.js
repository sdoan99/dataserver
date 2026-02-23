class DataAggregator {
  constructor() {
    this.candleCache = new Map(); // symbol -> {1m: [], 5m: [], 15m: [], etc}
  }

  aggregateToHigherTimeframe(symbol, data, targetResolution) {
    if (!this.candleCache.has(symbol)) {
      this.candleCache.set(symbol, {});
    }

    const symbolCache = this.candleCache.get(symbol);
    const resolution = data.resolution || "1m";

    // Only aggregate from 1m to higher timeframes
    if (resolution !== "1m") {
      return null;
    }

    if (!symbolCache[targetResolution]) {
      symbolCache[targetResolution] = [];
    }

    const cache = symbolCache[targetResolution];
    cache.push(data);

    const aggregationFactor = this.getAggregationFactor(targetResolution);

    if (cache.length >= aggregationFactor) {
      const aggregatedCandle = this.createAggregatedCandle(
        cache,
        targetResolution,
      );
      cache.length = 0; // Clear cache after aggregation
      return aggregatedCandle;
    }

    return null;
  }

  getAggregationFactor(targetResolution) {
    const factors = {
      "5m": 5,
      "15m": 15,
      "30m": 30,
      "1h": 60,
      "4h": 240,
      "1d": 1440,
      "1w": 10080,
    };

    return factors[targetResolution] || 1;
  }

  createAggregatedCandle(candles, resolution) {
    if (candles.length === 0) return null;

    const firstCandle = candles[0];
    const lastCandle = candles[candles.length - 1];

    const opens = candles.map((c) => c.open);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);

    return {
      symbol: firstCandle.symbol,
      exchange: firstCandle.exchange,
      timestamp: firstCandle.timestamp,
      open: opens[0],
      high: Math.max(...highs),
      low: Math.min(...lows),
      close: closes[closes.length - 1],
      volume: volumes.reduce((sum, vol) => sum + vol, 0),
      resolution: resolution,
      source: firstCandle.source,
      aggregatedFrom: candles.length,
      raw: candles,
    };
  }

  getCandles(symbol, resolution, limit = 100) {
    if (!this.candleCache.has(symbol)) return [];

    const symbolCache = this.candleCache.get(symbol);
    return symbolCache[resolution] ? symbolCache[resolution].slice(-limit) : [];
  }

  clearCache(symbol) {
    this.candleCache.delete(symbol);
  }
}

module.exports = DataAggregator;
