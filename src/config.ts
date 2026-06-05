// src/config.ts
export const API_BASE = __DEV__
  ? 'http://localhost:8000'
  : 'https://api.zecwallet.app'

export const KRAKEN_OHLC_URL = 'https://api.kraken.com/0/public/OHLC'
export const KRAKEN_TICKER_URL = 'https://api.kraken.com/0/public/Ticker?pair=XECZUSD'
export const KRAKEN_PAIR = 'XECZUSD'

export const POLL_INTERVAL_MS = 5000
export const POLL_MAX_RETRIES = 12
export const PRICE_REFRESH_MS = 60000
