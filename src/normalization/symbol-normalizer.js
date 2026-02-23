const constants = require("../config/constants");

class SymbolNormalizer {
  static normalize(symbol, source) {
    if (!symbol || typeof symbol !== "string") {
      throw new Error("Invalid symbol provided");
    }

    let normalizedSymbol = symbol.trim().toUpperCase();
    const exchange = this.getExchangeFromSource(source);

    // Apply exchange-specific normalization rules
    switch (exchange) {
      case constants.EXCHANGES.BINANCE:
        normalizedSymbol = this.normalizeBinanceSymbol(normalizedSymbol);
        break;

      case constants.EXCHANGES.BYBIT:
        normalizedSymbol = this.normalizeBybitSymbol(normalizedSymbol);
        break;

      case constants.EXCHANGES.BLOFIN:
        normalizedSymbol = this.normalizeBlofinSymbol(normalizedSymbol);
        break;

      case constants.EXCHANGES.ALPACA:
        normalizedSymbol = this.normalizeAlpacaSymbol(normalizedSymbol);
        break;

      case constants.EXCHANGES.GECKO:
        normalizedSymbol = this.normalizeGeckoSymbol(normalizedSymbol);
        break;

      default:
        normalizedSymbol = this.normalizeGenericSymbol(normalizedSymbol);
    }

    return {
      symbol: normalizedSymbol,
      exchange: exchange,
      normalizedKey: this.createNormalizedKey(normalizedSymbol, exchange),
      originalSymbol: symbol,
      source: source,
    };
  }

  static normalizeBinanceSymbol(symbol) {
    // Remove 'USDT' and add it back to standardize
    const base = symbol.replace(/USDT$/i, "");
    return base + "USDT";
  }

  static normalizeBybitSymbol(symbol) {
    // Bybit symbols are usually like BTCUSDT, ETHUSDT
    // Ensure they end with USDT for consistency
    if (!symbol.endsWith("USDT")) {
      return symbol + "USDT";
    }
    return symbol;
  }

  static normalizeBlofinSymbol(symbol) {
    // Blofin uses format like BTC-USDT, convert to BTCUSDT
    return symbol.replace("-", "");
  }

  static normalizeAlpacaSymbol(symbol) {
    // Alpaca symbols are standard stock symbols like AAPL, MSFT
    // Just ensure they're uppercase
    return symbol;
  }

  static normalizeGeckoSymbol(symbol) {
    // GeckoTerminal symbols are like ETH_USDC, convert to ETHUSDC
    return symbol.replace("_", "");
  }

  static normalizeGenericSymbol(symbol) {
    // Remove any non-alphanumeric characters except underscores
    return symbol.replace(/[^A-Z0-9_]/g, "");
  }

  static getExchangeFromSource(source) {
    const sourceMap = {
      binance_futures: constants.EXCHANGES.BINANCE,
      bybit_linear: constants.EXCHANGES.BYBIT,
      blofin: constants.EXCHANGES.BLOFIN,
      alpaca_1: constants.EXCHANGES.ALPACA,
      alpaca_2: constants.EXCHANGES.ALPACA,
      geckoterminal: constants.EXCHANGES.GECKO,
      binance: constants.EXCHANGES.BINANCE,
      bybit: constants.EXCHANGES.BYBIT,
      alpaca: constants.EXCHANGES.ALPACA,
    };

    return sourceMap[source] || constants.EXCHANGES.BINANCE;
  }

  static createNormalizedKey(symbol, exchange) {
    return `${exchange}:${symbol}`;
  }

  static parseNormalizedKey(key) {
    const [exchange, ...symbolParts] = key.split(":");
    const symbol = symbolParts.join(":");
    return { exchange, symbol };
  }

  static isTradablePair(symbol, exchange) {
    // Check if this is likely a tradable pair based on patterns
    const usdtPairs = /USDT$/i;
    const usdPairs = /USD$/i;
    const cryptoPairs = /^[A-Z]{2,10}(USDT|USD|BTC|ETH)$/i;

    switch (exchange) {
      case constants.EXCHANGES.BINANCE:
      case constants.EXCHANGES.BYBIT:
      case constants.EXCHANGES.BLOFIN:
        return cryptoPairs.test(symbol);

      case constants.EXCHANGES.ALPACA:
        // Stocks are usually 1-5 letters
        return /^[A-Z]{1,5}$/.test(symbol);

      case constants.EXCHANGES.GECKO:
        // DEX pairs can have various formats
        return symbol.includes("_") || usdtPairs.test(symbol);

      default:
        return cryptoPairs.test(symbol);
    }
  }

  static extractBaseQuote(symbol, exchange) {
    if (!this.isTradablePair(symbol, exchange)) {
      return { base: symbol, quote: "USD" };
    }

    const quoteCurrencies = ["USDT", "USD", "BTC", "ETH", "EUR", "GBP", "JPY"];

    for (const quote of quoteCurrencies) {
      if (symbol.endsWith(quote)) {
        return {
          base: symbol.slice(0, -quote.length),
          quote: quote,
        };
      }
    }

    // For stock symbols or unknown format
    if (exchange === constants.EXCHANGES.ALPACA) {
      return { base: symbol, quote: "USD" };
    }

    // Try to split by underscore for DEX pairs
    if (symbol.includes("_")) {
      const [base, quote] = symbol.split("_");
      return { base, quote };
    }

    return { base: symbol, quote: "USD" };
  }

  static createSymbolVariants(symbol, exchange) {
    const normalized = this.normalize(symbol, exchange);
    const variants = new Set();

    // Add normalized version
    variants.add(normalized.symbol);

    // Add common variations
    if (exchange === constants.EXCHANGES.BLOFIN) {
      variants.add(symbol.replace("-", "_"));
      variants.add(symbol.replace("-", ""));
    }

    if (exchange === constants.EXCHANGES.GECKO) {
      variants.add(symbol.replace("_", ""));
      variants.add(symbol.replace("_", "-"));
    }

    // Add with and without USDT
    if (normalized.symbol.endsWith("USDT")) {
      variants.add(normalized.symbol.replace("USDT", ""));
      variants.add(normalized.symbol.replace("USDT", "-USDT"));
      variants.add(normalized.symbol.replace("USDT", "_USDT"));
    }

    return Array.from(variants);
  }

  static matchSymbol(inputSymbol, targetSymbol, exchange) {
    const inputNormalized = this.normalize(inputSymbol, exchange).symbol;
    const targetNormalized = this.normalize(targetSymbol, exchange).symbol;

    return inputNormalized === targetNormalized;
  }

  static getSymbolCategory(symbol, exchange) {
    const { base, quote } = this.extractBaseQuote(symbol, exchange);

    // Common cryptocurrency categories
    const majorCryptos = [
      "BTC",
      "ETH",
      "BNB",
      "XRP",
      "ADA",
      "SOL",
      "DOT",
      "DOGE",
    ];
    const stablecoins = ["USDT", "USDC", "DAI", "BUSD", "UST", "TUSD"];
    const defiTokens = ["UNI", "AAVE", "COMP", "MKR", "SUSHI", "CRV"];
    const layer1 = ["AVAX", "MATIC", "ATOM", "ALGO", "NEAR", "FTM"];

    if (majorCryptos.includes(base)) {
      return "major_crypto";
    } else if (defiTokens.includes(base)) {
      return "defi";
    } else if (layer1.includes(base)) {
      return "layer1";
    } else if (stablecoins.includes(base)) {
      return "stablecoin";
    } else if (exchange === constants.EXCHANGES.ALPACA) {
      return "stock";
    } else {
      return "other";
    }
  }

  static validateSymbol(symbol, exchange) {
    if (
      !symbol ||
      typeof symbol !== "string" ||
      symbol.length < 1 ||
      symbol.length > 20
    ) {
      return { valid: false, reason: "Invalid symbol length or type" };
    }

    // Check for invalid characters
    const invalidChars = /[^A-Z0-9\-_]/;
    if (invalidChars.test(symbol.toUpperCase())) {
      return { valid: false, reason: "Invalid characters in symbol" };
    }

    const normalized = this.normalize(symbol, exchange);

    if (!this.isTradablePair(normalized.symbol, exchange)) {
      return {
        valid: false,
        reason: "Symbol does not appear to be a tradable pair",
      };
    }

    return {
      valid: true,
      normalizedSymbol: normalized.symbol,
      normalizedKey: normalized.normalizedKey,
    };
  }

  static batchNormalize(symbols, source) {
    const result = {
      valid: [],
      invalid: [],
      duplicates: new Set(),
      normalizedMap: new Map(),
    };

    for (const symbol of symbols) {
      try {
        const normalized = this.normalize(symbol, source);
        const validation = this.validateSymbol(
          normalized.symbol,
          normalized.exchange,
        );

        if (validation.valid) {
          if (result.normalizedMap.has(normalized.normalizedKey)) {
            result.duplicates.add(normalized.normalizedKey);
          } else {
            result.normalizedMap.set(normalized.normalizedKey, normalized);
            result.valid.push(normalized);
          }
        } else {
          result.invalid.push({
            original: symbol,
            reason: validation.reason,
          });
        }
      } catch (error) {
        result.invalid.push({
          original: symbol,
          reason: error.message,
        });
      }
    }

    return {
      ...result,
      duplicates: Array.from(result.duplicates),
      count: result.valid.length,
    };
  }
}

module.exports = SymbolNormalizer;
