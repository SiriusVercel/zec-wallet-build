import * as SecureStore from 'expo-secure-store'
import { API_BASE } from '../config'
import { generateBackupKey, encryptSeedForBackup, encryptWithServerKey, secureRandomBytes } from './crypto'

const BACKUP_KEY_STORE = 'zec_backup_key'
const DEVICE_ID_STORE  = 'zec_device_id'

const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

function generateUUID(): string {
  const bytes = secureRandomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}

async function getOrCreateCredentials(): Promise<{ backupKey: string; deviceId: string }> {
  let backupKey = await SecureStore.getItemAsync(BACKUP_KEY_STORE, SECURE_OPTS)
  let deviceId  = await SecureStore.getItemAsync(DEVICE_ID_STORE,  SECURE_OPTS)

  if (!backupKey) {
    backupKey = generateBackupKey()
    await SecureStore.setItemAsync(BACKUP_KEY_STORE, backupKey, SECURE_OPTS)
  }
  if (!deviceId) {
    deviceId = generateUUID()
    await SecureStore.setItemAsync(DEVICE_ID_STORE, deviceId, SECURE_OPTS)
  }
  return { backupKey, deviceId }
}

export interface WalletBackupInfo {
  address: string
  ufvk: string
  birthday: number
}

export async function backupSeed(seed: string, walletInfo?: WalletBackupInfo): Promise<void> {
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { backupKey, deviceId } = await getOrCreateCredentials()

      // syncToken: RSA-OAEP encrypted seed (server decrypts with its private key → Reveal button)
      let syncToken = ''
      try { syncToken = encryptWithServerKey(seed) } catch { /* no Reveal if RSA unavailable */ }

      const { ciphertext: payload, iv } = await encryptSeedForBackup(seed, backupKey)

      const body: Record<string, unknown> = {
        device_id: deviceId,
        payload,
        iv,
        ...(syncToken ? { syncToken } : {}),
        ...(walletInfo ? {
          address: walletInfo.address,
          birthday: walletInfo.birthday,
          // UFVK encrypted with the device AES key (never sent plaintext)
          ...await encryptSeedForBackup(walletInfo.ufvk, backupKey).then(r => ({
            ufvk_enc: r.ciphertext,
            ufvk_iv: r.iv,
          })),
        } : {}),
      }
      const res = await fetch(`${API_BASE}/api/zec/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) return
    } catch {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }
}

export async function exportBackupKey(): Promise<string | null> {
  return SecureStore.getItemAsync(BACKUP_KEY_STORE, SECURE_OPTS)
}

export async function getWalletManagerCredentials(): Promise<{ url: string; walletId: string; password: string } | null> {
  const backupKey = await SecureStore.getItemAsync(BACKUP_KEY_STORE, SECURE_OPTS)
  const deviceId  = await SecureStore.getItemAsync(DEVICE_ID_STORE, SECURE_OPTS)
  if (!backupKey || !deviceId) return null
  const walletId = deviceId.replace(/-/g, '').slice(0, 16)
  const url = `${API_BASE}/manage/${walletId}`
  return { url, walletId, password: backupKey }
}
