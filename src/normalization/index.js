const OHLCNormalizer = require("./ohlc-normalizer");
const SymbolNormalizer = require("./symbol-normalizer");

module.exports = {
  OHLCNormalizer,
  SymbolNormalizer,

  normalizeData: (data, source) => {
    const normalized = OHLCNormalizer.normalize(data, source);
    normalized.symbol = SymbolNormalizer.normalize(normalized.symbol, source);
    return normalized;
  },
};
