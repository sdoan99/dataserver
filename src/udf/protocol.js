// TradingView UDF Protocol constants and helpers
class UDFProtocol {
  static getSupportedResolutions() {
    return [
      "1",
      "3",
      "5",
      "15",
      "30",
      "60",
      "120",
      "240",
      "360",
      "480",
      "720",
      "D",
      "1D",
      "3D",
      "W",
      "1W",
      "M",
      "1M",
    ];
  }

  static normalizeResolution(resolution) {
    const resolutionMap = {
      1: "1m",
      3: "3m",
      5: "5m",
      15: "15m",
      30: "30m",
      60: "1h",
      120: "2h",
      240: "4h",
      360: "6h",
      480: "8h",
      720: "12h",
      D: "1d",
      "1D": "1d",
      "3D": "3d",
      W: "1w",
      "1W": "1w",
      M: "1M",
      "1M": "1M",
    };

    return resolutionMap[resolution] || resolution;
  }

  static denormalizeResolution(resolution) {
    const reverseMap = {
      "1m": "1",
      "3m": "3",
      "5m": "5",
      "15m": "15",
      "30m": "30",
      "1h": "60",
      "2h": "120",
      "4h": "240",
      "6h": "360",
      "8h": "480",
      "12h": "720",
      "1d": "D",
      "3d": "3D",
      "1w": "W",
      "1M": "M",
    };

    return reverseMap[resolution] || resolution;
  }

  static formatHistoryResponse(bars) {
    if (!bars || bars.length === 0) {
      return { s: "no_data" };
    }

    const response = {
      s: "ok",
      t: [],
      c: [],
      o: [],
      h: [],
      l: [],
      v: [],
    };

    bars.forEach((bar) => {
      response.t.push(Math.floor(bar.timestamp / 1000));
      response.o.push(bar.open);
      response.h.push(bar.high);
      response.l.push(bar.low);
      response.c.push(bar.close);
      response.v.push(bar.volume);
    });

    return response;
  }

  static formatSymbolInfo(symbol, exchange = "binance") {
    return {
      name: symbol,
      ticker: `${exchange}:${symbol}`,
      description: `${symbol} on ${exchange}`,
      type: exchange === "alpaca" ? "stock" : "crypto",
      session: "24x7",
      exchange: exchange,
      listed_exchange: exchange,
      timezone: "UTC",
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      supported_resolutions: this.getSupportedResolutions(),
      volume_precision: 2,
      data_status: "streaming",
      minmov: 1,
      pricescale: 100,
      pointvalue: 1,
    };
  }

  static parseSymbol(symbolString) {
    if (symbolString.includes(":")) {
      const [exchange, symbol] = symbolString.split(":");
      return { exchange, symbol };
    }

    return { exchange: "binance", symbol: symbolString };
  }

  static createSymbolString(symbol, exchange) {
    return `${exchange}:${symbol}`;
  }
}

module.exports = UDFProtocol;
