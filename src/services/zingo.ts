// src/services/zingo.ts
import { API_BASE } from '../config'

async function post<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'request failed')
  return data as T
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'request failed')
  return data as T
}

export interface GeneratedWallet {
  mnemonic: string
  address: string
  ufvk: string
  birthday: number
}

export interface DerivedWallet {
  address: string
  ufvk: string
  birthday: number
}

export interface Balance {
  orchard: number
  sapling: number
  transparent: number
  total: number
}

export interface Transaction {
  txid: string
  amount: number
  memo: string
  block: number
  pool: string
  direction: 'received' | 'sent'
}

export interface SyncStatus {
  synced: number
  total: number
  percent: number
  eta: number
}

export function generateWallet(): Promise<GeneratedWallet> {
  return post<GeneratedWallet>('/api/zec/generate')
}

export function deriveWallet(mnemonic: string, birthday?: number): Promise<DerivedWallet> {
  return post<DerivedWallet>('/api/zec/derive', { mnemonic, birthday })
}

export function getBalance(ufvk: string): Promise<Balance> {
  return post<Balance>('/api/zec/balance', { ufvk })
}

export function getTransactions(ufvk: string, limit = 50): Promise<Transaction[]> {
  return post<Transaction[]>('/api/zec/transactions', { ufvk, limit })
}

export function estimateFee(toAddress: string, amountZat: number): Promise<{ fee: number }> {
  return post<{ fee: number }>('/api/zec/estimate-fee', { toAddress, amountZat })
}

export function sendTransaction(
  mnemonic: string,
  toAddress: string,
  amountZat: number,
  memo?: string,
): Promise<{ txid: string }> {
  return post<{ txid: string }>('/api/zec/send', { mnemonic, toAddress, amountZat, memo })
}

export function getSyncStatus(): Promise<SyncStatus> {
  return get<SyncStatus>('/api/zec/sync-status')
}

export function startSync(): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>('/api/zec/sync-start')
}

export function isValidZecAddress(addr: string): boolean {
  if (addr.startsWith('u1') && addr.length >= 43) return true
  if (addr.startsWith('t1') && addr.length === 35) return true
  if (addr.startsWith('zs1') && addr.length >= 43) return true
  return false
}
