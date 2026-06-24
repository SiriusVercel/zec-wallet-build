import { NativeModules, Platform } from 'react-native'

const { ZecLiveActivityModule } = NativeModules

const isSupported = Platform.OS === 'ios' && !!ZecLiveActivityModule

export async function startLiveActivity(
  type: 'send' | 'receive',
  amountZec: number,
  address: string,
): Promise<string | null> {
  if (!isSupported) return null
  try {
    return await ZecLiveActivityModule.startActivity(type, amountZec, address)
  } catch {
    return null
  }
}

export async function updateLiveActivity(txid: string, state: 'pending' | 'confirmed' | 'failed'): Promise<void> {
  if (!isSupported) return
  try {
    await ZecLiveActivityModule.updateActivity(txid, state)
  } catch { /* ignore */ }
}

export async function endLiveActivity(): Promise<void> {
  if (!isSupported) return
  try {
    await ZecLiveActivityModule.endActivity()
  } catch { /* ignore */ }
}
