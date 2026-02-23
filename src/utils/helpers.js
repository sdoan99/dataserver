const moment = require("moment");

class Helpers {
  static sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static formatNumber(num, decimals = 2) {
    if (num === null || num === undefined) return "0.00";
    return parseFloat(num).toFixed(decimals);
  }

  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  static parseSymbol(symbol) {
    // Parse symbol string like "BTCUSDT" or "BTC-USDT"
    const match = symbol.match(/^([A-Z]+)(USDT|USD|EUR|GBP|JPY)$/i);
    if (match) {
      return {
        base: match[1].toUpperCase(),
        quote: match[2].toUpperCase(),
      };
    }

    const dashMatch = symbol.match(/^([A-Z]+)-([A-Z]+)$/i);
    if (dashMatch) {
      return {
        base: dashMatch[1].toUpperCase(),
        quote: dashMatch[2].toUpperCase(),
      };
    }

    return { base: symbol, quote: "USDT" };
  }

  static getTimeframeSeconds(timeframe) {
    const timeframeMap = {
      "1m": 60,
      "3m": 180,
      "5m": 300,
      "15m": 900,
      "30m": 1800,
      "1h": 3600,
      "2h": 7200,
      "4h": 14400,
      "6h": 21600,
      "8h": 28800,
      "12h": 43200,
      "1d": 86400,
      "3d": 259200,
      "1w": 604800,
      "1M": 2592000,
    };

    return timeframeMap[timeframe] || 60;
  }

  static calculateChange(previous, current) {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  static roundToNearest(num, nearest) {
    return Math.round(num / nearest) * nearest;
  }

  static formatTimestamp(timestamp, format = "YYYY-MM-DD HH:mm:ss") {
    return moment(timestamp).format(format);
  }

  static isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }

  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  static mergeObjects(...objects) {
    return Object.assign({}, ...objects);
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  static getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static isMarketOpen() {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    // Crypto markets are open 24/7
    // Stock markets: Monday-Friday, 9:30 AM - 4:00 PM EST
    if (day >= 1 && day <= 5) {
      // Monday to Friday
      const estHour = (hour + 5) % 24; // Convert UTC to EST
      return estHour >= 9 && estHour < 16;
    }

    return false;
  }
}

module.exports = Helpers;
