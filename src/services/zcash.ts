// src/services/zcash.ts
import * as SecureStore from 'expo-secure-store'

const SEED_KEY     = 'zec_seed_phrase'
const ADDR_KEY     = 'zec_address'
const UFVK_KEY     = 'zec_ufvk'
const BIRTHDAY_KEY = 'zec_birthday'

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export async function saveSeed(mnemonic: string): Promise<void> {
  await SecureStore.setItemAsync(SEED_KEY, mnemonic, SECURE_OPTIONS)
}

export async function getSeed(): Promise<string | null> {
  return SecureStore.getItemAsync(SEED_KEY, SECURE_OPTIONS)
}

export interface WalletInfo {
  address: string
  ufvk: string
  birthday: number
}

export async function saveWalletInfo(info: WalletInfo): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ADDR_KEY, info.address, SECURE_OPTIONS),
    SecureStore.setItemAsync(UFVK_KEY, info.ufvk, SECURE_OPTIONS),
    SecureStore.setItemAsync(BIRTHDAY_KEY, String(info.birthday), SECURE_OPTIONS),
  ])
}

export async function getWalletInfo(): Promise<WalletInfo | null> {
  const [address, ufvk, birthdayStr] = await Promise.all([
    SecureStore.getItemAsync(ADDR_KEY, SECURE_OPTIONS),
    SecureStore.getItemAsync(UFVK_KEY, SECURE_OPTIONS),
    SecureStore.getItemAsync(BIRTHDAY_KEY, SECURE_OPTIONS),
  ])
  if (!address || !ufvk) return null
  return { address, ufvk, birthday: Number(birthdayStr) || 3340000 }
}

export async function walletExists(): Promise<boolean> {
  const addr = await SecureStore.getItemAsync(ADDR_KEY, SECURE_OPTIONS)
  return !!addr
}

export async function clearWallet(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SEED_KEY, SECURE_OPTIONS),
    SecureStore.deleteItemAsync(ADDR_KEY, SECURE_OPTIONS),
    SecureStore.deleteItemAsync(UFVK_KEY, SECURE_OPTIONS),
    SecureStore.deleteItemAsync(BIRTHDAY_KEY, SECURE_OPTIONS),
  ])
}
