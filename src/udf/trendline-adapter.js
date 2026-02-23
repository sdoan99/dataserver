const UDFProtocol = require("./protocol");

class TrendlineUDFAdapter {
  constructor(trendlineAggregator) {
    this.trendlineAggregator = trendlineAggregator;
  }

  getSymbolInfo(symbol) {
    const { exchange, symbol: symbolName } = this.parseTrendlineSymbol(symbol);

    return {
      name: symbolName,
      ticker: symbol,
      description: this.getSymbolDescription(symbol, exchange),
      type: "probability",
      session: "24x7",
      exchange: exchange,
      listed_exchange: exchange,
      timezone: "UTC",
      has_intraday: true,
      has_daily: false,
      has_weekly_and_monthly: false,
      supported_resolutions: ["1", "5", "15", "60", "D"],
      volume_precision: 4,
      data_status: "streaming",
      minmov: 0.0001,
      pricescale: 10000,
      pointvalue: 1,
      fractional: true,
    };
  }

  parseTrendlineSymbol(symbolString) {
    if (symbolString.includes(":")) {
      const parts = symbolString.split(":");
      return {
        exchange: parts[0],
        symbol: parts.slice(1).join(":"),
      };
    }
    return { exchange: "oddsapi", symbol: symbolString };
  }

  getSymbolDescription(symbol, exchange) {
    const descriptions = {
      oddsapi: "Sports Odds Probability",
      polymarket: "Prediction Market Probability",
      kalshi: "Event Market Probability",
    };
    return `${symbol} - ${descriptions[exchange] || "Probability Data"}`;
  }

  formatTrendlineHistory(points, resolution) {
    if (!points || points.length === 0) {
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

    points.forEach((point) => {
      response.t.push(Math.floor(point.timestamp / 1000));
      const probability = point.probability || point.value;
      response.o.push(probability);
      response.h.push(probability);
      response.l.push(probability);
      response.c.push(probability);
      response.v.push(point.volume || 0);
    });

    return response;
  }

  getHistory(symbol, resolution, from, to, countback) {
    const points = this.trendlineAggregator.getTrendline(
      symbol,
      countback || 100,
    );

    const filteredPoints = points.filter((point) => {
      const pointTime = point.timestamp / 1000;
      return pointTime >= from && (!to || pointTime <= to);
    });

    return this.formatTrendlineHistory(filteredPoints, resolution);
  }

  searchTrendlineSymbols(query, exchange, limit = 50) {
    const allSymbols = this.trendlineAggregator.getAllSymbols();
    const results = [];

    for (const symbol of allSymbols) {
      const { exchange: symbolExchange } = this.parseTrendlineSymbol(symbol);

      const matchesQuery = query
        ? symbol.toLowerCase().includes(query.toLowerCase())
        : true;
      const matchesExchange = exchange ? symbolExchange === exchange : true;

      if (matchesQuery && matchesExchange) {
        results.push({
          symbol: symbol.split(":").slice(1).join(":"),
          full_name: symbol,
          description: this.getSymbolDescription(symbol, symbolExchange),
          exchange: symbolExchange,
          type: "probability",
        });

        if (results.length >= limit) break;
      }
    }

    return results;
  }
}

module.exports = TrendlineUDFAdapter;
