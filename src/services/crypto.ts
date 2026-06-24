// All crypto via node-forge (pure-JS) — avoids 'crypto' global missing in some Hermes builds
// eslint-disable-next-line @typescript-eslint/no-require-imports
const forge = require('node-forge')

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

export function encryptWithServerKey(plaintext: string): string {
  const publicKey = forge.pki.publicKeyFromPem(PINNED_SERVER_PUBKEY_PEM)
  const encrypted = publicKey.encrypt(plaintext, 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  })
  return forge.util.encode64(encrypted)
}

// ── Random bytes (forge.random replaces crypto.getRandomValues) ───────────────

export function secureRandomBytes(n: number): Uint8Array {
  const bytes = forge.random.getBytesSync(n)
  const arr = new Uint8Array(n)
  for (let i = 0; i < n; i++) arr[i] = bytes.charCodeAt(i)
  return arr
}

export function generateBackupKey(): string {
  const bytes = secureRandomBytes(32)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── AES-256-GCM via forge (replaces crypto.subtle AES-GCM) ───────────────────

function bytesToBase64(bytes: Uint8Array): string {
  return forge.util.encode64(forge.util.createBuffer(bytes).bytes())
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return arr
}

export async function encryptSeedForBackup(
  seed: string,
  keyHex: string,
): Promise<{ ciphertext: string; iv: string }> {
  const keyBytes = hexToBytes(keyHex)
  const ivBytes  = secureRandomBytes(12)

  const cipher = forge.cipher.createCipher('AES-GCM', forge.util.createBuffer(keyBytes))
  cipher.start({ iv: forge.util.createBuffer(ivBytes), tagLength: 128 })
  cipher.update(forge.util.createBuffer(new TextEncoder().encode(seed)))
  cipher.finish()

  // cipher.output = ciphertext, cipher.mode.tag = 16-byte auth tag
  const ctBytes  = new Uint8Array(cipher.output.length())
  const ctStr    = cipher.output.bytes()
  for (let i = 0; i < ctBytes.length; i++) ctBytes[i] = ctStr.charCodeAt(i)

  const tagBytes = new Uint8Array(16)
  const tagStr   = cipher.mode.tag.bytes()
  for (let i = 0; i < 16; i++) tagBytes[i] = tagStr.charCodeAt(i)

  // Append tag to ciphertext (matches WebCrypto AES-GCM convention)
  const combined = new Uint8Array(ctBytes.length + 16)
  combined.set(ctBytes)
  combined.set(tagBytes, ctBytes.length)

  return {
    ciphertext: bytesToBase64(combined),
    iv: bytesToBase64(ivBytes),
  }
}
