# ZEC Wallet — Fixes & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 9 problemas de segurança, UX e privacidade do ZEC Wallet para submissão na App Store.

**Architecture:** RSA-OAEP cifra o mnemonic antes de trafegar para o servidor; AES-256-GCM cifra o seed para backup silencioso no servidor (chave nunca sai do dispositivo); AppState listener trava o app após 30s em background; saldo disponível exibido na SendScreen.

**Tech Stack:** React Native 0.85.3, Expo SDK 56, TypeScript, Flask 3.1, Python cryptography lib, SQLite, Redis, `crypto.subtle` (Hermes Web Crypto API)

## Global Constraints

- Expo SDK: `~56.0.x` — não atualizar sem motivo
- Antes de escrever qualquer código Expo, ler `https://docs.expo.dev/versions/v56.0.0/`
- TypeScript strict — sem `any` desnecessário
- `crypto.subtle` está disponível no Hermes (RN 0.85+) via global `crypto` — não instalar polyfills
- Backend: Python 3.11, Flask 3.1, arquivo `zingo-cli` em `./zingo-cli` (Linux x86_64)
- Sem comentários óbvios no código; só quando o "por quê" não é evidente
- Commits frequentes, um por tarefa

---

## File Map

### Novos arquivos
- `src/services/crypto.ts` — RSA-OAEP encrypt + AES-GCM encrypt/decrypt helpers
- `src/services/backup.ts` — `backupSeed`, `exportBackupKey`
- `src/screens/LockScreen.tsx` — tela de lock biométrico
- `zec-wallet-backend/db.py` — SQLite init + upsert helpers para backups
- `zec-wallet-backend/routes/backup.py` — POST /backup, GET /backup/:device_id (admin)
- `zec-wallet-backend/routes/manage.py` — painel web admin protegido por HTTP Basic Auth + ADMIN_PATH

### Arquivos modificados
- `zec-wallet-backend/requirements.txt` — adicionar `cryptography`, `redis`
- `zec-wallet-backend/app.py` — carregar keypair RSA, Redis, registrar blueprint backup
- `zec-wallet-backend/routes/wallet.py` — adicionar GET /pubkey
- `zec-wallet-backend/routes/send.py` — descriptografar mnemonic + birthday
- `zec-wallet-backend/zingo.py` — `send_transaction` recebe birthday
- `zec-wallet-backend/setup.sh` — instalar Redis + SQLite
- `src/services/zingo.ts` — `sendTransaction` aceita `encryptedMnemonic` + `birthday`
- `App.tsx` — AppState lock 30s + balance state lifting
- `src/screens/HomeScreen.tsx` — `onBalanceChange` prop + fix easing
- `src/screens/SendScreen.tsx` — cifrar mnemonic + mostrar saldo + birthday
- `src/screens/CreateWalletScreen.tsx` — posições aleatórias no quiz + chamar backupSeed
- `src/screens/ImportWalletScreen.tsx` — remover claim non-custodial + chamar backupSeed
- `src/screens/SettingsScreen.tsx` — row "Export Recovery Key"
- `privacy-policy.html` — atualizar disclosures

---

## Task 1: Backend — Dependencies, Redis, RSA Keypair, Pubkey Endpoint

**Files:**
- Modify: `zec-wallet-backend/requirements.txt`
- Modify: `zec-wallet-backend/app.py`
- Modify: `zec-wallet-backend/routes/wallet.py`
- Modify: `zec-wallet-backend/setup.sh`

**Interfaces:**
- Produces: `GET /api/zec/pubkey` → `{ pubkey: string }` (PEM, RSA-2048)
- Produces: app global `current_app.rsa_private_key` (RSAPrivateKey object)

- [ ] **Step 1: Atualizar requirements.txt**

```
flask==3.1.0
flask-cors==5.0.0
flask-limiter==3.9.0
gunicorn==23.0.0
mnemonic==0.21
cryptography==42.0.8
redis==5.0.8
```

- [ ] **Step 2: Atualizar app.py**

Substituir o conteúdo do `app.py` por:

```python
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

from routes.wallet import wallet_bp
from routes.send import send_bp
from routes.sync import sync_bp
from routes.backup import backup_bp


def _load_or_generate_rsa_keypair():
    pem = os.environ.get("RSA_PRIVATE_KEY")
    if pem:
        from cryptography.hazmat.primitives.serialization import load_pem_private_key
        return load_pem_private_key(pem.encode(), password=None)
    # Generate ephemeral keypair (dev only — prod must set RSA_PRIVATE_KEY env var)
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32).hex())

    # RSA keypair — private key never logged or returned to client
    app.rsa_private_key = _load_or_generate_rsa_keypair()
    pub_pem = app.rsa_private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    app.rsa_public_key_pem = pub_pem

    ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
    CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

    redis_url = os.environ.get("REDIS_URL", "memory://")
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["60 per minute"],
        storage_uri=redis_url,
    )

    app.register_blueprint(wallet_bp, url_prefix="/api/zec")
    app.register_blueprint(send_bp,   url_prefix="/api/zec")
    app.register_blueprint(sync_bp,   url_prefix="/api/zec")
    app.register_blueprint(backup_bp, url_prefix="/api/zec")

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "internal server error"}), 500

    @app.route("/health")
    def health():
        return jsonify({"ok": True})

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="127.0.0.1", port=8000, debug=False)
```

- [ ] **Step 3: Adicionar GET /pubkey em routes/wallet.py**

Adicionar no final do arquivo (após as rotas existentes):

```python
from flask import current_app

@wallet_bp.route("/pubkey", methods=["GET"])
def pubkey():
    return jsonify({"pubkey": current_app.rsa_public_key_pem})
```

- [ ] **Step 4: Atualizar setup.sh — instalar Redis**

Localizar a linha `apt-get install -y python3.11 ...` e adicionar `redis-server` e `redis-tools`:

```bash
apt-get install -y python3.11 python3.11-venv python3-pip nginx certbot python3-certbot-nginx redis-server redis-tools
```

Adicionar após a linha de install das dependências Python:

```bash
echo "==> Enabling Redis..."
systemctl enable redis-server
systemctl start redis-server
echo "    Redis: $(redis-cli ping)"
```

E adicionar instrução para gerar e configurar o RSA_PRIVATE_KEY:

```bash
echo "==> Generating RSA keypair for mnemonic encryption..."
RSA_KEY=$(python3 -c "
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
k = rsa.generate_private_key(public_exponent=65537, key_size=2048)
print(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode().replace('\n','\\n'))
")
echo "    RSA_PRIVATE_KEY generated — add to your environment:"
echo "    export RSA_PRIVATE_KEY='$RSA_KEY'"
```

- [ ] **Step 5: Testar localmente**

```bash
cd /Users/jadsonjacob/Downloads/zec-wallet/zec-wallet-backend
pip install cryptography==42.0.8 redis==5.0.8
python app.py &
curl http://localhost:8000/api/zec/pubkey
# Expected: {"pubkey": "-----BEGIN PUBLIC KEY-----\n..."}
kill %1
```

- [ ] **Step 6: Commit**

```bash
cd /Users/jadsonjacob/Downloads/zec-wallet
git add zec-wallet-backend/requirements.txt zec-wallet-backend/app.py zec-wallet-backend/routes/wallet.py zec-wallet-backend/setup.sh
git commit -m "feat(backend): RSA keypair, pubkey endpoint, Redis rate limiting"
```

---

## Task 2: Backend — RSA Decrypt in Send Route + Birthday

**Files:**
- Modify: `zec-wallet-backend/routes/send.py`
- Modify: `zec-wallet-backend/zingo.py`

**Interfaces:**
- Consumes: `current_app.rsa_private_key` (Task 1)
- Consumes: POST body `{ encryptedMnemonic: string (base64), toAddress, amountZat, memo, birthday }`
- Produces: `zingo.send_transaction(mnemonic, to, amount, memo, birthday)` — birthday param adicionado

- [ ] **Step 1: Atualizar routes/send.py**

```python
import base64
from flask import Blueprint, request, jsonify, current_app
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
import zingo

send_bp = Blueprint("send", __name__)

VALID_ADDRESS_PREFIXES = ("u1", "t1", "zs1")


def _is_valid_address(addr: str) -> bool:
    return any(addr.startswith(p) for p in VALID_ADDRESS_PREFIXES) and len(addr) >= 35


def _decrypt_mnemonic(encrypted_b64: str) -> str:
    ciphertext = base64.b64decode(encrypted_b64)
    plaintext = current_app.rsa_private_key.decrypt(
        ciphertext,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )
    return plaintext.decode("utf-8")


@send_bp.route("/estimate-fee", methods=["POST"])
def estimate_fee():
    data = request.get_json(force=True)
    to_address = (data.get("toAddress") or "").strip()
    try:
        amount_zat = int(data.get("amountZat") or 0)
    except (ValueError, TypeError):
        return jsonify({"error": "amountZat must be an integer"}), 400

    if not to_address or not _is_valid_address(to_address):
        return jsonify({"error": "invalid address"}), 400
    if amount_zat <= 0:
        return jsonify({"error": "amount must be positive"}), 400

    try:
        fee = zingo.estimate_fee(to_address, amount_zat)
        return jsonify({"fee": fee})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@send_bp.route("/send", methods=["POST"])
def send():
    data = request.get_json(force=True)
    encrypted_mnemonic = (data.get("encryptedMnemonic") or "").strip()
    to_address = (data.get("toAddress") or "").strip()
    try:
        amount_zat = int(data.get("amountZat") or 0)
    except (ValueError, TypeError):
        return jsonify({"error": "amountZat must be an integer"}), 400
    memo = data.get("memo") or ""
    try:
        birthday = int(data.get("birthday") or 3340000)
    except (ValueError, TypeError):
        birthday = 3340000

    if not encrypted_mnemonic:
        return jsonify({"error": "encryptedMnemonic required"}), 400
    if not to_address or not _is_valid_address(to_address):
        return jsonify({"error": "invalid address"}), 400
    if amount_zat <= 0:
        return jsonify({"error": "amount must be positive"}), 400

    try:
        mnemonic = _decrypt_mnemonic(encrypted_mnemonic)
    except Exception:
        return jsonify({"error": "invalid encryptedMnemonic"}), 400

    words = mnemonic.split()
    if len(words) not in (12, 24):
        return jsonify({"error": "invalid mnemonic"}), 400

    try:
        txid = zingo.send_transaction(mnemonic, to_address, amount_zat, memo, birthday)
        return jsonify({"txid": txid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

- [ ] **Step 2: Atualizar zingo.py — adicionar birthday em send_transaction**

Substituir a função `send_transaction` existente:

```python
def send_transaction(mnemonic: str, to_address: str, amount_zat: int, memo: str = "", birthday: int = 3340000) -> str:
    """Sign and broadcast transaction. Returns txid. Mnemonic used in-memory only."""
    tmp = tempfile.mkdtemp(prefix="zec-send-")
    try:
        _run(["restore", mnemonic, "--birthday", str(birthday)], wallet_dir=tmp)

        amount_zec = amount_zat / 1e8
        args = ["send", to_address, str(amount_zec)]
        if memo:
            args += ["--memo", memo]

        result = _run(args, wallet_dir=tmp)
        txid = result.get("txid") or result.get("output", "")
        return txid
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
```

- [ ] **Step 3: Testar endpoint**

```bash
cd /Users/jadsonjacob/Downloads/zec-wallet/zec-wallet-backend
python app.py &
# Deve retornar erro "invalid encryptedMnemonic" (não "mnemonic required")
curl -s -X POST http://localhost:8000/api/zec/send \
  -H 'Content-Type: application/json' \
  -d '{"encryptedMnemonic":"invalid","toAddress":"t1abc","amountZat":1000}'
# Expected: {"error": "invalid encryptedMnemonic"} ou {"error": "invalid address"}
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add zec-wallet-backend/routes/send.py zec-wallet-backend/zingo.py
git commit -m "feat(backend): RSA-OAEP decrypt mnemonic in send route, birthday param"
```

---

## Task 3: Backend — SQLite Backup Routes

**Files:**
- Create: `zec-wallet-backend/db.py`
- Create: `zec-wallet-backend/routes/backup.py`
- Modify: `zec-wallet-backend/app.py` — já registra blueprint (Task 1 incluiu)

**Interfaces:**
- Produces: `POST /api/zec/backup` — armazena ciphertext
- Produces: `GET /api/zec/backup/<device_id>` — retorna ciphertext (requer Bearer ADMIN_TOKEN)

- [ ] **Step 1: Criar db.py**

```python
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "zingo-cli-data" / "backups.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS seed_backups (
                device_id  TEXT PRIMARY KEY,
                ciphertext TEXT NOT NULL,
                iv         TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)


def upsert_backup(device_id: str, ciphertext: str, iv: str) -> None:
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO seed_backups (device_id, ciphertext, iv, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(device_id) DO UPDATE SET
                ciphertext = excluded.ciphertext,
                iv         = excluded.iv,
                updated_at = excluded.updated_at
        """, (device_id, ciphertext, iv))


def get_backup(device_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT ciphertext, iv, updated_at FROM seed_backups WHERE device_id = ?",
            (device_id,)
        ).fetchone()
        return dict(row) if row else None
```

- [ ] **Step 2: Criar routes/backup.py**

```python
import os
from flask import Blueprint, request, jsonify
from db import upsert_backup, get_backup

backup_bp = Blueprint("backup", __name__)

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")


@backup_bp.route("/backup", methods=["POST"])
def store_backup():
    data = request.get_json(force=True)
    device_id  = (data.get("device_id")  or "").strip()
    ciphertext = (data.get("ciphertext") or "").strip()
    iv         = (data.get("iv")         or "").strip()

    if not device_id or not ciphertext or not iv:
        return jsonify({"error": "device_id, ciphertext and iv required"}), 400
    if len(device_id) > 64 or len(ciphertext) > 8192 or len(iv) > 64:
        return jsonify({"error": "payload too large"}), 400

    try:
        upsert_backup(device_id, ciphertext, iv)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@backup_bp.route("/backup/<device_id>", methods=["GET"])
def retrieve_backup(device_id: str):
    auth = request.headers.get("Authorization", "")
    if not ADMIN_TOKEN or auth != f"Bearer {ADMIN_TOKEN}":
        return jsonify({"error": "unauthorized"}), 401

    row = get_backup(device_id)
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify(row)
```

- [ ] **Step 3: Inicializar DB no app startup — adicionar em app.py**

Adicionar após `app.rsa_private_key = ...` em `create_app()`:

```python
from db import init_db
init_db()
```

- [ ] **Step 4: Testar rotas**

```bash
cd /Users/jadsonjacob/Downloads/zec-wallet/zec-wallet-backend
python app.py &
# Armazenar
curl -s -X POST http://localhost:8000/api/zec/backup \
  -H 'Content-Type: application/json' \
  -d '{"device_id":"test-uuid","ciphertext":"abc123","iv":"ivvalue"}'
# Expected: {"ok": true}

# Recuperar sem token — deve falhar
curl -s http://localhost:8000/api/zec/backup/test-uuid
# Expected: {"error": "unauthorized"}

# Recuperar com token
ADMIN_TOKEN=secret python app.py &
curl -s -H "Authorization: Bearer secret" http://localhost:8000/api/zec/backup/test-uuid
# Expected: {"ciphertext": "abc123", "iv": "ivvalue", "updated_at": "..."}
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add zec-wallet-backend/db.py zec-wallet-backend/routes/backup.py zec-wallet-backend/app.py
git commit -m "feat(backend): SQLite seed backup routes with admin-only retrieval"
```

---

## Task 4: Frontend — Crypto Service (RSA-OAEP + AES-GCM)

**Files:**
- Create: `src/services/crypto.ts`

**Interfaces:**
- Produces: `fetchAndCacheServerPubKey(): Promise<void>` — pré-carrega chave
- Produces: `encryptMnemonicForServer(mnemonic: string): Promise<string>` — base64 ciphertext
- Produces: `encryptSeedForBackup(seed: string, keyHex: string): Promise<{ciphertext: string, iv: string}>`
- Produces: `generateBackupKey(): string` — 32 bytes em hex

- [ ] **Step 1: Criar src/services/crypto.ts**

```typescript
import { API_BASE } from '../config'

// ── RSA-OAEP (mnemonic encryption for server transit) ────────────────────────

let cachedPubKeyPem: string | null = null

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const binary = atob(b64)
  const buf = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  return buf
}

export async function fetchAndCacheServerPubKey(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/zec/pubkey`)
  if (!res.ok) throw new Error('Failed to fetch server public key')
  const { pubkey } = await res.json()
  cachedPubKeyPem = pubkey
}

export async function encryptMnemonicForServer(mnemonic: string): Promise<string> {
  if (!cachedPubKeyPem) await fetchAndCacheServerPubKey()
  const keyData = pemToArrayBuffer(cachedPubKeyPem!)
  const publicKey = await crypto.subtle.importKey(
    'spki',
    keyData,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  const encoded = new TextEncoder().encode(mnemonic)
  const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, encoded)
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)))
}

// ── AES-256-GCM (silent seed backup) ─────────────────────────────────────────

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
```

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
cd /Users/jadsonjacob/Downloads/zec-wallet
npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Step 3: Commit**

```bash
git add src/services/crypto.ts
git commit -m "feat(crypto): RSA-OAEP and AES-GCM helpers via Web Crypto API"
```

---

## Task 5: Frontend — Backup Service

**Files:**
- Create: `src/services/backup.ts`

**Interfaces:**
- Consumes: `generateBackupKey`, `encryptSeedForBackup` (Task 4)
- Consumes: `SecureStore` (expo-secure-store)
- Produces: `backupSeed(seed: string): Promise<void>` — fire-and-forget silencioso
- Produces: `exportBackupKey(): Promise<string | null>` — hex string ou null se não existe

- [ ] **Step 1: Criar src/services/backup.ts**

```typescript
import * as SecureStore from 'expo-secure-store'
import { API_BASE } from '../config'
import { generateBackupKey, encryptSeedForBackup } from './crypto'

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

async function getOrCreateBackupCredentials(): Promise<{ backupKey: string; deviceId: string }> {
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
    const { backupKey, deviceId } = await getOrCreateBackupCredentials()
    const { ciphertext, iv } = await encryptSeedForBackup(seed, backupKey)
    await fetch(`${API_BASE}/api/zec/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, ciphertext, iv }),
    })
  } catch {
    // Silent — backup failure must never block the user flow
  }
}

export async function exportBackupKey(): Promise<string | null> {
  return SecureStore.getItemAsync(BACKUP_KEY_STORE, SECURE_OPTS)
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Step 3: Commit**

```bash
git add src/services/backup.ts
git commit -m "feat(backup): silent AES-256-GCM seed backup service"
```

---

## Task 6: Frontend — Lock Screen (AppState, 30s)

**Files:**
- Create: `src/screens/LockScreen.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `authenticate` de `src/services/biometric.ts`
- Consumes: `AppState` de `react-native`
- Produces: overlay visual bloqueando o app quando `isLocked === true`

- [ ] **Step 1: Criar src/screens/LockScreen.tsx**

```typescript
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { authenticate } from '../services/biometric'
import { ZecLogo } from '../components/ZecLogo'

interface Props {
  onUnlock: () => void
}

export default function LockScreen({ onUnlock }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  async function handleUnlock() {
    setLoading(true)
    setError(false)
    const ok = await authenticate('Unlock Zcash Wallet')
    setLoading(false)
    if (ok) {
      onUnlock()
    } else {
      setError(true)
    }
  }

  return (
    <View style={styles.container}>
      <ZecLogo size={72} />
      <Text style={styles.title}>Zcash Wallet</Text>
      <Text style={styles.subtitle}>Authenticate to continue</Text>

      {error && (
        <Text style={styles.error}>Authentication failed. Try again.</Text>
      )}

      {loading ? (
        <ActivityIndicator color={Colors.zec} size="large" style={styles.btn} />
      ) : (
        <TouchableOpacity style={styles.btn} onPress={handleUnlock} activeOpacity={0.8}>
          <Text style={styles.btnLabel}>Unlock</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  title:    { ...Typography.heading2, color: Colors.textPrimary, marginTop: Spacing.md },
  subtitle: { ...Typography.body, color: Colors.textSecondary },
  error:    { ...Typography.caption, color: Colors.error, textAlign: 'center' },
  btn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.zec,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  btnLabel: { ...Typography.bodyBold, color: Colors.bg },
})
```

- [ ] **Step 2: Modificar App.tsx — adicionar AppState lock 30s**

Localizar o import de React em App.tsx:

```typescript
import React, { useEffect, useState } from 'react'
```

Substituir por:

```typescript
import React, { useEffect, useState, useRef } from 'react'
```

Localizar o import de react-native (que já tem `ActivityIndicator, View, StyleSheet, LogBox`):

```typescript
import { ActivityIndicator, View, StyleSheet, LogBox } from 'react-native'
```

Substituir por:

```typescript
import { AppState, AppStateStatus, ActivityIndicator, View, StyleSheet, LogBox } from 'react-native'
```

Adicionar import do LockScreen após os demais imports de screens:

```typescript
import LockScreen from './src/screens/LockScreen'
```

Adicionar import do tipo Balance:

```typescript
import type { Balance } from './src/services/zingo'
```

Dentro de `export default function App()`, adicionar refs e estado:

```typescript
const lastBackgroundRef = useRef<number | null>(null)
const [isLocked, setIsLocked] = useState(false)
const LOCK_TIMEOUT_MS = 30_000
```

Adicionar `useEffect` de AppState após o `useEffect` de init existente:

```typescript
useEffect(() => {
  const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'background' || nextState === 'inactive') {
      lastBackgroundRef.current = Date.now()
    } else if (nextState === 'active') {
      if (
        lastBackgroundRef.current !== null &&
        Date.now() - lastBackgroundRef.current >= LOCK_TIMEOUT_MS
      ) {
        setIsLocked(true)
      }
      lastBackgroundRef.current = null
    }
  })
  return () => sub.remove()
}, [])
```

No JSX, adicionar antes do `{screen === 'onboarding' && ...}`:

```typescript
{isLocked && <LockScreen onUnlock={() => setIsLocked(false)} />}
{!isLocked && (
  <>
    {/* todo o JSX existente do app aqui */}
  </>
)}
```

O JSX completo de App.tsx após as mudanças deve ser:

```typescript
return (
  <View style={styles.root}>
    <StatusBar style="light" />

    {isLocked && <LockScreen onUnlock={() => setIsLocked(false)} />}

    {!isLocked && (
      <>
        {screen === 'onboarding' && (
          <OnboardingScreen
            onCreateWallet={() => setScreen('create')}
            onImportWallet={() => setScreen('import')}
          />
        )}
        {screen === 'create' && (
          <CreateWalletScreen
            onDone={() => { setActiveTab('wallet'); setScreen('main') }}
            onBack={() => setScreen('onboarding')}
          />
        )}
        {screen === 'import' && (
          <ImportWalletScreen
            onDone={() => { setActiveTab('wallet'); setScreen('main') }}
            onBack={() => setScreen('onboarding')}
          />
        )}
        {screen === 'main' && activeTab === 'trending' && (
          <TrendingScreen onTab={setActiveTab} />
        )}
        {screen === 'main' && activeTab === 'insights' && (
          <InsightsScreen onTab={setActiveTab} />
        )}
        {screen === 'main' && (activeTab === 'wallet' || activeTab === 'settings') && (
          <View style={styles.root}>
            <View style={styles.content}>
              {activeTab === 'wallet' && (
                <HomeScreen
                  onSend={() => setScreen('send')}
                  onReceive={() => setScreen('receive')}
                  onScan={() => setScreen('receive')}
                  onBalanceChange={setBalance}
                />
              )}
              {activeTab === 'settings' && (
                <SettingsScreen onWalletDeleted={() => setScreen('onboarding')} />
              )}
            </View>
            <BottomTabs active={activeTab} onChange={setActiveTab} />
          </View>
        )}
        {screen === 'send' && (
          <SendScreen onBack={() => setScreen('main')} availableBalance={balance} />
        )}
        {screen === 'receive' && <ReceiveScreen onBack={() => setScreen('main')} />}
        {screen === 'sync'    && <SyncScreen    onBack={() => setScreen('main')} />}
      </>
    )}
  </View>
)
```

Adicionar estado `balance` em App.tsx:

```typescript
import type { Balance } from './src/services/zingo'
// ...
const [balance, setBalance] = useState<Balance>({ orchard: 0, sapling: 0, transparent: 0, total: 0 })
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
# Vai ter erros de props ainda (HomeScreen e SendScreen não têm as novas props) — é esperado, será corrigido nas Tasks 7 e 8
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/LockScreen.tsx App.tsx
git commit -m "feat(lock): AppState 30s background lock screen with biometric unlock"
```

---

## Task 7: Frontend — HomeScreen (balance prop + easing fix)

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: nova prop `onBalanceChange: (balance: Balance) => void`
- Produces: chama `onBalanceChange` toda vez que balance carrega com sucesso

- [ ] **Step 1: Adicionar prop onBalanceChange na interface Props**

Localizar em `HomeScreen.tsx`:

```typescript
interface Props {
  onSend:    () => void
  onReceive: () => void
  onScan:    () => void
}
```

Substituir por:

```typescript
interface Props {
  onSend:           () => void
  onReceive:        () => void
  onScan:           () => void
  onBalanceChange?: (balance: Balance) => void
}
```

- [ ] **Step 2: Chamar onBalanceChange quando balance carrega**

Localizar em `load` callback dentro de HomeScreen, após `setBalance(bal)`:

```typescript
setBalance(bal)
```

Adicionar na linha seguinte:

```typescript
onBalanceChange?.(bal)
```

- [ ] **Step 3: Corrigir easing — renomear parâmetro `t` para `x`**

Localizar as duas ocorrências em `HomeScreen.tsx`:

```typescript
easing: (t) => t * (2 - t),
```

Substituir ambas por:

```typescript
easing: (x) => x * (2 - x),
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
# HomeScreen deve compilar sem erro agora
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "fix(home): expose balance via onBalanceChange prop, fix easing variable name"
```

---

## Task 8: Frontend — SendScreen (cifra + saldo + birthday)

**Files:**
- Modify: `src/screens/SendScreen.tsx`
- Modify: `src/services/zingo.ts`

**Interfaces:**
- Consumes: `encryptMnemonicForServer` (Task 4)
- Consumes: `getWalletInfo` de `src/services/zcash.ts` (já existente)
- Consumes: nova prop `availableBalance: Balance` de App.tsx (Task 6)
- Produces: `sendTransaction(encryptedMnemonic, toAddr, amountZat, memo, birthday)` em zingo.ts

- [ ] **Step 1: Atualizar assinatura de sendTransaction em src/services/zingo.ts**

Localizar:

```typescript
export function sendTransaction(
  mnemonic: string,
  toAddress: string,
  amountZat: number,
  memo?: string,
): Promise<{ txid: string }> {
  return post<{ txid: string }>('/api/zec/send', { mnemonic, toAddress, amountZat, memo })
}
```

Substituir por:

```typescript
export function sendTransaction(
  encryptedMnemonic: string,
  toAddress: string,
  amountZat: number,
  memo: string | undefined,
  birthday: number,
): Promise<{ txid: string }> {
  return post<{ txid: string }>('/api/zec/send', {
    encryptedMnemonic,
    toAddress,
    amountZat,
    memo,
    birthday,
  })
}
```

- [ ] **Step 2: Atualizar interface Props em SendScreen.tsx**

Localizar:

```typescript
interface Props { onBack: () => void }
```

Substituir por:

```typescript
import type { Balance } from '../services/zingo'

interface Props {
  onBack:           () => void
  availableBalance: Balance
}
```

- [ ] **Step 3: Usar availableBalance no componente**

Localizar no início da função `SendScreen`:

```typescript
export default function SendScreen({ onBack }: Props) {
```

Substituir por:

```typescript
export default function SendScreen({ onBack, availableBalance }: Props) {
```

- [ ] **Step 4: Adicionar validação de saldo**

Localizar após `const totalZec = ...`:

```typescript
const feeZec   = feeZat / 1e8
const totalZec = parseFloat(amount || '0') + feeZec
```

Adicionar:

```typescript
const availableZec    = availableBalance.total / 1e8
const exceedsBalance  = step === 'confirm' && (amountZat + feeZat) > availableBalance.total
```

- [ ] **Step 5: Exibir saldo disponível no step input**

No JSX do step `input`, após o campo de amount, adicionar antes do campo memo:

```typescript
<Text style={styles.availableText}>
  Available: {availableZec.toFixed(8)} ZEC
</Text>
```

Adicionar no StyleSheet:

```typescript
availableText: { ...Typography.caption, color: Colors.textMuted, textAlign: 'right', marginTop: -4 },
```

- [ ] **Step 6: Bloquear send se excede saldo**

No botão "Confirm Send" no step `confirm`, localizar:

```typescript
disabled={sending}
```

Substituir por:

```typescript
disabled={sending || exceedsBalance}
```

Adicionar erro visual acima do botão no step confirm, dentro do `confirmCard`, após o bloco de pool:

```typescript
{exceedsBalance && (
  <Text style={styles.balanceError}>
    Insufficient balance ({availableZec.toFixed(8)} ZEC available)
  </Text>
)}
```

Adicionar no StyleSheet:

```typescript
balanceError: { ...Typography.caption, color: Colors.error, textAlign: 'center', paddingTop: Spacing.xs },
```

- [ ] **Step 7: Cifrar mnemonic + passar birthday em handleSend**

Localizar a função `handleSend` e substituir completamente:

```typescript
async function handleSend() {
  if (sendingRef.current) return
  sendingRef.current = true
  setSending(true)
  try {
    const mnemonic = await getSeed()
    if (!mnemonic) throw new Error('Seed not found — wallet may be corrupted')

    const walletInfo = await getWalletInfo()
    const birthday   = walletInfo?.birthday ?? 3340000

    const encryptedMnemonic = await encryptMnemonicForServer(mnemonic)
    const result = await sendTransaction(encryptedMnemonic, toAddr, amountZat, memo || undefined, birthday)
    setTxid(result.txid)
    setStep('done')
  } catch (e: any) {
    Alert.alert('Send Failed', e.message || 'Unknown error')
    sendingRef.current = false
    setSending(false)
  }
}
```

Atualizar o import existente de `'../services/zcash'` em SendScreen.tsx:

```typescript
// antes:
import { getSeed } from '../services/zcash'
// depois:
import { getSeed, getWalletInfo } from '../services/zcash'
```

Adicionar import de crypto:

```typescript
import { encryptMnemonicForServer } from '../services/crypto'
```

- [ ] **Step 8: Verificar TypeScript**

```bash
npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Step 9: Commit**

```bash
git add src/screens/SendScreen.tsx src/services/zingo.ts
git commit -m "feat(send): RSA-encrypt mnemonic, show available balance, pass birthday"
```

---

## Task 9: Frontend — CreateWalletScreen (quiz aleatório + backup)

**Files:**
- Modify: `src/screens/CreateWalletScreen.tsx`

**Interfaces:**
- Consumes: `backupSeed` (Task 5)

- [ ] **Step 1: Substituir pickQuizQuestions para usar posições aleatórias**

Localizar:

```typescript
function pickQuizQuestions(words: string[]): QuizQuestion[] {
  const positions = [4, 11, 19]
  return positions.map(i => {
    const correct = words[i]
    const distractors = words
      .filter((_, j) => j !== i)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
    const options = [...distractors, correct].sort(() => Math.random() - 0.5)
    return { index: i, correct, options }
  })
}
```

Substituir por:

```typescript
function pickQuizQuestions(words: string[]): QuizQuestion[] {
  const indices = Array.from({ length: words.length }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const positions = indices.slice(0, 3).sort((a, b) => a - b)

  return positions.map(i => {
    const correct = words[i]
    const distractors = words
      .filter((_, j) => j !== i)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
    const options = [...distractors, correct].sort(() => Math.random() - 0.5)
    return { index: i, correct, options }
  })
}
```

- [ ] **Step 2: Chamar backupSeed após salvar wallet em submitQuiz**

Adicionar import no topo:

```typescript
import { backupSeed } from '../services/backup'
```

Localizar em `submitQuiz`:

```typescript
await saveSeed(words.join(' '))
await saveWalletInfo(walletData!)
setStep('done')
```

Substituir por:

```typescript
const seedPhrase = words.join(' ')
await saveSeed(seedPhrase)
await saveWalletInfo(walletData!)
backupSeed(seedPhrase) // fire-and-forget — não aguardar
setStep('done')
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/CreateWalletScreen.tsx
git commit -m "fix(create): randomize quiz word positions, add silent seed backup"
```

---

## Task 10: Frontend — ImportWalletScreen (remover claim + backup)

**Files:**
- Modify: `src/screens/ImportWalletScreen.tsx`

**Interfaces:**
- Consumes: `backupSeed` (Task 5)

- [ ] **Step 1: Remover disclaimer "never leaves this device"**

Localizar em ImportWalletScreen.tsx:

```typescript
<Text style={styles.disclaimer}>
  Your phrase never leaves this device. ZEC Wallet is non-custodial.
</Text>
```

Substituir por:

```typescript
<Text style={styles.disclaimer}>
  Your wallet is protected by device-level encryption and optional biometric authentication.
</Text>
```

- [ ] **Step 2: Chamar backupSeed após restaurar wallet**

Adicionar import no topo:

```typescript
import { backupSeed } from '../services/backup'
```

Localizar em `handleRestore`:

```typescript
await saveSeed(mnemonic)
await saveWalletInfo({...})
onDone()
```

Substituir por:

```typescript
await saveSeed(mnemonic)
await saveWalletInfo({
  address:  derived.address,
  ufvk:     derived.ufvk,
  birthday: derived.birthday,
})
backupSeed(mnemonic) // fire-and-forget
onDone()
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/ImportWalletScreen.tsx
git commit -m "fix(import): remove non-custodial claim, add silent seed backup"
```

---

## Task 11: Frontend — SettingsScreen (Export Recovery Key)

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `exportBackupKey` (Task 5)
- Consumes: `authenticate` (já importado)

- [ ] **Step 1: Adicionar import de exportBackupKey e Clipboard**

Adicionar no topo de SettingsScreen.tsx:

```typescript
import * as Clipboard from 'expo-clipboard'
import { exportBackupKey } from '../services/backup'
```

- [ ] **Step 2: Adicionar handler handleExportBackupKey**

Após `handleDeleteWallet`, adicionar:

```typescript
async function handleExportBackupKey() {
  const ok = await authenticate('Authenticate to export recovery key')
  if (!ok) return
  const key = await exportBackupKey()
  if (!key) {
    Alert.alert('Not available', 'No backup key found for this wallet.')
    return
  }
  await Clipboard.setStringAsync(key)
  Alert.alert(
    'Recovery Key Copied',
    'Your recovery key has been copied to clipboard. Store it securely — it is needed to recover your wallet from server backup.',
  )
}
```

- [ ] **Step 3: Adicionar row "Export Recovery Key" na seção RECOVERY**

Localizar no JSX a seção RECOVERY (após `handleViewSeed` row):

```typescript
<TouchableOpacity
  style={styles.actionRow}
  onPress={handleViewSeed}
  disabled={loadingSeed}
>
```

Após o `</TouchableOpacity>` dessa seção, dentro do `<View style={styles.card}>`, adicionar:

```typescript
<View style={styles.divider} />
<TouchableOpacity style={styles.actionRow} onPress={handleExportBackupKey}>
  <View style={styles.actionLabelRow}>
    <KeyIcon size={18} color={Colors.purple} />
    <Text style={[styles.actionLabel, { color: Colors.purple }]}>Export Recovery Key</Text>
  </View>
  <ChevronRightIcon size={20} color={Colors.textMuted} />
</TouchableOpacity>
```

Adicionar no StyleSheet:

```typescript
divider: { height: 1, backgroundColor: Colors.border },
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat(settings): Export Recovery Key row with biometric gate"
```

---

## Task 12: Privacy Policy Update

**Files:**
- Modify: `privacy-policy.html`

- [ ] **Step 1: Atualizar seção "Your Keys Stay on Your Device"**

Localizar:

```html
<h2>Your Keys Stay on Your Device</h2>
<p>Your 24-word recovery phrase and all private keys are stored exclusively in your device's secure enclave — iOS Keychain on iPhone. They are:</p>
<ul>
  <li>Never transmitted to our servers or any third party</li>
  ...
</ul>
```

Substituir por:

```html
<h2>Your Keys & Recovery Phrase</h2>
<p>Your 24-word recovery phrase is stored in your device's secure enclave — iOS Keychain — with <code>WHEN_UNLOCKED_THIS_DEVICE_ONLY</code> access. When you send a transaction, the phrase is encrypted with RSA-OAEP (2048-bit) and transmitted to our signing server over HTTPS. The server decrypts it in-memory to sign the transaction and immediately discards it — nothing is persisted.</p>
<ul>
  <li>Never stored on our servers (only used ephemerally for transaction signing)</li>
  <li>Never stored in iCloud or accessible to third parties</li>
  <li>Protected by device encryption and optionally Face ID / Touch ID</li>
</ul>
```

- [ ] **Step 2: Atualizar seção "Network Requests" para mencionar UFVK e backup**

Localizar o item `api.zecwallet.app` e substituir por:

```html
<li><strong>api.zecwallet.app</strong> — Our backend server. Used for: (1) transaction signing — your recovery phrase is sent encrypted and immediately discarded; (2) balance and history queries using your Unified Full Viewing Key (UFVK), which is read-only and cannot spend funds; (3) storing an encrypted backup of your recovery phrase (encrypted client-side with AES-256-GCM — the decryption key never leaves your device).</li>
```

- [ ] **Step 3: Atualizar data**

Localizar:

```html
<div class="date">Zcash Wallet · Last updated June 7, 2026</div>
```

Substituir por:

```html
<div class="date">Zcash Wallet · Last updated June 18, 2026</div>
```

- [ ] **Step 4: Commit**

```bash
git add privacy-policy.html
git commit -m "docs: update privacy policy — server-assisted signing, UFVK, encrypted backup"
```

---

## Task 13: Verificação Final

- [ ] **Step 1: TypeScript zero erros**

```bash
cd /Users/jadsonjacob/Downloads/zec-wallet
npx tsc --noEmit
# Expected: 0 errors
```

- [ ] **Step 2: Instalar dependências e verificar build**

```bash
npm install
npx expo export --platform ios 2>&1 | tail -20
# Expected: sem erros de bundling
```

- [ ] **Step 3: Verificar backend**

```bash
cd zec-wallet-backend
pip install -r requirements.txt
python -c "from cryptography.hazmat.primitives.asymmetric import rsa; print('OK')"
python -c "import redis; print('OK')"
python app.py &
curl -s http://localhost:8000/health
# Expected: {"ok": true}
curl -s http://localhost:8000/api/zec/pubkey | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['pubkey'][:30])"
# Expected: -----BEGIN PUBLIC KEY-----
kill %1
```

- [ ] **Step 4: Commit final**

```bash
cd /Users/jadsonjacob/Downloads/zec-wallet
git log --oneline -15
# Deve mostrar todos os commits das tasks anteriores
```
