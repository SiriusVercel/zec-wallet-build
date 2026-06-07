# Zcash Wallet Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar backend Flask + zingo-cli no Shijiru (38.133.213.215) expondo API REST stateless para o app Zcash Wallet.

**Architecture:** Flask app em Python 3.11 recebe requests do app mobile e delega operações ZCash ao binário zingo-cli via subprocess. Mnemonic é usado em memória apenas durante `/send` e descartado imediatamente. Nginx faz reverse proxy com HTTPS via Let's Encrypt.

**Tech Stack:** Python 3.11, Flask 3.x, Flask-Limiter, Gunicorn, zingo-cli (Linux x86_64), Nginx, Certbot, systemd

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `app.py` | Flask factory, CORS, error handlers, rate limiting |
| `zingo.py` | Wrapper subprocess para zingo-cli — toda I/O com o binário |
| `routes/wallet.py` | Endpoints: `/generate`, `/derive`, `/balance`, `/transactions` |
| `routes/send.py` | Endpoints: `/send`, `/estimate-fee` |
| `routes/sync.py` | Endpoints: `/sync-status`, `/sync-start` |
| `requirements.txt` | Dependências Python |
| `nginx.conf` | Reverse proxy HTTPS para localhost:8000 |
| `zec-wallet-backend.service` | Systemd unit para Gunicorn |
| `setup.sh` | Script de instalação completo no Shijiru |

---

## Task 1: Criar estrutura do projeto backend

**Files:**
- Create: `zec-wallet-backend/app.py`
- Create: `zec-wallet-backend/requirements.txt`
- Create: `zec-wallet-backend/routes/__init__.py`
- Create: `zec-wallet-backend/zingo.py`

- [ ] **Step 1: Criar diretório e estrutura**

```bash
mkdir -p zec-wallet-backend/routes
mkdir -p zec-wallet-backend/zingo-cli-data
touch zec-wallet-backend/routes/__init__.py
```

- [ ] **Step 2: Criar requirements.txt**

```
# zec-wallet-backend/requirements.txt
flask==3.1.0
flask-cors==5.0.0
flask-limiter==3.9.0
gunicorn==23.0.0
mnemonic==0.21
```

- [ ] **Step 3: Criar app.py**

```python
# zec-wallet-backend/app.py
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from routes.wallet import wallet_bp
from routes.send import send_bp
from routes.sync import sync_bp


def create_app():
    app = Flask(__name__)

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["60 per minute"],
        storage_uri="memory://",
    )

    app.register_blueprint(wallet_bp, url_prefix="/api/zec")
    app.register_blueprint(send_bp, url_prefix="/api/zec")
    app.register_blueprint(sync_bp, url_prefix="/api/zec")

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

- [ ] **Step 4: Commit**

```bash
cd zec-wallet-backend
git init
git add .
git commit -m "feat: backend project scaffold"
```

---

## Task 2: zingo-cli wrapper

**Files:**
- Create: `zec-wallet-backend/zingo.py`

- [ ] **Step 1: Baixar zingo-cli binary**

```bash
# No Shijiru (Linux x86_64):
cd zec-wallet-backend
ZINGO_VER="0.1.1"
curl -L "https://github.com/zingolabs/zingo-cli/releases/download/v${ZINGO_VER}/zingo-cli-v${ZINGO_VER}-x86_64-unknown-linux-gnu.tar.gz" \
  -o zingo-cli.tar.gz
tar -xzf zingo-cli.tar.gz
chmod +x zingo-cli
rm zingo-cli.tar.gz
# Verificar:
./zingo-cli --version
```

- [ ] **Step 2: Criar zingo.py**

```python
# zec-wallet-backend/zingo.py
import subprocess
import json
import os
import tempfile
import shutil
from pathlib import Path

ZINGO_BIN = Path(__file__).parent / "zingo-cli"
LIGHTWALLETD = "na.zec.rocks:443"
DATA_DIR = Path(__file__).parent / "zingo-cli-data"

DATA_DIR.mkdir(exist_ok=True)


def _run(args: list[str], wallet_dir: str | None = None) -> dict:
    """Run zingo-cli with given args. Returns parsed JSON output."""
    cmd = [
        str(ZINGO_BIN),
        "--lightwalletd-url", LIGHTWALLETD,
        "--data-dir", wallet_dir or str(DATA_DIR),
        "--json",
    ] + args

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
    )

    if result.returncode != 0:
        raise RuntimeError(f"zingo-cli error: {result.stderr.strip()}")

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        # Some commands return plain text
        return {"output": result.stdout.strip()}


def generate_wallet() -> dict:
    """Generate new wallet. Returns mnemonic, address, ufvk, birthday."""
    tmp = tempfile.mkdtemp(prefix="zec-gen-")
    try:
        result = _run(["new"], wallet_dir=tmp)
        seed_result = _run(["getseed"], wallet_dir=tmp)
        addr_result = _run(["getaddress", "unified"], wallet_dir=tmp)
        ufvk_result = _run(["exportufvk"], wallet_dir=tmp)
        info_result = _run(["info"], wallet_dir=tmp)

        return {
            "mnemonic": seed_result.get("seed_phrase") or seed_result.get("output", ""),
            "address": addr_result.get("address") or addr_result.get("output", ""),
            "ufvk": ufvk_result.get("ufvk") or ufvk_result.get("output", ""),
            "birthday": info_result.get("wallet_birthday", 3340000),
        }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def derive_from_mnemonic(mnemonic: str, birthday: int = 3340000) -> dict:
    """Restore wallet from mnemonic. Returns address, ufvk, birthday."""
    tmp = tempfile.mkdtemp(prefix="zec-restore-")
    try:
        _run(["restore", mnemonic, "--birthday", str(birthday)], wallet_dir=tmp)
        addr_result = _run(["getaddress", "unified"], wallet_dir=tmp)
        ufvk_result = _run(["exportufvk"], wallet_dir=tmp)

        return {
            "address": addr_result.get("address") or addr_result.get("output", ""),
            "ufvk": ufvk_result.get("ufvk") or ufvk_result.get("output", ""),
            "birthday": birthday,
        }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def get_balance(ufvk: str) -> dict:
    """Fetch balance for a UFVK. Returns orchard, sapling, transparent in ZAT."""
    tmp = tempfile.mkdtemp(prefix="zec-bal-")
    try:
        _run(["import-ufvk", ufvk], wallet_dir=tmp)
        result = _run(["balance"], wallet_dir=tmp)

        return {
            "orchard": result.get("orchard_balance", 0),
            "sapling": result.get("sapling_balance", 0),
            "transparent": result.get("transparent_balance", 0),
            "total": result.get("total_balance", 0),
        }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def get_transactions(ufvk: str, limit: int = 50) -> list:
    """Fetch transaction history for a UFVK."""
    tmp = tempfile.mkdtemp(prefix="zec-txs-")
    try:
        _run(["import-ufvk", ufvk], wallet_dir=tmp)
        result = _run(["list"], wallet_dir=tmp)

        txs = result if isinstance(result, list) else result.get("transactions", [])
        return txs[:limit]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def estimate_fee(to_address: str, amount_zat: int) -> int:
    """Estimate fee in ZAT. ZCash standard fee is 10000 ZAT (0.00001 ZEC)."""
    # ZCash ZIP-317 standard fee
    return 10000


def send_transaction(mnemonic: str, to_address: str, amount_zat: int, memo: str = "") -> str:
    """Sign and broadcast transaction. Returns txid. Mnemonic used in-memory only."""
    tmp = tempfile.mkdtemp(prefix="zec-send-")
    try:
        birthday = 3340000
        _run(["restore", mnemonic, "--birthday", str(birthday)], wallet_dir=tmp)

        amount_zec = amount_zat / 1e8
        args = ["send", to_address, str(amount_zec)]
        if memo:
            args += ["--memo", memo]

        result = _run(args, wallet_dir=tmp)
        txid = result.get("txid") or result.get("output", "")
        return txid
    finally:
        # Mnemonic never persists after this block
        shutil.rmtree(tmp, ignore_errors=True)


def get_sync_status() -> dict:
    """Get current sync status from the shared data dir."""
    try:
        result = _run(["syncstatus"], wallet_dir=str(DATA_DIR))
        return {
            "synced": result.get("synced_blocks", 0),
            "total": result.get("total_blocks", 0),
            "percent": result.get("sync_percent", 0.0),
            "eta": result.get("eta_seconds", 0),
        }
    except Exception:
        return {"synced": 0, "total": 0, "percent": 0.0, "eta": 0}


def start_sync() -> bool:
    """Trigger background sync."""
    try:
        _run(["sync"], wallet_dir=str(DATA_DIR))
        return True
    except Exception:
        return False
```

- [ ] **Step 3: Testar localmente**

```bash
# Deve retornar versão do zingo-cli
python3 -c "from zingo import ZINGO_BIN; import subprocess; r = subprocess.run([str(ZINGO_BIN), '--version'], capture_output=True, text=True); print(r.stdout)"
```

Expected: versão do zingo-cli impressa (ex: `zingo-cli 0.1.1`)

- [ ] **Step 4: Commit**

```bash
git add zingo.py
git commit -m "feat: zingo-cli subprocess wrapper"
```

---

## Task 3: Rotas de wallet

**Files:**
- Create: `zec-wallet-backend/routes/wallet.py`

- [ ] **Step 1: Criar routes/wallet.py**

```python
# zec-wallet-backend/routes/wallet.py
from flask import Blueprint, request, jsonify
import zingo

wallet_bp = Blueprint("wallet", __name__)


@wallet_bp.route("/generate", methods=["POST"])
def generate():
    try:
        result = zingo.generate_wallet()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@wallet_bp.route("/derive", methods=["POST"])
def derive():
    data = request.get_json(force=True)
    mnemonic = data.get("mnemonic", "").strip()
    birthday = int(data.get("birthday", 3340000))

    if not mnemonic:
        return jsonify({"error": "mnemonic required"}), 400

    words = mnemonic.split()
    if len(words) not in (12, 24):
        return jsonify({"error": "mnemonic must be 12 or 24 words"}), 400

    try:
        result = zingo.derive_from_mnemonic(mnemonic, birthday)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@wallet_bp.route("/balance", methods=["POST"])
def balance():
    data = request.get_json(force=True)
    ufvk = data.get("ufvk", "").strip()

    if not ufvk:
        return jsonify({"error": "ufvk required"}), 400

    try:
        result = zingo.get_balance(ufvk)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@wallet_bp.route("/transactions", methods=["POST"])
def transactions():
    data = request.get_json(force=True)
    ufvk = data.get("ufvk", "").strip()
    limit = int(data.get("limit", 50))

    if not ufvk:
        return jsonify({"error": "ufvk required"}), 400

    try:
        result = zingo.get_transactions(ufvk, limit)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

- [ ] **Step 2: Testar endpoints com curl (após iniciar Flask)**

```bash
# Em um terminal: python3 app.py
# Em outro:

# Health
curl http://localhost:8000/health
# Expected: {"ok": true}

# Generate wallet
curl -X POST http://localhost:8000/api/zec/generate
# Expected: {"mnemonic": "word1 word2 ...", "address": "u1...", "ufvk": "...", "birthday": 3340000}

# Derive from mnemonic (usar palavras geradas acima)
curl -X POST http://localhost:8000/api/zec/derive \
  -H "Content-Type: application/json" \
  -d '{"mnemonic": "word1 word2 ... word24"}'
# Expected: {"address": "u1...", "ufvk": "...", "birthday": 3340000}
```

- [ ] **Step 3: Commit**

```bash
git add routes/wallet.py
git commit -m "feat: wallet routes (generate, derive, balance, transactions)"
```

---

## Task 4: Rotas de envio e fee

**Files:**
- Create: `zec-wallet-backend/routes/send.py`

- [ ] **Step 1: Criar routes/send.py**

```python
# zec-wallet-backend/routes/send.py
from flask import Blueprint, request, jsonify
import zingo

send_bp = Blueprint("send", __name__)

VALID_ADDRESS_PREFIXES = ("u1", "t1", "zs1")


def _is_valid_address(addr: str) -> bool:
    return any(addr.startswith(p) for p in VALID_ADDRESS_PREFIXES) and len(addr) >= 35


@send_bp.route("/estimate-fee", methods=["POST"])
def estimate_fee():
    data = request.get_json(force=True)
    to_address = data.get("toAddress", "").strip()
    amount_zat = int(data.get("amountZat", 0))

    if not to_address or not _is_valid_address(to_address):
        return jsonify({"error": "invalid address"}), 400
    if amount_zat <= 0:
        return jsonify({"error": "amount must be positive"}), 400

    fee = zingo.estimate_fee(to_address, amount_zat)
    return jsonify({"fee": fee})


@send_bp.route("/send", methods=["POST"])
def send():
    data = request.get_json(force=True)
    mnemonic = data.get("mnemonic", "").strip()
    to_address = data.get("toAddress", "").strip()
    amount_zat = int(data.get("amountZat", 0))
    memo = data.get("memo", "")

    if not mnemonic:
        return jsonify({"error": "mnemonic required"}), 400
    if not to_address or not _is_valid_address(to_address):
        return jsonify({"error": "invalid address"}), 400
    if amount_zat <= 0:
        return jsonify({"error": "amount must be positive"}), 400

    words = mnemonic.split()
    if len(words) not in (12, 24):
        return jsonify({"error": "invalid mnemonic"}), 400

    try:
        txid = zingo.send_transaction(mnemonic, to_address, amount_zat, memo)
        return jsonify({"txid": txid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

- [ ] **Step 2: Testar estimate-fee**

```bash
curl -X POST http://localhost:8000/api/zec/estimate-fee \
  -H "Content-Type: application/json" \
  -d '{"toAddress": "u1exampleaddress000000000000000000000000000", "amountZat": 100000}'
# Expected: {"fee": 10000}
```

- [ ] **Step 3: Commit**

```bash
git add routes/send.py
git commit -m "feat: send and estimate-fee routes"
```

---

## Task 5: Rotas de sync

**Files:**
- Create: `zec-wallet-backend/routes/sync.py`

- [ ] **Step 1: Criar routes/sync.py**

```python
# zec-wallet-backend/routes/sync.py
from flask import Blueprint, jsonify
import threading
import zingo

sync_bp = Blueprint("sync", __name__)
_sync_lock = threading.Lock()
_syncing = False


@sync_bp.route("/sync-status", methods=["GET"])
def sync_status():
    status = zingo.get_sync_status()
    return jsonify(status)


@sync_bp.route("/sync-start", methods=["POST"])
def sync_start():
    global _syncing

    if _syncing:
        return jsonify({"ok": True, "message": "already syncing"})

    def _do_sync():
        global _syncing
        _syncing = True
        try:
            zingo.start_sync()
        finally:
            _syncing = False

    with _sync_lock:
        thread = threading.Thread(target=_do_sync, daemon=True)
        thread.start()

    return jsonify({"ok": True})
```

- [ ] **Step 2: Testar**

```bash
curl http://localhost:8000/api/zec/sync-status
# Expected: {"synced": 0, "total": 0, "percent": 0.0, "eta": 0}

curl -X POST http://localhost:8000/api/zec/sync-start
# Expected: {"ok": true}
```

- [ ] **Step 3: Commit**

```bash
git add routes/sync.py
git commit -m "feat: sync status and sync-start routes"
```

---

## Task 6: Deploy no Shijiru

**Files:**
- Create: `zec-wallet-backend/nginx.conf`
- Create: `zec-wallet-backend/zec-wallet-backend.service`
- Create: `zec-wallet-backend/setup.sh`

- [ ] **Step 1: Criar nginx.conf**

```nginx
# zec-wallet-backend/nginx.conf
server {
    listen 80;
    server_name api.zecwallet.app;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.zecwallet.app;

    ssl_certificate /etc/letsencrypt/live/api.zecwallet.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.zecwallet.app/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }
}
```

- [ ] **Step 2: Criar systemd service**

```ini
# zec-wallet-backend/zec-wallet-backend.service
[Unit]
Description=Zcash Wallet Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/zec-wallet-backend
ExecStart=/opt/zec-wallet-backend/venv/bin/gunicorn \
    --workers 2 \
    --bind 127.0.0.1:8000 \
    --timeout 120 \
    "app:create_app()"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Criar setup.sh**

```bash
#!/bin/bash
# zec-wallet-backend/setup.sh
# Executar no Shijiru como root

set -e

APP_DIR="/opt/zec-wallet-backend"
DOMAIN="api.zecwallet.app"

echo "==> Instalando dependências do sistema..."
apt-get update -qq
apt-get install -y python3.11 python3.11-venv python3-pip nginx certbot python3-certbot-nginx

echo "==> Copiando arquivos..."
mkdir -p $APP_DIR
cp -r . $APP_DIR/
cd $APP_DIR

echo "==> Criando virtualenv..."
python3.11 -m venv venv
./venv/bin/pip install -r requirements.txt

echo "==> Instalando nginx config..."
cp nginx.conf /etc/nginx/sites-available/zec-wallet-backend
ln -sf /etc/nginx/sites-available/zec-wallet-backend /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "==> Obtendo certificado Let's Encrypt..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@zecwallet.app

echo "==> Instalando e iniciando serviço..."
cp zec-wallet-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable zec-wallet-backend
systemctl start zec-wallet-backend

echo "==> Done! Testando health endpoint..."
sleep 3
curl -s https://$DOMAIN/health
```

- [ ] **Step 4: Executar deploy**

```bash
# Na máquina local:
scp -r zec-wallet-backend/ root@38.133.213.215:/tmp/
ssh root@38.133.213.215 "cd /tmp/zec-wallet-backend && chmod +x setup.sh && ./setup.sh"
```

Expected: `{"ok": true}` ao final

- [ ] **Step 5: Verificar todos os endpoints em produção**

```bash
BASE="https://api.zecwallet.app"

curl $BASE/health
# {"ok": true}

curl -X POST $BASE/api/zec/generate
# {"mnemonic": "...", "address": "u1...", "ufvk": "...", "birthday": 3340000}

curl $BASE/api/zec/sync-status
# {"synced": 0, "total": ..., "percent": 0.0, "eta": 0}
```

- [ ] **Step 6: Commit final do backend**

```bash
git add .
git commit -m "feat: nginx, systemd, deploy script — backend production ready"
```

---

## Checklist de Verificação Final do Backend

- [ ] `GET /health` retorna `{"ok": true}`
- [ ] `POST /api/zec/generate` retorna mnemonic de 24 palavras reais
- [ ] `POST /api/zec/derive` com seed válida retorna endereço `u1...`
- [ ] `POST /api/zec/estimate-fee` retorna `{"fee": 10000}`
- [ ] `GET /api/zec/sync-status` retorna objeto com percentual
- [ ] HTTPS ativo em `api.zecwallet.app`
- [ ] Rate limiting: mais de 60 req/min retorna 429
- [ ] Serviço reinicia automaticamente: `systemctl restart zec-wallet-backend`
