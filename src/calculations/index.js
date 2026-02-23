const IndicatorCalculator = require("./indicators");
const DataAggregator = require("./aggregator");

class CalculationEngine {
  constructor() {
    this.indicatorCalculator = new IndicatorCalculator();
    this.dataAggregator = new DataAggregator();
    this.subscriptions = new Map(); // clientId -> {symbols: [], indicators: []}
  }

  processData(data) {
    // Add to indicator calculator
    this.indicatorCalculator.addData(data.symbol, data);

    // Calculate indicators if needed
    const indicators = this.indicatorCalculator.calculateAll(data.symbol);

    // Aggregate to higher timeframes
    const aggregations = {};
    const timeframes = ["5m", "15m", "30m", "1h", "4h", "1d"];

    for (const tf of timeframes) {
      const aggregated = this.dataAggregator.aggregateToHigherTimeframe(
        data.symbol,
        data,
        tf,
      );
      if (aggregated) {
        aggregations[tf] = aggregated;
      }
    }

    return {
      ...data,
      indicators,
      aggregations,
    };
  }

  getHistoricalData(symbol, resolution, limit = 100) {
    if (resolution === "1m") {
      return this.indicatorCalculator.getHistory(symbol, limit);
    } else {
      return this.dataAggregator.getCandles(symbol, resolution, limit);
    }
  }

  subscribe(clientId, symbol, indicators = []) {
    if (!this.subscriptions.has(clientId)) {
      this.subscriptions.set(clientId, {
        symbols: new Set(),
        indicators: new Set(),
      });
    }

    const subscription = this.subscriptions.get(clientId);
    subscription.symbols.add(symbol);
    indicators.forEach((ind) => subscription.indicators.add(ind));
  }

  unsubscribe(clientId, symbol) {
    if (this.subscriptions.has(clientId)) {
      const subscription = this.subscriptions.get(clientId);
      subscription.symbols.delete(symbol);

      if (subscription.symbols.size === 0) {
        this.subscriptions.delete(clientId);
      }
    }
  }

  getSubscribedSymbols(clientId) {
    if (!this.subscriptions.has(clientId)) return [];
    return Array.from(this.subscriptions.get(clientId).symbols);
  }

  getAllSymbols() {
    const allSymbols = new Set();
    for (const subscription of this.subscriptions.values()) {
      subscription.symbols.forEach((symbol) => allSymbols.add(symbol));
    }
    return Array.from(allSymbols);
  }
}

module.exports = {
  CalculationEngine,
  IndicatorCalculator,
  DataAggregator,
};
