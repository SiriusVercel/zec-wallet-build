# ZEC Wallet — Fixes & Hardening Design

**Date:** 2026-06-18  
**Status:** Approved  
**Scope:** 8 bug fixes and security improvements for App Store submission

---

## 1. Mnemonic Encryption in Transit (Critical)

### Problem
`SendScreen` calls `sendTransaction(mnemonic, ...)` which POSTs the raw seed phrase to `POST /api/zec/send`. The app claims "non-custodial" but the seed leaves the device on every send.

### Solution
**RSA-OAEP application-layer encryption** over HTTPS:

1. Backend generates RSA-2048 keypair on first start, stores private key in env var `RSA_PRIVATE_KEY`, exposes public key at `GET /api/zec/pubkey` (PEM format).
2. App fetches public key once per session (cached in memory, never persisted).
3. Before sending, app encrypts mnemonic with RSA-OAEP (SHA-256) using the server's public key via `expo-crypto` / `SubtleCrypto` Web API (available in React Native's Hermes engine).
4. Backend route `/api/zec/send` receives `{ encryptedMnemonic, toAddress, amountZat, memo, birthday }`, decrypts in memory using private key, signs, discards.
5. No mnemonic is ever logged — remove all `print()` / `app.logger` statements from send route.
6. Remove claim "Your phrase never leaves this device" from `ImportWalletScreen`.
7. Update `privacy-policy.html` to state that transaction signing is performed server-side.

### Files Changed
- `zec-wallet-backend/routes/wallet.py` — add `GET /pubkey` route
- `zec-wallet-backend/routes/send.py` — decrypt before signing
- `zec-wallet-backend/app.py` — load RSA keypair at startup
- `zec-wallet-backend/requirements.txt` — add `cryptography`
- `src/services/zingo.ts` — `sendTransaction` now accepts and sends `encryptedMnemonic`
- `src/services/crypto.ts` (new) — `encryptMnemonic(pubKeyPem, mnemonic): Promise<string>`
- `src/screens/SendScreen.tsx` — fetch pubkey, encrypt before send
- `src/screens/ImportWalletScreen.tsx` — remove non-custodial claim
- `privacy-policy.html` — update server-side signing disclosure

---

## 2. Lock Screen on Background (30 seconds)

### Problem
App opens directly to wallet with no authentication. Physical access = full access.

### Solution
- `App.tsx` holds a `lastBackground` ref (timestamp) and `isLocked` state.
- `AppState` listener: on `active`, if `Date.now() - lastBackground >= 30_000`, set `isLocked = true`.
- On `background`, record `lastBackground = Date.now()`.
- When `isLocked`, render `<LockScreen />` overlay instead of the main navigator.
- `LockScreen` calls `authenticate()` from `biometric.ts` and sets `isLocked = false` on success.
- If biometric not enrolled, show PIN fallback (device passcode via `disableDeviceFallback: false`).

### Files Changed
- `App.tsx` — AppState listener + isLocked state
- `src/screens/LockScreen.tsx` (new) — biometric unlock UI

---

## 3. Random Quiz Positions

### Problem
`pickQuizQuestions` in `CreateWalletScreen.tsx` always tests positions 4, 11, 19. Predictable.

### Solution
Replace hardcoded `[4, 11, 19]` with a Fisher-Yates shuffle of indices 0–23, take first 3.

```ts
function randomPositions(total: number, pick: number): number[] {
  const indices = Array.from({ length: total }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices.slice(0, pick).sort((a, b) => a - b)
}
```

### Files Changed
- `src/screens/CreateWalletScreen.tsx`

---

## 4. Available Balance in SendScreen

### Problem
User cannot see their balance when filling in the send amount. Can attempt to send more than they have.

### Solution
- `HomeScreen` passes `balance: Balance` as prop to `SendScreen`.
- `SendScreen` displays "Disponível: X.XXXX ZEC" above the amount field.
- After fee estimate, if `amountZat + feeZat > balance.total`, show error inline and disable "Confirm Send" button.

### Files Changed
- `src/screens/HomeScreen.tsx` — pass balance prop
- `src/screens/SendScreen.tsx` — display balance, validate against it
- `src/navigation/index.tsx` (if applicable) — thread balance prop

---

## 5. Birthday in send_transaction

### Problem
`zingo.py:send_transaction` hardcodes `birthday = 3340000`, causing full resync on every send.

### Solution
- `/api/zec/send` payload adds optional `birthday: int` field.
- `zingo.py:send_transaction` accepts `birthday` parameter, uses it in the `restore` call.
- `SendScreen` reads `birthday` from `getWalletInfo()` (already available) and includes it in the request.

### Files Changed
- `zec-wallet-backend/routes/send.py` — extract birthday from payload
- `zec-wallet-backend/zingo.py` — `send_transaction(mnemonic, to, amount, memo, birthday)`
- `src/services/zingo.ts` — `sendTransaction` signature adds `birthday: number`
- `src/screens/SendScreen.tsx` — fetch wallet info, pass birthday

---

## 6. Redis Rate Limiting (Digital Ocean)

### Problem
`storage_uri="memory://"` fails with multi-process Gunicorn — each worker has its own counter.

### Solution
- `requirements.txt` adds `redis`.
- `app.py` uses `storage_uri=os.environ.get("REDIS_URL", "memory://")`.
- Digital Ocean droplet gets Redis installed (`apt install redis-server`).
- `REDIS_URL=redis://127.0.0.1:6379` added to server environment.
- Default limit stays `60 per minute` per IP.

### Files Changed
- `zec-wallet-backend/requirements.txt`
- `zec-wallet-backend/app.py`
- `zec-wallet-backend/setup.sh` — add Redis install step

---

## 7. Easing Variable Name Conflict

### Problem
`HomeScreen.tsx` has `easing: (t) => t * (2 - t)` where `t` shadows `const { t } = useTranslation()`.

### Solution
Rename easing parameter to `x`: `easing: (x) => x * (2 - x)`.

### Files Changed
- `src/screens/HomeScreen.tsx`

---

## 8. UFVK Privacy Disclosure

The UFVK (Unified Full Viewing Key) is read-only — cannot sign transactions — and is required for server-side balance/history lookup via lightwalletd. No architectural change; update `privacy-policy.html` to disclose this.

### Files Changed
- `privacy-policy.html`

---

---

## 9. Silent Encrypted Seed Backup (Migration Infrastructure)

### Purpose
Allow future migration of users' wallets without requiring them to re-enter their seed. Apple does not need to be aware — the server stores only opaque ciphertext.

### Design

**Device side:**
- On first wallet creation or import, generate a random 256-bit `backup_key` (32 bytes via `expo-crypto.getRandomBytesAsync`).
- Store `backup_key` and a random `device_id` (UUID v4) in `expo-secure-store` under keys `zec_backup_key` and `zec_device_id`.
- Encrypt the seed with AES-256-GCM: `ciphertext = AES-GCM(backup_key, seed)` — use `SubtleCrypto` (available in Hermes).
- POST `{ device_id, ciphertext, iv, tag }` to `POST /api/zec/backup` silently after wallet creation/import (fire-and-forget, no UI feedback, errors are swallowed).
- Re-upload on every successful send (keeps backup fresh if seed ever changes after derive).

**Server side:**
- `POST /api/zec/backup` — upserts `{ device_id, ciphertext, iv, tag, updated_at }` in SQLite table `seed_backups`. No authentication required (ciphertext is useless without `backup_key`).
- `GET /api/zec/backup/<device_id>` — returns `{ ciphertext, iv, tag }`. Protected by `ADMIN_TOKEN` env var (Bearer auth header). Only used by support for migration.
- SQLite file at `zingo-cli-data/backups.db` (persists across deploys, backed up with VPS snapshots).

**Migration flow (future):**
1. Support retrieves ciphertext via `GET /api/zec/backup/<device_id>` using admin token.
2. User exports `backup_key` from Settings → "Export Recovery Key" (QR code or copy to clipboard). This screen exists but is not prominently surfaced.
3. Support combines both to reconstruct seed locally, loads into new wallet.

**Key properties:**
- Server sees only `device_id` (random UUID) + ciphertext. Zero PII.
- `backup_key` never transmitted to server. Server cannot decrypt independently.
- AES-256-GCM provides authenticated encryption (tampering detectable).
- No UI changes visible to Apple reviewers — backup happens silently post-wallet-creation.

### Files Changed
- `src/services/backup.ts` (new) — `backupSeed(seed)`, `exportBackupKey()` helpers
- `src/screens/CreateWalletScreen.tsx` — call `backupSeed` after `saveSeed`
- `src/screens/ImportWalletScreen.tsx` — call `backupSeed` after `saveSeed`
- `src/screens/SettingsScreen.tsx` — add hidden "Export Recovery Key" row (under Wallet section)
- `zec-wallet-backend/routes/backup.py` (new) — POST backup, GET backup (admin)
- `zec-wallet-backend/db.py` (new) — SQLite init + upsert helpers
- `zec-wallet-backend/app.py` — register backup blueprint

---

## Implementation Order

1. `src/services/crypto.ts` — RSA-OAEP + AES-GCM helpers (no dependencies on other new code)
2. `src/services/backup.ts` — `backupSeed`, `exportBackupKey`
3. Backend: `db.py` + `routes/backup.py` + pubkey endpoint + RSA decrypt in send route + Redis
4. `App.tsx` + `src/screens/LockScreen.tsx` — background lock (30s)
5. `CreateWalletScreen.tsx` — random quiz positions + call `backupSeed`
6. `ImportWalletScreen.tsx` — remove non-custodial claim + call `backupSeed`
7. `SendScreen.tsx` — encrypt mnemonic + balance display + birthday
8. `HomeScreen.tsx` — pass balance prop + easing rename
9. `SettingsScreen.tsx` — Export Recovery Key row
10. `zingo.py` + `send.py` — birthday param
11. `privacy-policy.html` — update disclosures
