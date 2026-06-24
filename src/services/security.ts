import * as Clipboard from 'expo-clipboard'

export async function isJailbroken(): Promise<boolean> {
  return false
}

export function scheduleClipboardClear(delayMs = 60_000): () => void {
  const timer = setTimeout(async () => {
    try {
      await Clipboard.setStringAsync('')
    } catch {}
  }, delayMs)
  return () => clearTimeout(timer)
}
