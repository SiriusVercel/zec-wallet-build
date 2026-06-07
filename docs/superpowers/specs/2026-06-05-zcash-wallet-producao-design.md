# Zcash Wallet — Spec de Produção

**Data:** 2026-06-05  
**Status:** Aprovado para implementação  
**Plataforma alvo:** iOS (Apple App Store)  
**Nome do app:** Zcash Wallet  
**Logo:** /Users/jadsonjacob/Documents/zcash.png (oficial ZCash — círculo dourado com Z)

---

## 1. Visão Geral

Carteira ZCash mobile não-custodial para iOS. Seed e chaves privadas ficam apenas no device (SecureStore). Backend Flask + zingo-cli no Shijiru atua como proxy stateless para a rede ZCash — nunca armazena dados do usuário. Sem login, sem conta, sem JWT.

---

## 2. Backend — Flask + zingo-cli (Shijiru: 38.133.213.215)

### Estrutura

```
zec-wallet-backend/
├── app.py                  # Flask app, CORS, error handlers
├── zingo.py                # Wrapper subprocess para zingo-cli
├── routes/
│   ├── wallet.py           # /api/zec/generate, /derive, /balance, /transactions
│   ├── send.py             # /api/zec/send, /estimate-fee
│   └── sync.py             # /api/zec/sync-status, /sync-start
├── requirements.txt        # flask, flask-cors, gunicorn
├── zingo-cli               # binário Linux x86_64 (download GitHub releases)
├── zingo-cli-data/         # dados de sync (cache de blocos)
└── nginx.conf              # reverse proxy: api.zecwallet.app → localhost:8000
```

### Endpoints

| Método | Rota | Input | Output |
|--------|------|-------|--------|
| POST | `/api/zec/generate` | — | `{mnemonic, address, ufvk, birthday}` |
| POST | `/api/zec/derive` | `{mnemonic, birthday?}` | `{address, ufvk, birthday}` |
| POST | `/api/zec/balance` | `{ufvk}` | `{orchard, sapling, transparent, total}` em ZAT |
| POST | `/api/zec/transactions` | `{ufvk, limit?}` | `[{txid, amount, memo, block, pool, direction}]` |
| POST | `/api/zec/estimate-fee` | `{toAddress, amountZat}` | `{fee}` em ZAT |
| POST | `/api/zec/send` | `{mnemonic, toAddress, amountZat, memo?}` | `{txid}` |
| GET  | `/api/zec/sync-status` | — | `{synced, total, percent, eta}` |
| POST | `/api/zec/sync-start` | — | `{ok}` |

**Segurança:**
- HTTPS via nginx + Let's Encrypt (Certbot já instalado no Shijiru)
- Mnemonic passado apenas no `/send` — usado em memória para assinar, nunca persistido
- CORS restrito ao bundle ID do app
- Rate limiting: 60 req/min por IP (Flask-Limiter)

### zingo-cli

- Download do binário pré-compilado: `https://github.com/zingolabs/zingo-cli/releases`
- Lightwalletd: `na.zec.rocks:443` (oficial, TLS)
- Modo: `zingo-cli --lightwalletd-url na.zec.rocks:443 --data-dir ./zingo-cli-data`

### Deploy

```bash
# systemd service: zec-wallet-backend.service
# nginx: proxy_pass http://localhost:8000
# DNS: api.zecwallet.app → 38.133.213.215
```

---

## 3. App — Features a Implementar

### 3.1 Dependências

**Adicionar:**
```json
"react-native-qrcode-svg": "^6.3.2",
"react-native-svg": "^15.x",
"victory-native": "^41.x"
```

**Remover (não usadas):**
```json
"@react-navigation/native",
"@react-navigation/stack",
"react-native-gesture-handler",
"react-native-reanimated"
```

### 3.2 Configuração

**app.json:**
```json
{
  "name": "Zcash Wallet",
  "slug": "zcash-wallet",
  "version": "1.0.0",
  "icon": "./assets/icon.png",         // logo oficial ZCash
  "splash": { "backgroundColor": "#1A1209" },
  "ios": {
    "bundleIdentifier": "com.zecwallet.app",
    "buildNumber": "1",
    "supportsTablet": false,
    "infoPlist": {
      "NSFaceIDUsageDescription": "Use Face ID to unlock your Zcash Wallet",
      "NSCameraUsageDescription": "Scan QR codes for Zcash addresses"
    }
  }
}
```

**src/config.ts (novo):**
```typescript
export const API_BASE = __DEV__
  ? 'http://localhost:8000'
  : 'https://api.zecwallet.app'

export const LIGHTWALLETD = 'na.zec.rocks:443'
export const KRAKEN_PAIR  = 'XECZUSD'
```

### 3.3 Telas — Correções e Implementações

#### SplashScreen
- Verificar wallet existente via SecureStore
- Fallback: se backend offline → modo offline (só leitura local)

#### CreateWalletScreen
- Remover `MOCK_WORDS_24`
- Chamar `POST /api/zec/generate` → exibir 24 palavras reais
- Step 3 (verify): quiz com 3 palavras aleatórias — usuário seleciona a palavra correta dentre 4 opções. Não avança sem acertar todas.
- Salvar seed + ufvk + address + birthday no SecureStore

#### ImportWalletScreen
- Validação BIP39 palavra a palavra (highlight vermelho/verde em tempo real)
- Chamar `POST /api/zec/derive` com mnemonic importado
- Suporte a UFVK (view-only wallet)

#### HomeScreen
- Pull-to-refresh no saldo
- Skeleton loader durante fetch
- Saldo em ZEC (primário) + USD (secundário, via Kraken)
- Contador de sync (blocos sincronizados)
- Estado de erro quando backend offline

#### SendScreen
- Fee real via `POST /api/zec/estimate-fee`
- Validação: saldo insuficiente (amount + fee > balance)
- Disable do botão após primeiro tap (previne double-send)
- Step de confirmação com fee real exibida
- Chamar `POST /api/zec/send`

#### ReceiveScreen
- QR Code real via `react-native-qrcode-svg`
- Share nativo iOS (expo-sharing)
- Toggle: Shielded (Orchard) / Transparent

#### SettingsScreen
- Biometric lock: ao ativar, requer FaceID/TouchID para abrir app
- Ver seed: protegido por FaceID antes de exibir
- Delete wallet: confirmação em 2 passos

#### TrendingScreen
- Preço ZEC/USD via Kraken API: `GET https://api.kraken.com/0/public/OHLC?pair=XECZUSD&interval=60`
- Gráfico de linha com `victory-native` (SVG)
- Períodos: 24H / 7D / 30D / 1Y
- Atualização a cada 60s

#### InsightsScreen
- Dados reais de `POST /api/zec/transactions`
- Total recebido, enviado, net flow em ZEC e USD
- Bar chart com `victory-native`

#### SyncScreen
- Polling a cada 5s com timeout de 30s
- Retry com exponential backoff
- Exibe: blocos sincronizados / total / percentual / ETA

### 3.4 Ícones e Assets

- `assets/icon.png`: logo ZCash oficial (1024×1024, fundo dourado, já em `/Users/jadsonjacob/Documents/zcash.png`)
- `assets/splash.png`: logo centralizado, fundo `#1A1209` (marrom escuro quente do tema)
- `assets/adaptive-icon.png`: versão para Android (mesma logo)
- Ícones de tab bar: SVG inline no tema (wallet, trending, insights, settings)

---

## 4. Fluxos End-to-End (QA)

| # | Fluxo | Passos |
|---|-------|--------|
| 1 | Criar wallet | Splash → Onboarding → Create → backup 24 palavras → quiz 3 palavras → Home com saldo |
| 2 | Importar wallet | Onboarding → Import → digitar seed → sync → Home com saldo real |
| 3 | Enviar ZEC | Home → Send → endereço + valor → fee real → confirmação → TXID → saldo atualizado |
| 4 | Receber ZEC | Home → Receive → QR gerado → copiar endereço → share |
| 5 | Biometric lock | Settings → ativar FaceID → fechar app → reabrir → FaceID solicitado |
| 6 | Ver seed | Settings → "View Recovery Phrase" → FaceID → 24 palavras exibidas |
| 7 | Delete wallet | Settings → Delete → confirmação → Onboarding |
| 8 | Offline | Sem internet → app abre, exibe último saldo cacheado, envia desabilitado |

---

## 5. Apple App Store

### Metadata
| Campo | Valor |
|-------|-------|
| Nome | Zcash Wallet |
| Subtítulo | Private & Shielded ZCash |
| Categoria | Finance |
| Age Rating | 17+ |
| Privacy Policy URL | https://zecwallet.app/privacy |
| Support URL | https://zecwallet.app/support |

### Screenshots obrigatórias (geradas via simulador)
- iPhone 6.7" (iPhone 15 Pro Max): 1290×2796px
- iPhone 6.1" (iPhone 15): 1179×2556px
- iPad 12.9" (se `supportsTablet: true`): 2048×2732px

### EAS
```json
// eas.json
{
  "build": {
    "production": {
      "distribution": "store",
      "ios": { "autoIncrement": true }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "<apple-id>",
        "ascAppId": "<app-store-connect-id>",
        "appleTeamId": "<team-id>"
      }
    }
  }
}
```

### Privacy Policy (HTML simples)
Hospedada em `https://zecwallet.app/privacy` no Shijiru. Cobre: nenhum dado coletado, chaves ficam no device, logs de erro anônimos opcionais.

---

## 6. Ordem de Implementação

1. **Backend:** instalar zingo-cli no Shijiru, criar Flask app, configurar nginx + HTTPS, testar todos os endpoints com curl
2. **Assets:** copiar logo ZCash para `assets/`, gerar icon/splash/adaptive-icon
3. **App — config:** atualizar app.json, criar config.ts, limpar dependências não usadas
4. **App — core:** CreateWallet (geração real + quiz), ImportWallet (validação BIP39)
5. **App — home:** HomeScreen (saldo real + pull-to-refresh + skeleton)
6. **App — transações:** SendScreen (fee real, disable, send), ReceiveScreen (QR real, share)
7. **App — segurança:** biometric lock no app open + view seed
8. **App — preço:** TrendingScreen (Kraken API + gráfico Victory)
9. **App — insights:** InsightsScreen (dados reais de txs)
10. **App — sync:** SyncScreen (polling com backoff)
11. **QA:** exercitar os 8 fluxos end-to-end, capturar screenshots
12. **App Store:** privacy policy, metadata, EAS build + submit

---

## 7. O que NÃO está no escopo

- Android (foco total em iOS para App Store)
- Autenticação de usuário / contas / backup na nuvem
- Multi-wallet (uma wallet por device)
- Hardware wallet (Ledger/Trezor)
- DeFi / swap interno
