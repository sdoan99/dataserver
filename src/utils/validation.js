class Validation {
  static isValidSymbol(symbol) {
    if (!symbol || typeof symbol !== "string") return false;

    // Basic validation: alphanumeric with possible dash/underscore
    const symbolRegex = /^[A-Z0-9\-_]+$/i;
    return symbolRegex.test(symbol) && symbol.length <= 20;
  }

  static isValidExchange(exchange) {
    const validExchanges = [
      "binance",
      "bybit",
      "blofin",
      "alpaca",
      "geckoterminal",
    ];
    return validExchanges.includes(exchange.toLowerCase());
  }

  static isValidResolution(resolution) {
    const validResolutions = [
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
      "1m",
      "3m",
      "5m",
      "15m",
      "30m",
      "1h",
      "2h",
      "4h",
      "6h",
      "8h",
      "12h",
      "1d",
      "3d",
      "1w",
      "1M",
    ];

    return validResolutions.includes(resolution);
  }

  static isValidTimestamp(timestamp) {
    if (!timestamp || isNaN(timestamp)) return false;

    const date = new Date(timestamp);
    return date instanceof Date && !isNaN(date.getTime());
  }

  static isValidOHLC(data) {
    if (!data || typeof data !== "object") return false;

    const requiredFields = [
      "open",
      "high",
      "low",
      "close",
      "volume",
      "timestamp",
    ];

    for (const field of requiredFields) {
      if (!(field in data) || isNaN(data[field])) {
        return false;
      }
    }

    // Additional validation
    if (data.high < data.low) return false;
    if (data.close > data.high || data.close < data.low) return false;
    if (data.open > data.high || data.open < data.low) return false;
    if (data.volume < 0) return false;

    return true;
  }

  static validateSubscriptionRequest(data) {
    const errors = [];

    if (!data.symbol) {
      errors.push("Symbol is required");
    } else if (!this.isValidSymbol(data.symbol)) {
      errors.push("Invalid symbol format");
    }

    if (data.exchange && !this.isValidExchange(data.exchange)) {
      errors.push("Invalid exchange");
    }

    if (data.resolution && !this.isValidResolution(data.resolution)) {
      errors.push("Invalid resolution");
    }

    if (data.indicators && !Array.isArray(data.indicators)) {
      errors.push("Indicators must be an array");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateHistoryRequest(data) {
    const errors = [];

    if (!data.symbol) {
      errors.push("Symbol is required");
    }

    if (!data.resolution) {
      errors.push("Resolution is required");
    } else if (!this.isValidResolution(data.resolution)) {
      errors.push("Invalid resolution");
    }

    if (!data.from) {
      errors.push("From timestamp is required");
    } else if (!this.isValidTimestamp(data.from)) {
      errors.push("Invalid from timestamp");
    }

    if (data.to && !this.isValidTimestamp(data.to)) {
      errors.push("Invalid to timestamp");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static sanitizeString(str) {
    if (typeof str !== "string") return "";

    return str.replace(/[<>"'&]/g, "").substring(0, 1000);
  }

  static sanitizeObject(obj) {
    if (!obj || typeof obj !== "object") return {};

    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === "number") {
        sanitized[key] = isNaN(value) ? 0 : value;
      } else if (typeof value === "boolean") {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === "string" ? this.sanitizeString(item) : item,
        );
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  static isRateLimitExceeded(requests, limit, windowMs) {
    if (!Array.isArray(requests)) return false;

    const now = Date.now();
    const windowStart = now - windowMs;

    const recentRequests = requests.filter(
      (timestamp) => timestamp > windowStart,
    );
    return recentRequests.length >= limit;
  }
}

module.exports = Validation;
