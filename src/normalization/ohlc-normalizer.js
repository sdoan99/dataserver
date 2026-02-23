const constants = require("../config/constants");

class OHLCNormalizer {
  static normalize(data, source) {
    switch (source) {
      case constants.EXCHANGES.BINANCE:
        return this.normalizeBinance(data);
      case constants.EXCHANGES.BYBIT:
        return this.normalizeBybit(data);
      case constants.EXCHANGES.BLOFIN:
        return this.normalizeBlofin(data);
      case constants.EXCHANGES.ALPACA:
        return this.normalizeAlpaca(data);
      case constants.EXCHANGES.GECKO:
        return this.normalizeGecko(data);
      default:
        return this.normalizeGeneric(data);
    }
  }

  static normalizeBinance(kline) {
    return {
      [constants.NORMALIZED_FIELDS.TIMESTAMP]: kline.t,
      [constants.NORMALIZED_FIELDS.OPEN]: parseFloat(kline.o),
      [constants.NORMALIZED_FIELDS.HIGH]: parseFloat(kline.h),
      [constants.NORMALIZED_FIELDS.LOW]: parseFloat(kline.l),
      [constants.NORMALIZED_FIELDS.CLOSE]: parseFloat(kline.c),
      [constants.NORMALIZED_FIELDS.VOLUME]: parseFloat(kline.v),
      [constants.NORMALIZED_FIELDS.SYMBOL]: kline.s,
      [constants.NORMALIZED_FIELDS.EXCHANGE]: "binance",
      [constants.NORMALIZED_FIELDS.RESOLUTION]: this.getResolutionFromInterval(
        kline.i,
      ),
    };
  }

  static normalizeBybit(data) {
    return {
      [constants.NORMALIZED_FIELDS.TIMESTAMP]: data.start,
      [constants.NORMALIZED_FIELDS.OPEN]: parseFloat(data.open),
      [constants.NORMALIZED_FIELDS.HIGH]: parseFloat(data.high),
      [constants.NORMALIZED_FIELDS.LOW]: parseFloat(data.low),
      [constants.NORMALIZED_FIELDS.CLOSE]: parseFloat(data.close),
      [constants.NORMALIZED_FIELDS.VOLUME]: parseFloat(data.volume),
      [constants.NORMALIZED_FIELDS.SYMBOL]: data.symbol,
      [constants.NORMALIZED_FIELDS.EXCHANGE]: "bybit",
      [constants.NORMALIZED_FIELDS.RESOLUTION]: "1m",
    };
  }

  static normalizeBlofin(data, symbol) {
    return {
      [constants.NORMALIZED_FIELDS.TIMESTAMP]: parseInt(data[0]),
      [constants.NORMALIZED_FIELDS.OPEN]: parseFloat(data[1]),
      [constants.NORMALIZED_FIELDS.HIGH]: parseFloat(data[2]),
      [constants.NORMALIZED_FIELDS.LOW]: parseFloat(data[3]),
      [constants.NORMALIZED_FIELDS.CLOSE]: parseFloat(data[4]),
      [constants.NORMALIZED_FIELDS.VOLUME]: parseFloat(data[5]),
      [constants.NORMALIZED_FIELDS.SYMBOL]: symbol,
      [constants.NORMALIZED_FIELDS.EXCHANGE]: "blofin",
      [constants.NORMALIZED_FIELDS.RESOLUTION]: "1m",
    };
  }

  static normalizeAlpaca(bar) {
    return {
      [constants.NORMALIZED_FIELDS.TIMESTAMP]: new Date(bar.t).getTime(),
      [constants.NORMALIZED_FIELDS.OPEN]: bar.o,
      [constants.NORMALIZED_FIELDS.HIGH]: bar.h,
      [constants.NORMALIZED_FIELDS.LOW]: bar.l,
      [constants.NORMALIZED_FIELDS.CLOSE]: bar.c,
      [constants.NORMALIZED_FIELDS.VOLUME]: bar.v,
      [constants.NORMALIZED_FIELDS.SYMBOL]: bar.S,
      [constants.NORMALIZED_FIELDS.EXCHANGE]: "alpaca",
      [constants.NORMALIZED_FIELDS.RESOLUTION]: "1m",
    };
  }

  static normalizeGecko(pool) {
    const attributes = pool.attributes;
    return {
      [constants.NORMALIZED_FIELDS.TIMESTAMP]: Date.now(),
      [constants.NORMALIZED_FIELDS.OPEN]: parseFloat(
        attributes.base_token_price_usd,
      ),
      [constants.NORMALIZED_FIELDS.HIGH]: parseFloat(
        attributes.base_token_price_high_24h,
      ),
      [constants.NORMALIZED_FIELDS.LOW]: parseFloat(
        attributes.base_token_price_low_24h,
      ),
      [constants.NORMALIZED_FIELDS.CLOSE]: parseFloat(
        attributes.base_token_price_usd,
      ),
      [constants.NORMALIZED_FIELDS.VOLUME]: parseFloat(
        attributes.volume_usd.h24,
      ),
      [constants.NORMALIZED_FIELDS.SYMBOL]:
        `${attributes.base_token_symbol}_${attributes.quote_token_symbol}`,
      [constants.NORMALIZED_FIELDS.EXCHANGE]: "geckoterminal",
      [constants.NORMALIZED_FIELDS.RESOLUTION]: "24h",
    };
  }

  static normalizeGeneric(data) {
    return {
      ...data,
      [constants.NORMALIZED_FIELDS.TIMESTAMP]: data.timestamp || Date.now(),
      [constants.NORMALIZED_FIELDS.RESOLUTION]: data.resolution || "1m",
    };
  }

  static getResolutionFromInterval(interval) {
    const intervalMap = {
      "1m": "1m",
      "3m": "3m",
      "5m": "5m",
      "15m": "15m",
      "30m": "30m",
      "1h": "1h",
      "2h": "2h",
      "4h": "4h",
      "6h": "6h",
      "8h": "8h",
      "12h": "12h",
      "1d": "1d",
      "3d": "3d",
      "1w": "1w",
      "1M": "1M",
    };

    return intervalMap[interval] || interval;
  }
}

module.exports = OHLCNormalizer;
