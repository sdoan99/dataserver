const {
  SMA,
  EMA,
  RSI,
  MACD,
  BollingerBands,
  Stochastic,
  ATR,
  OBV,
} = require("technicalindicators");

class IndicatorCalculator {
  constructor() {
    this.priceHistory = new Map(); // symbol -> {timestamp, open, high, low, close, volume}[]
    this.maxHistoryLength = 1000;
  }

  addData(symbol, data) {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol);
    history.push(data);

    // Keep only recent data
    if (history.length > this.maxHistoryLength) {
      history.shift();
    }
  }

  calculateAll(symbol) {
    const history = this.priceHistory.get(symbol) || [];
    if (history.length < 50) return {}; // Need enough data

    const closes = history.map((d) => d.close);
    const highs = history.map((d) => d.high);
    const lows = history.map((d) => d.low);
    const volumes = history.map((d) => d.volume);

    return {
      sma: this.calculateSMA(closes),
      ema: this.calculateEMA(closes),
      rsi: this.calculateRSI(closes),
      macd: this.calculateMACD(closes),
      bb: this.calculateBollingerBands(closes),
      stoch: this.calculateStochastic(highs, lows, closes),
      atr: this.calculateATR(highs, lows, closes),
      obv: this.calculateOBV(closes, volumes),
    };
  }

  calculateSMA(prices, period = 14) {
    if (prices.length < period) return null;
    const values = SMA.calculate({
      period,
      values: prices,
    });
    return values[values.length - 1] || null;
  }

  calculateEMA(prices, period = 14) {
    if (prices.length < period) return null;
    const values = EMA.calculate({
      period,
      values: prices,
    });
    return values[values.length - 1] || null;
  }

  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    const values = RSI.calculate({
      period,
      values: prices,
    });
    return values[values.length - 1] || null;
  }

  calculateMACD(prices) {
    if (prices.length < 26) return null;
    const values = MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    return values[values.length - 1] || null;
  }

  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) return null;
    const values = BollingerBands.calculate({
      period,
      values: prices,
      stdDev,
    });
    return values[values.length - 1] || null;
  }

  calculateStochastic(highs, lows, closes, period = 14, signalPeriod = 3) {
    if (highs.length < period) return null;
    const values = Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period,
      signalPeriod,
    });
    return values[values.length - 1] || null;
  }

  calculateATR(highs, lows, closes, period = 14) {
    if (highs.length < period) return null;
    const values = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period,
    });
    return values[values.length - 1] || null;
  }

  calculateOBV(closes, volumes) {
    if (closes.length < 2) return null;
    const values = OBV.calculate({
      close: closes,
      volume: volumes,
    });
    return values[values.length - 1] || null;
  }

  getLatestData(symbol) {
    const history = this.priceHistory.get(symbol);
    return history ? history[history.length - 1] : null;
  }

  getHistory(symbol, limit = 100) {
    const history = this.priceHistory.get(symbol);
    return history ? history.slice(-limit) : [];
  }

  clearHistory(symbol) {
    this.priceHistory.delete(symbol);
  }
}

module.exports = IndicatorCalculator;
