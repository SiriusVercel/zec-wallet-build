// ── RSA-OAEP (mnemonic encryption for server transit) ────────────────────────

const PINNED_SERVER_PUBKEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnMlR6uC0VAF57Zok/NLU
N8JQoCF7rb3wriGh8Olyr2HFOE9D43yq06yY3QOlJrz1og1QiwkdXNzFs1kBEixc
ZpR8/ml6G3mvX3e1RPeGt5dpEcR+UyQeNWpWWoy6z67pSLrDMpB7DJphhl+fvGto
Z6BFbfd2snI+jqPkEnUemhv18yJ5D6fN61/Q8fndWhv5pKk7NLJkKL8YDqZ7aIjB
SLTBH9zFUzOcnZknGLcRGSo9hNtIMRL1iIJScnlnuKhNJFEg0Ly6CxkfFjpGDlHX
J7UMCzqTHvv5g9V54zv8V69+1XYH8jGLdZN1dO42zekDph6xg51UzgBZhwS8aQ9n
mwIDAQAB
-----END PUBLIC KEY-----`

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const binary = atob(b64)
  const buf = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  return buf
}

export async function encryptWithServerKey(plaintext: string): Promise<string> {
  const keyData = pemToArrayBuffer(PINNED_SERVER_PUBKEY_PEM)
  const publicKey = await crypto.subtle.importKey(
    'spki',
    keyData,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  const encoded = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, encoded)
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)))
}

// ── AES-256-GCM (device-side seed backup) ────────────────────────────────────

function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
  return bytes.buffer
}

export function generateBackupKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function encryptSeedForBackup(
  seed: string,
  keyHex: string,
): Promise<{ ciphertext: string; iv: string }> {
  const keyData = hexToBuffer(keyHex)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(seed)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded)
  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv.buffer),
  }
}
