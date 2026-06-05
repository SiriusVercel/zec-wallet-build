// src/services/price.ts
import { KRAKEN_TICKER_URL, KRAKEN_OHLC_URL, KRAKEN_PAIR, PRICE_REFRESH_MS } from '../config'

export interface PricePoint {
  time: number   // Unix timestamp ms
  close: number  // USD price
}

export type Period = '24H' | '7D' | '30D' | '1Y'

let _cached: { price: number; ts: number } | null = null

export async function getCurrentPrice(): Promise<number> {
  const now = Date.now()
  if (_cached && now - _cached.ts < PRICE_REFRESH_MS) return _cached.price

  const res = await fetch(KRAKEN_TICKER_URL)
  if (!res.ok) throw new Error(`Kraken ticker error: ${res.status}`)
  const json = await res.json()
  const price = parseFloat(json.result?.[KRAKEN_PAIR]?.c?.[0] ?? '0')
  if (price > 0) {
    _cached = { price, ts: now }
  }
  return price
}

const INTERVAL_BY_PERIOD: Record<Period, number> = {
  '24H': 60,
  '7D': 240,
  '30D': 1440,
  '1Y': 10080,
}

export async function getPriceHistory(period: Period): Promise<PricePoint[]> {
  const interval = INTERVAL_BY_PERIOD[period]
  const res = await fetch(`${KRAKEN_OHLC_URL}?pair=${KRAKEN_PAIR}&interval=${interval}`)
  if (!res.ok) throw new Error(`Kraken OHLC error: ${res.status}`)
  const json = await res.json()

  const candles: number[][] = json.result?.[KRAKEN_PAIR] ?? []
  return candles.map(([time, , , , close]) => ({
    time: time * 1000,
    close: parseFloat(String(close)),
  }))
}

export function zecToUsd(amountZat: number, priceUsd: number): number {
  return (amountZat / 1e8) * priceUsd
}
