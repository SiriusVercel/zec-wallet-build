import * as SecureStore from 'expo-secure-store'
import { secureRandomBytes } from './crypto'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const forge = require('node-forge')

const PIN_KEY         = 'zec_pin_code'
const PIN_ENABLED_KEY = 'zec_pin_enabled'

const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

function randomHex(len: number): string {
  const bytes = secureRandomBytes(len)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// PBKDF2-SHA256: 100k iterations, 32-byte output — brute-force resistant for 6-digit PINs
function pbkdf2Hex(pin: string, salt: string): string {
  const derived = forge.pkcs5.pbkdf2(pin, salt, 100_000, 32, forge.md.sha256.create())
  return forge.util.bytesToHex(derived)
}

export async function isPinEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(PIN_ENABLED_KEY, OPTS)
  return val === 'true'
}

export async function setPin(pin: string): Promise<void> {
  const salt = randomHex(16)
  const hash = pbkdf2Hex(pin, salt)
  await SecureStore.setItemAsync(PIN_KEY, `pbkdf2:${salt}:${hash}`, OPTS)
  await SecureStore.setItemAsync(PIN_ENABLED_KEY, 'true', OPTS)
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY, OPTS)
  if (!stored) return false
  if (stored.startsWith('pbkdf2:')) {
    const [, salt, storedHash] = stored.split(':')
    return pbkdf2Hex(pin, salt) === storedHash
  }
  // Legacy SHA-256 fallback (one-time migration on next setPin)
  const salt = stored.slice(0, 32)
  const storedHash = stored.slice(33)
  const md = forge.md.sha256.create()
  md.update(salt + ':' + pin, 'utf8')
  return md.digest().toHex() === storedHash
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY, OPTS)
  await SecureStore.setItemAsync(PIN_ENABLED_KEY, 'false', OPTS)
}

export async function hasPin(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY, OPTS)
  return stored !== null && stored.includes(':')
}
