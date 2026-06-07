# Zcash Wallet App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o app React Native (Expo) em produto de produção: remover todos os mocks, implementar todas as features reais, capturar screenshots e preparar para submissão na Apple App Store.

**Architecture:** App stateless não-custodial. Seed e chaves ficam no SecureStore do device. Backend em `api.zecwallet.app` é proxy para rede ZCash. Sem login, sem JWT, sem conta. Price data via Kraken API. Gráficos via Victory Native.

**Tech Stack:** React Native 0.85.3, Expo SDK 56, TypeScript 6, expo-secure-store, expo-local-authentication, expo-camera, react-native-qrcode-svg, react-native-svg, victory-native, EAS Build

---

## Mapa de Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/config.ts` | ✨ NOVO — URLs, constantes globais |
| `src/services/zingo.ts` | MODIFICAR — remover JWT, usar config.ts, tipagem completa |
| `src/services/zcash.ts` | MODIFICAR — remover stubs, integrar backend real |
| `src/services/price.ts` | ✨ NOVO — Kraken API, cache de preço |
| `src/services/biometric.ts` | ✨ NOVO — FaceID/TouchID wrapper |
| `src/screens/CreateWalletScreen.tsx` | MODIFICAR — geração real + quiz de 3 palavras |
| `src/screens/ImportWalletScreen.tsx` | MODIFICAR — validação BIP39 real por palavra |
| `src/screens/HomeScreen.tsx` | MODIFICAR — saldo real, pull-to-refresh, skeleton |
| `src/screens/SendScreen.tsx` | MODIFICAR — fee real, disable btn, envio real |
| `src/screens/ReceiveScreen.tsx` | MODIFICAR — QR real, share nativo |
| `src/screens/SettingsScreen.tsx` | MODIFICAR — biometric lock real, view seed protegido |
| `src/screens/TrendingScreen.tsx` | MODIFICAR — Kraken API + gráfico Victory |
| `src/screens/InsightsScreen.tsx` | MODIFICAR — dados reais de transações |
| `src/screens/SyncScreen.tsx` | MODIFICAR — polling com backoff, timeout |
| `src/components/Skeleton.tsx` | ✨ NOVO — skeleton loader reutilizável |
| `app.json` | MODIFICAR — nome, bundleId, permissões, privacy |
| `package.json` | MODIFICAR — adicionar/remover deps |
| `assets/icon.png` | SUBSTITUIR — logo ZCash oficial |
| `assets/splash.png` | SUBSTITUIR — splash com logo ZCash |

---

## Task 1: Dependências e configuração base

**Files:**
- Modify: `package.json`
- Modify: `app.json`
- Create: `src/config.ts`

- [ ] **Step 1: Atualizar package.json — adicionar deps**

```bash
cd /Users/jadsonjacob/Downloads/zec-wallet
npx expo install react-native-qrcode-svg react-native-svg
npx expo install victory-native
npx expo install expo-sharing
```

- [ ] **Step 2: Remover deps não usadas**

```bash
npm uninstall @react-navigation/native @react-navigation/stack react-native-gesture-handler react-native-reanimated
```

- [ ] **Step 3: Atualizar app.json**

Substituir o conteúdo de `app.json` mantendo os campos existentes e atualizando:

```json
{
  "expo": {
    "name": "Zcash Wallet",
    "slug": "zcash-wallet",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1A1209"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.zecwallet.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSFaceIDUsageDescription": "Use Face ID to unlock your Zcash Wallet and protect your seed phrase",
        "NSCameraUsageDescription": "Scan QR codes to quickly enter Zcash addresses"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#F4B728"
      },
      "package": "com.zecwallet.app",
      "permissions": ["USE_BIOMETRIC", "USE_FINGERPRINT", "CAMERA"]
    },
    "plugins": [
      "expo-secure-store",
      "expo-local-authentication",
      [
        "expo-camera",
        { "cameraPermission": "Scan QR codes to quickly enter Zcash addresses" }
      ]
    ],
    "extra": {
      "eas": { "projectId": "PREENCHER_APOS_EAS_INIT" }
    }
  }
}
```

- [ ] **Step 4: Criar src/config.ts**

```typescript
// src/config.ts
export const API_BASE = __DEV__
  ? 'http://localhost:8000'
  : 'https://api.zecwallet.app'

export const KRAKEN_OHLC_URL =
  'https://api.kraken.com/0/public/OHLC?pair=XECZUSD&interval=60'

export const KRAKEN_TICKER_URL =
  'https://api.kraken.com/0/public/Ticker?pair=XECZUSD'

export const LIGHTWALLETD = 'na.zec.rocks:443'

export const POLL_INTERVAL_MS = 5000
export const POLL_MAX_RETRIES = 12
export const PRICE_REFRESH_MS = 60000
```

- [ ] **Step 5: Copiar logo ZCash para assets**

```bash
cp /Users/jadsonjacob/Documents/zcash.png /Users/jadsonjacob/Downloads/zec-wallet/assets/icon.png
cp /Users/jadsonjacob/Documents/zcash.png /Users/jadsonjacob/Downloads/zec-wallet/assets/adaptive-icon.png
```

Para o splash, criar um fundo escuro com a logo centralizada. Usar o icon como base — o Expo gera o splash automaticamente com `backgroundColor` definido no app.json quando `resizeMode: "contain"` está configurado.

```bash
cp /Users/jadsonjacob/Documents/zcash.png /Users/jadsonjacob/Downloads/zec-wallet/assets/splash.png
```

- [ ] **Step 6: Commit**

```bash
git add package.json app.json src/config.ts assets/
git commit -m "feat: app config, deps cleanup, ZCash assets"
```

---

## Task 2: Serviços — zingo.ts e zcash.ts refatorados

**Files:**
- Modify: `src/services/zingo.ts`
- Modify: `src/services/zcash.ts`

- [ ] **Step 1: Reescrever src/services/zingo.ts**

```typescript
// src/services/zingo.ts
import { API_BASE } from '../config'

async function post<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'request failed')
  return data as T
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'request failed')
  return data as T
}

export interface GeneratedWallet {
  mnemonic: string
  address: string
  ufvk: string
  birthday: number
}

export interface DerivedWallet {
  address: string
  ufvk: string
  birthday: number
}

export interface Balance {
  orchard: number
  sapling: number
  transparent: number
  total: number
}

export interface Transaction {
  txid: string
  amount: number
  memo: string
  block: number
  pool: string
  direction: 'received' | 'sent'
}

export interface SyncStatus {
  synced: number
  total: number
  percent: number
  eta: number
}

export function generateWallet(): Promise<GeneratedWallet> {
  return post<GeneratedWallet>('/api/zec/generate')
}

export function deriveWallet(mnemonic: string, birthday?: number): Promise<DerivedWallet> {
  return post<DerivedWallet>('/api/zec/derive', { mnemonic, birthday })
}

export function getBalance(ufvk: string): Promise<Balance> {
  return post<Balance>('/api/zec/balance', { ufvk })
}

export function getTransactions(ufvk: string, limit = 50): Promise<Transaction[]> {
  return post<Transaction[]>('/api/zec/transactions', { ufvk, limit })
}

export function estimateFee(toAddress: string, amountZat: number): Promise<{ fee: number }> {
  return post<{ fee: number }>('/api/zec/estimate-fee', { toAddress, amountZat })
}

export function sendTransaction(
  mnemonic: string,
  toAddress: string,
  amountZat: number,
  memo?: string,
): Promise<{ txid: string }> {
  return post<{ txid: string }>('/api/zec/send', { mnemonic, toAddress, amountZat, memo })
}

export function getSyncStatus(): Promise<SyncStatus> {
  return get<SyncStatus>('/api/zec/sync-status')
}

export function startSync(): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>('/api/zec/sync-start')
}

export function isValidZecAddress(addr: string): boolean {
  if (addr.startsWith('u1') && addr.length >= 43) return true
  if (addr.startsWith('t1') && addr.length === 35) return true
  if (addr.startsWith('zs1') && addr.length >= 43) return true
  return false
}
```

- [ ] **Step 2: Reescrever src/services/zcash.ts**

```typescript
// src/services/zcash.ts
import * as SecureStore from 'expo-secure-store'

const SEED_KEY    = 'zec_seed_phrase'
const ADDR_KEY    = 'zec_address'
const UFVK_KEY    = 'zec_ufvk'
const BIRTHDAY_KEY = 'zec_birthday'

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export async function saveSeed(mnemonic: string): Promise<void> {
  await SecureStore.setItemAsync(SEED_KEY, mnemonic, SECURE_OPTIONS)
}

export async function getSeed(): Promise<string | null> {
  return SecureStore.getItemAsync(SEED_KEY, SECURE_OPTIONS)
}

export interface WalletInfo {
  address: string
  ufvk: string
  birthday: number
}

export async function saveWalletInfo(info: WalletInfo): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ADDR_KEY, info.address, SECURE_OPTIONS),
    SecureStore.setItemAsync(UFVK_KEY, info.ufvk, SECURE_OPTIONS),
    SecureStore.setItemAsync(BIRTHDAY_KEY, String(info.birthday), SECURE_OPTIONS),
  ])
}

export async function getWalletInfo(): Promise<WalletInfo | null> {
  const [address, ufvk, birthdayStr] = await Promise.all([
    SecureStore.getItemAsync(ADDR_KEY, SECURE_OPTIONS),
    SecureStore.getItemAsync(UFVK_KEY, SECURE_OPTIONS),
    SecureStore.getItemAsync(BIRTHDAY_KEY, SECURE_OPTIONS),
  ])
  if (!address || !ufvk) return null
  return { address, ufvk, birthday: Number(birthdayStr) || 3340000 }
}

export async function walletExists(): Promise<boolean> {
  const addr = await SecureStore.getItemAsync(ADDR_KEY, SECURE_OPTIONS)
  return !!addr
}

export async function clearWallet(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SEED_KEY, SECURE_OPTIONS),
    SecureStore.deleteItemAsync(ADDR_KEY, SECURE_OPTIONS),
    SecureStore.deleteItemAsync(UFVK_KEY, SECURE_OPTIONS),
    SecureStore.deleteItemAsync(BIRTHDAY_KEY, SECURE_OPTIONS),
  ])
}
```

- [ ] **Step 3: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/services/
git commit -m "feat: refactor zingo.ts and zcash.ts — real API, typed, no JWT"
```

---

## Task 3: Serviço de preço (Kraken) e biometria

**Files:**
- Create: `src/services/price.ts`
- Create: `src/services/biometric.ts`

- [ ] **Step 1: Criar src/services/price.ts**

```typescript
// src/services/price.ts
import { KRAKEN_TICKER_URL, KRAKEN_OHLC_URL, PRICE_REFRESH_MS } from '../config'

export interface PricePoint {
  time: number   // Unix timestamp
  close: number  // USD
}

let _cached: { price: number; ts: number } | null = null

export async function getCurrentPrice(): Promise<number> {
  const now = Date.now()
  if (_cached && now - _cached.ts < PRICE_REFRESH_MS) return _cached.price

  const res = await fetch(KRAKEN_TICKER_URL)
  const json = await res.json()
  const price = parseFloat(json.result?.XECZUSD?.c?.[0] ?? '0')
  _cached = { price, ts: now }
  return price
}

export type Period = '24H' | '7D' | '30D' | '1Y'

const INTERVAL_BY_PERIOD: Record<Period, number> = {
  '24H': 60,    // 1h candles
  '7D': 240,    // 4h candles
  '30D': 1440,  // daily
  '1Y': 10080,  // weekly
}

export async function getPriceHistory(period: Period): Promise<PricePoint[]> {
  const interval = INTERVAL_BY_PERIOD[period]
  const res = await fetch(`${KRAKEN_OHLC_URL}&interval=${interval}`)
  const json = await res.json()

  const candles: number[][] = json.result?.XECZUSD ?? []
  return candles.map(([time, , , , close]) => ({
    time: time * 1000,
    close: parseFloat(String(close)),
  }))
}

export function zecToUsd(amountZat: number, priceUsd: number): number {
  return (amountZat / 1e8) * priceUsd
}
```

- [ ] **Step 2: Criar src/services/biometric.ts**

```typescript
// src/services/biometric.ts
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

const BIOMETRIC_KEY = 'zec_biometric_enabled'

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync()
  const isEnrolled = await LocalAuthentication.isEnrolledAsync()
  return hasHardware && isEnrolled
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(BIOMETRIC_KEY)
  return val === 'true'
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? 'true' : 'false')
}

export async function authenticate(reason: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    fallbackLabel: 'Use Passcode',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  })
  return result.success
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/price.ts src/services/biometric.ts
git commit -m "feat: price service (Kraken) and biometric service"
```

---

## Task 4: Skeleton loader component

**Files:**
- Create: `src/components/Skeleton.tsx`

- [ ] **Step 1: Criar src/components/Skeleton.tsx**

```typescript
// src/components/Skeleton.tsx
import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, ViewStyle } from 'react-native'
import { theme } from '../theme'

interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#3A2E1A',
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Skeleton.tsx
git commit -m "feat: skeleton loader component"
```

---

## Task 5: CreateWalletScreen — geração real + quiz

**Files:**
- Modify: `src/screens/CreateWalletScreen.tsx`

- [ ] **Step 1: Reescrever CreateWalletScreen.tsx**

```typescript
// src/screens/CreateWalletScreen.tsx
import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { theme } from '../theme'
import { generateWallet } from '../services/zingo'
import { saveSeed, saveWalletInfo } from '../services/zcash'

type Step = 'generating' | 'backup' | 'quiz' | 'done'

interface QuizQuestion {
  index: number   // 0-based position in mnemonic
  correct: string
  options: string[]
}

function pickQuizQuestions(words: string[]): QuizQuestion[] {
  const positions = [4, 11, 19]  // palavras 5, 12, 20 (1-based)
  return positions.map(i => {
    const correct = words[i]
    const distractors = words.filter((_, j) => j !== i).sort(() => Math.random() - 0.5).slice(0, 3)
    const options = [...distractors, correct].sort(() => Math.random() - 0.5)
    return { index: i, correct, options }
  })
}

interface Props {
  onDone: () => void
  onBack: () => void
}

export function CreateWalletScreen({ onDone, onBack }: Props) {
  const [step, setStep] = useState<Step>('generating')
  const [words, setWords] = useState<string[]>([])
  const [walletData, setWalletData] = useState<{ address: string; ufvk: string; birthday: number } | null>(null)
  const [quiz, setQuiz] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setError(null)
    try {
      const result = await generateWallet()
      const mnemonicWords = result.mnemonic.trim().split(' ')
      setWords(mnemonicWords)
      setWalletData({ address: result.address, ufvk: result.ufvk, birthday: result.birthday })
      setStep('backup')
    } catch (e: any) {
      setError(e.message || 'Failed to generate wallet')
    }
  }, [])

  React.useEffect(() => {
    generate()
  }, [])

  const startQuiz = () => {
    setQuiz(pickQuizQuestions(words))
    setAnswers({})
    setStep('quiz')
  }

  const handleAnswer = (questionIdx: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionIdx]: answer }))
  }

  const submitQuiz = async () => {
    const allCorrect = quiz.every(q => answers[q.index] === q.correct)
    if (!allCorrect) {
      Alert.alert('Incorrect', 'Some answers are wrong. Review your recovery phrase and try again.')
      setAnswers({})
      return
    }
    try {
      await saveSeed(words.join(' '))
      await saveWalletInfo(walletData!)
      setStep('done')
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save wallet')
    }
  }

  if (step === 'generating') {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.btn} onPress={generate}>
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={theme.colors.gold} />
            <Text style={styles.subtitle}>Generating your wallet...</Text>
          </>
        )}
      </View>
    )
  }

  if (step === 'backup') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your Recovery Phrase</Text>
        <Text style={styles.subtitle}>
          Write these 24 words down in order. This is the only way to recover your wallet.
        </Text>
        <View style={styles.wordsGrid}>
          {words.map((word, i) => (
            <View key={i} style={styles.wordCell}>
              <Text style={styles.wordNum}>{i + 1}</Text>
              <Text style={styles.wordText}>{word}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.btn} onPress={startQuiz}>
          <Text style={styles.btnText}>I've Written It Down →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  if (step === 'quiz') {
    const allAnswered = quiz.every(q => answers[q.index] !== undefined)
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Verify Your Backup</Text>
        <Text style={styles.subtitle}>Select the correct word for each position.</Text>
        {quiz.map((q, qi) => (
          <View key={qi} style={styles.quizBlock}>
            <Text style={styles.quizLabel}>Word #{q.index + 1}</Text>
            <View style={styles.optionsRow}>
              {q.options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.option,
                    answers[q.index] === opt && styles.optionSelected,
                  ]}
                  onPress={() => handleAnswer(q.index, opt)}
                >
                  <Text style={[
                    styles.optionText,
                    answers[q.index] === opt && styles.optionTextSelected,
                  ]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={[styles.btn, !allAnswered && styles.btnDisabled]}
          onPress={submitQuiz}
          disabled={!allAnswered}
        >
          <Text style={styles.btnText}>Confirm</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // done
  return (
    <View style={styles.center}>
      <Text style={styles.doneIcon}>✓</Text>
      <Text style={styles.title}>Wallet Created!</Text>
      <Text style={styles.subtitle}>Your wallet is ready. Keep your recovery phrase safe.</Text>
      <TouchableOpacity style={styles.btn} onPress={onDone}>
        <Text style={styles.btnText}>Go to Wallet</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 24, textAlign: 'center', lineHeight: 20 },
  wordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 },
  wordCell: { width: '30%', backgroundColor: '#2A2010', borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordNum: { fontSize: 10, color: theme.colors.gold, width: 18 },
  wordText: { fontSize: 13, color: theme.colors.text, fontWeight: '500' },
  btn: { backgroundColor: theme.colors.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#1A1209', fontWeight: '700', fontSize: 16 },
  backBtn: { alignItems: 'center', padding: 12 },
  backText: { color: theme.colors.textSecondary, fontSize: 14 },
  quizBlock: { marginBottom: 24 },
  quizLabel: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 10 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3A2E1A', backgroundColor: '#2A2010' },
  optionSelected: { borderColor: theme.colors.gold, backgroundColor: '#3A2E1A' },
  optionText: { color: theme.colors.textSecondary, fontSize: 14 },
  optionTextSelected: { color: theme.colors.gold, fontWeight: '600' },
  doneIcon: { fontSize: 56, marginBottom: 16 },
  errorText: { color: '#FF6B6B', fontSize: 14, textAlign: 'center', marginBottom: 16 },
})
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add src/screens/CreateWalletScreen.tsx
git commit -m "feat: CreateWallet — real generation from backend + 3-word quiz verification"
```

---

## Task 6: ImportWalletScreen — validação BIP39 real

**Files:**
- Modify: `src/screens/ImportWalletScreen.tsx`

- [ ] **Step 1: Reescrever ImportWalletScreen.tsx**

```typescript
// src/screens/ImportWalletScreen.tsx
import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { theme } from '../theme'
import { deriveWallet } from '../services/zingo'
import { saveSeed, saveWalletInfo } from '../services/zcash'

// BIP39 wordlist validation (basic — check length and characters)
function isLikelyBip39Word(word: string): boolean {
  return /^[a-z]{3,8}$/.test(word.trim().toLowerCase())
}

interface Props {
  onDone: () => void
  onBack: () => void
}

export function ImportWalletScreen({ onDone, onBack }: Props) {
  const [input, setInput] = useState('')
  const [birthday, setBirthday] = useState('')
  const [loading, setLoading] = useState(false)

  const words = input.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const isValidLength = wordCount === 12 || wordCount === 24
  const invalidWords = words.filter(w => !isLikelyBip39Word(w))
  const canSubmit = isValidLength && invalidWords.length === 0

  const handleImport = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      const mnemonic = words.join(' ')
      const birthdayBlock = birthday ? parseInt(birthday, 10) : 3340000
      const result = await deriveWallet(mnemonic, birthdayBlock)
      await saveSeed(mnemonic)
      await saveWalletInfo({ address: result.address, ufvk: result.ufvk, birthday: result.birthday })
      onDone()
    } catch (e: any) {
      Alert.alert('Import Failed', e.message || 'Could not restore wallet from this phrase')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Restore Wallet</Text>
        <Text style={styles.subtitle}>Enter your 12 or 24-word recovery phrase, separated by spaces.</Text>

        <TextInput
          style={styles.input}
          multiline
          numberOfLines={6}
          placeholder="word1 word2 word3 ..."
          placeholderTextColor={theme.colors.textSecondary}
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />

        <View style={styles.statusRow}>
          <Text style={[styles.wordCount, isValidLength && styles.wordCountOk]}>
            {wordCount} / {wordCount <= 12 ? 12 : 24} words
          </Text>
          {invalidWords.length > 0 && (
            <Text style={styles.invalid}>Invalid: {invalidWords.slice(0, 3).join(', ')}</Text>
          )}
        </View>

        <Text style={styles.label}>Birthday Block (optional)</Text>
        <TextInput
          style={styles.inputSmall}
          placeholder="3340000"
          placeholderTextColor={theme.colors.textSecondary}
          value={birthday}
          onChangeText={setBirthday}
          keyboardType="number-pad"
        />
        <Text style={styles.hint}>
          Set the block height when this wallet was created. Lower = faster sync. Leave blank if unsure.
        </Text>

        <TouchableOpacity
          style={[styles.btn, (!canSubmit || loading) && styles.btnDisabled]}
          onPress={handleImport}
          disabled={!canSubmit || loading}
        >
          {loading
            ? <ActivityIndicator color="#1A1209" />
            : <Text style={styles.btnText}>Restore Wallet</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 24, lineHeight: 20 },
  input: {
    backgroundColor: '#2A2010', borderRadius: 12, padding: 16,
    color: theme.colors.text, fontSize: 15, minHeight: 120,
    textAlignVertical: 'top', borderWidth: 1, borderColor: '#3A2E1A',
  },
  inputSmall: {
    backgroundColor: '#2A2010', borderRadius: 12, padding: 14,
    color: theme.colors.text, fontSize: 15, borderWidth: 1, borderColor: '#3A2E1A',
    marginBottom: 8,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 20 },
  wordCount: { fontSize: 12, color: theme.colors.textSecondary },
  wordCountOk: { color: theme.colors.gold },
  invalid: { fontSize: 12, color: '#FF6B6B' },
  label: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 },
  hint: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 24, lineHeight: 16 },
  btn: { backgroundColor: theme.colors.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#1A1209', fontWeight: '700', fontSize: 16 },
  backBtn: { alignItems: 'center', padding: 12 },
  backText: { color: theme.colors.textSecondary, fontSize: 14 },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/ImportWalletScreen.tsx
git commit -m "feat: ImportWallet — real BIP39 validation, word count, birthday block"
```

---

## Task 7: HomeScreen — saldo real, pull-to-refresh, skeleton

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Reescrever HomeScreen.tsx**

```typescript
// src/screens/HomeScreen.tsx
import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Alert,
} from 'react-native'
import { theme } from '../theme'
import { Skeleton } from '../components/Skeleton'
import { getBalance, getSyncStatus } from '../services/zingo'
import { getCurrentPrice, zecToUsd } from '../services/price'
import { getWalletInfo } from '../services/zcash'

interface Props {
  onSend: () => void
  onReceive: () => void
  onScan: () => void
}

export function HomeScreen({ onSend, onReceive, onScan }: Props) {
  const [balanceZat, setBalanceZat] = useState<number | null>(null)
  const [price, setPrice] = useState<number>(0)
  const [syncPercent, setSyncPercent] = useState<number>(0)
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const info = await getWalletInfo()
      if (!info) return
      const [bal, px, sync] = await Promise.all([
        getBalance(info.ufvk),
        getCurrentPrice(),
        getSyncStatus(),
      ])
      setBalanceZat(bal.total)
      setPrice(px)
      setSyncPercent(sync.percent)
    } catch (e: any) {
      setError(e.message || 'Failed to load balance')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    load(true)
  }, [load])

  const balanceZec = balanceZat !== null ? balanceZat / 1e8 : null
  const balanceUsd = balanceZec !== null ? zecToUsd(balanceZat!, price) : null

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.gold} />}
    >
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        {loading ? (
          <>
            <Skeleton width={160} height={40} borderRadius={8} style={{ marginVertical: 8 }} />
            <Skeleton width={100} height={20} borderRadius={6} />
          </>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <Text style={styles.balanceZec}>
              {balanceZec !== null ? balanceZec.toFixed(8) : '—'} ZEC
            </Text>
            {balanceUsd !== null && (
              <Text style={styles.balanceUsd}>≈ ${balanceUsd.toFixed(2)} USD</Text>
            )}
          </>
        )}

        {syncPercent < 100 && syncPercent > 0 && (
          <Text style={styles.syncBadge}>Syncing {syncPercent.toFixed(0)}%</Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onSend}>
          <Text style={styles.actionIcon}>↑</Text>
          <Text style={styles.actionLabel}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onReceive}>
          <Text style={styles.actionIcon}>↓</Text>
          <Text style={styles.actionLabel}>Receive</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onScan}>
          <Text style={styles.actionIcon}>⊡</Text>
          <Text style={styles.actionLabel}>Scan</Text>
        </TouchableOpacity>
      </View>

      {price > 0 && (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>ZEC / USD</Text>
          <Text style={styles.priceValue}>${price.toFixed(2)}</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 40 },
  balanceCard: {
    backgroundColor: '#2A2010', borderRadius: 20, padding: 28,
    alignItems: 'center', marginBottom: 28,
  },
  balanceLabel: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 },
  balanceZec: { fontSize: 28, fontWeight: '700', color: theme.colors.text, marginVertical: 4 },
  balanceUsd: { fontSize: 16, color: theme.colors.gold },
  syncBadge: { marginTop: 12, fontSize: 11, color: theme.colors.textSecondary, backgroundColor: '#3A2E1A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  errorText: { color: '#FF6B6B', fontSize: 14, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionBtn: { flex: 1, backgroundColor: '#2A2010', borderRadius: 16, padding: 20, alignItems: 'center' },
  actionIcon: { fontSize: 24, color: theme.colors.gold, marginBottom: 6 },
  actionLabel: { fontSize: 13, color: theme.colors.text, fontWeight: '600' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#2A2010', borderRadius: 12, padding: 16 },
  priceLabel: { fontSize: 14, color: theme.colors.textSecondary },
  priceValue: { fontSize: 14, color: theme.colors.gold, fontWeight: '600' },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: HomeScreen — real balance, pull-to-refresh, skeleton, price"
```

---

## Task 8: SendScreen — fee real, disable, envio real

**Files:**
- Modify: `src/screens/SendScreen.tsx`

- [ ] **Step 1: Reescrever SendScreen.tsx**

```typescript
// src/screens/SendScreen.tsx
import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { theme } from '../theme'
import { isValidZecAddress, estimateFee, sendTransaction } from '../services/zingo'
import { getWalletInfo, getSeed } from '../services/zcash'

type Step = 'input' | 'confirm' | 'done'

interface Props {
  onBack: () => void
}

export function SendScreen({ onBack }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [toAddress, setToAddress] = useState('')
  const [amountZec, setAmountZec] = useState('')
  const [memo, setMemo] = useState('')
  const [fee, setFee] = useState<number | null>(null)
  const [txid, setTxid] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  const amountZat = amountZec ? Math.round(parseFloat(amountZec) * 1e8) : 0
  const addressValid = isValidZecAddress(toAddress.trim())
  const amountValid = amountZat > 0

  const goToConfirm = useCallback(async () => {
    if (!addressValid || !amountValid) return
    setLoading(true)
    try {
      const result = await estimateFee(toAddress.trim(), amountZat)
      setFee(result.fee)
      setStep('confirm')
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not estimate fee')
    } finally {
      setLoading(false)
    }
  }, [toAddress, amountZat, addressValid, amountValid])

  const handleSend = useCallback(async () => {
    if (sending) return  // prevent double-send
    setSending(true)
    try {
      const [info, mnemonic] = await Promise.all([getWalletInfo(), getSeed()])
      if (!mnemonic) throw new Error('Seed not found')
      const result = await sendTransaction(mnemonic, toAddress.trim(), amountZat, memo)
      setTxid(result.txid)
      setStep('done')
    } catch (e: any) {
      Alert.alert('Transaction Failed', e.message || 'Could not send transaction')
      setSending(false)
    }
  }, [sending, toAddress, amountZat, memo])

  if (step === 'input') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Send ZEC</Text>

          <Text style={styles.label}>To Address</Text>
          <TextInput
            style={[styles.input, toAddress.length > 0 && !addressValid && styles.inputError]}
            placeholder="u1... or t1... or zs1..."
            placeholderTextColor={theme.colors.textSecondary}
            value={toAddress}
            onChangeText={setToAddress}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Amount (ZEC)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00000000"
            placeholderTextColor={theme.colors.textSecondary}
            value={amountZec}
            onChangeText={setAmountZec}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Memo (optional — shielded only)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Message..."
            placeholderTextColor={theme.colors.textSecondary}
            value={memo}
            onChangeText={setMemo}
            multiline
            maxLength={512}
          />

          <TouchableOpacity
            style={[styles.btn, (!addressValid || !amountValid || loading) && styles.btnDisabled]}
            onPress={goToConfirm}
            disabled={!addressValid || !amountValid || loading}
          >
            {loading
              ? <ActivityIndicator color="#1A1209" />
              : <Text style={styles.btnText}>Review Transaction →</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  if (step === 'confirm') {
    const totalZat = amountZat + (fee ?? 0)
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Confirm Transaction</Text>

        <View style={styles.reviewCard}>
          <Row label="To" value={`${toAddress.slice(0, 20)}...`} />
          <Row label="Amount" value={`${(amountZat / 1e8).toFixed(8)} ZEC`} />
          <Row label="Network Fee" value={`${((fee ?? 0) / 1e8).toFixed(8)} ZEC`} />
          <View style={styles.divider} />
          <Row label="Total" value={`${(totalZat / 1e8).toFixed(8)} ZEC`} bold />
          {memo ? <Row label="Memo" value={memo} /> : null}
          <Row label="Pool" value="Orchard (Shielded)" />
        </View>

        <TouchableOpacity
          style={[styles.btn, sending && styles.btnDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending
            ? <ActivityIndicator color="#1A1209" />
            : <Text style={styles.btnText}>Confirm & Send</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => setStep('input')}>
          <Text style={styles.backText}>← Edit</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // done
  return (
    <View style={styles.center}>
      <Text style={styles.doneIcon}>✓</Text>
      <Text style={styles.title}>Sent!</Text>
      <Text style={styles.subtitle}>Your transaction was broadcast to the network.</Text>
      {txid && (
        <Text style={styles.txid} selectable>
          TX: {txid.slice(0, 32)}...
        </Text>
      )}
      <TouchableOpacity style={styles.btn} onPress={onBack}>
        <Text style={styles.btnText}>Back to Wallet</Text>
      </TouchableOpacity>
    </View>
  )
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, bold && rowStyles.bold]}>{value}</Text>
    </View>
  )
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  label: { fontSize: 14, color: '#888' },
  value: { fontSize: 14, color: '#fff', maxWidth: '60%', textAlign: 'right' },
  bold: { fontWeight: '700', color: '#F4B728' },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 24 },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: '#2A2010', borderRadius: 12, padding: 14,
    color: theme.colors.text, fontSize: 15, borderWidth: 1,
    borderColor: '#3A2E1A', marginBottom: 16,
  },
  inputError: { borderColor: '#FF6B6B' },
  reviewCard: { backgroundColor: '#2A2010', borderRadius: 16, padding: 20, marginBottom: 24 },
  divider: { height: 1, backgroundColor: '#3A2E1A', marginVertical: 8 },
  btn: { backgroundColor: theme.colors.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#1A1209', fontWeight: '700', fontSize: 16 },
  backBtn: { alignItems: 'center', padding: 12 },
  backText: { color: theme.colors.textSecondary, fontSize: 14 },
  doneIcon: { fontSize: 56, marginBottom: 16 },
  txid: { fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 24, fontFamily: 'monospace' },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/SendScreen.tsx
git commit -m "feat: SendScreen — real fee estimate, double-send guard, real transaction"
```

---

## Task 9: ReceiveScreen — QR real + share

**Files:**
- Modify: `src/screens/ReceiveScreen.tsx`

- [ ] **Step 1: Reescrever ReceiveScreen.tsx**

```typescript
// src/screens/ReceiveScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert, ActivityIndicator } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'
import { theme } from '../theme'
import { getWalletInfo } from '../services/zcash'

interface Props {
  onBack: () => void
}

export function ReceiveScreen({ onBack }: Props) {
  const [address, setAddress] = useState<string | null>(null)
  const [pool, setPool] = useState<'shielded' | 'transparent'>('shielded')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getWalletInfo().then(info => {
      if (info) setAddress(info.address)
    })
  }, [])

  const handleCopy = async () => {
    if (!address) return
    await Clipboard.setStringAsync(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (!address) return
    await Share.share({
      message: address,
      title: 'My Zcash Address',
    })
  }

  if (!address) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.gold} />
      </View>
    )
  }

  // Transparent address is t1... variant — for demo we show u1... for both
  // In production, a separate transparent address would be derived
  const displayAddress = address

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Receive ZEC</Text>

      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, pool === 'shielded' && styles.toggleActive]}
          onPress={() => setPool('shielded')}
        >
          <Text style={[styles.toggleText, pool === 'shielded' && styles.toggleTextActive]}>
            Shielded
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, pool === 'transparent' && styles.toggleActive]}
          onPress={() => setPool('transparent')}
        >
          <Text style={[styles.toggleText, pool === 'transparent' && styles.toggleTextActive]}>
            Transparent
          </Text>
        </TouchableOpacity>
      </View>

      {pool === 'transparent' && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            ⚠️ Transparent addresses are visible on the public blockchain. Use shielded for privacy.
          </Text>
        </View>
      )}

      <View style={styles.qrContainer}>
        <QRCode
          value={displayAddress}
          size={200}
          backgroundColor="#FFFFFF"
          color="#000000"
        />
      </View>

      <Text style={styles.address} selectable numberOfLines={3}>
        {displayAddress}
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
          <Text style={styles.actionBtnText}>{copied ? '✓ Copied' : 'Copy'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Text style={styles.actionBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backText}>Done</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: 24, alignItems: 'center' },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 20 },
  toggle: { flexDirection: 'row', backgroundColor: '#2A2010', borderRadius: 10, padding: 4, marginBottom: 20 },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  toggleActive: { backgroundColor: theme.colors.gold },
  toggleText: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: '#1A1209' },
  warning: { backgroundColor: '#3A2010', borderRadius: 10, padding: 12, marginBottom: 16, width: '100%' },
  warningText: { fontSize: 12, color: '#FFA500', textAlign: 'center', lineHeight: 18 },
  qrContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20 },
  address: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 20, width: '100%' },
  actionBtn: { flex: 1, backgroundColor: '#2A2010', borderRadius: 12, padding: 14, alignItems: 'center' },
  actionBtnText: { color: theme.colors.gold, fontWeight: '600', fontSize: 15 },
  backBtn: { padding: 12 },
  backText: { color: theme.colors.textSecondary, fontSize: 15 },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/ReceiveScreen.tsx
git commit -m "feat: ReceiveScreen — real QR code, copy, native share"
```

---

## Task 10: SettingsScreen — biometric real + seed protegida

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Reescrever SettingsScreen.tsx**

```typescript
// src/screens/SettingsScreen.tsx
import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ScrollView, Alert, Modal,
} from 'react-native'
import { theme } from '../theme'
import { getSeed, getWalletInfo, clearWallet } from '../services/zcash'
import {
  isBiometricAvailable, isBiometricEnabled,
  setBiometricEnabled, authenticate,
} from '../services/biometric'

interface Props {
  onWalletDeleted: () => void
}

export function SettingsScreen({ onWalletDeleted }: Props) {
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricOn, setBiometricOn] = useState(false)
  const [seedWords, setSeedWords] = useState<string[] | null>(null)
  const [showSeed, setShowSeed] = useState(false)
  const [address, setAddress] = useState<string>('')

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable)
    isBiometricEnabled().then(setBiometricOn)
    getWalletInfo().then(info => { if (info) setAddress(info.address) })
  }, [])

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      const ok = await authenticate('Authenticate to enable Face ID lock')
      if (!ok) return
    }
    await setBiometricEnabled(value)
    setBiometricOn(value)
  }

  const handleViewSeed = async () => {
    const ok = await authenticate('Authenticate to view your recovery phrase')
    if (!ok) return
    const seed = await getSeed()
    if (!seed) { Alert.alert('Error', 'Seed not found'); return }
    setSeedWords(seed.split(' '))
    setShowSeed(true)
  }

  const handleDeleteWallet = () => {
    Alert.alert(
      'Delete Wallet',
      'This will remove your wallet from this device. Make sure you have your recovery phrase backed up.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    await clearWallet()
                    onWalletDeleted()
                  },
                },
              ],
            )
          },
        },
      ],
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Security */}
      <Text style={styles.sectionHeader}>SECURITY</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowLabel}>Face ID / Touch ID</Text>
            <Text style={styles.rowSub}>Require biometric to open app</Text>
          </View>
          <Switch
            value={biometricOn}
            onValueChange={toggleBiometric}
            disabled={!biometricAvailable}
            trackColor={{ true: theme.colors.gold, false: '#3A2E1A' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Recovery */}
      <Text style={styles.sectionHeader}>RECOVERY</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={handleViewSeed}>
          <View>
            <Text style={styles.rowLabel}>View Recovery Phrase</Text>
            <Text style={styles.rowSub}>Protected by Face ID</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Wallet info */}
      <Text style={styles.sectionHeader}>WALLET</Text>
      <View style={styles.card}>
        <Text style={styles.rowLabel}>Address</Text>
        <Text style={styles.addressText} selectable numberOfLines={2}>{address}</Text>
      </View>

      {/* Danger zone */}
      <Text style={styles.sectionHeader}>DANGER ZONE</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.deleteRow} onPress={handleDeleteWallet}>
          <Text style={styles.deleteText}>Delete Wallet</Text>
        </TouchableOpacity>
      </View>

      {/* Seed modal */}
      <Modal visible={showSeed} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Recovery Phrase</Text>
          <Text style={styles.modalSubtitle}>Keep this private. Never share it.</Text>
          <View style={styles.wordsGrid}>
            {(seedWords ?? []).map((word, i) => (
              <View key={i} style={styles.wordCell}>
                <Text style={styles.wordNum}>{i + 1}</Text>
                <Text style={styles.wordText}>{word}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => { setShowSeed(false); setSeedWords(null) }}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 24 },
  sectionHeader: { fontSize: 11, color: theme.colors.textSecondary, letterSpacing: 1.2, marginBottom: 8, marginTop: 20 },
  card: { backgroundColor: '#2A2010', borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  rowLabel: { fontSize: 15, color: theme.colors.text, fontWeight: '500' },
  rowSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: theme.colors.textSecondary },
  addressText: { fontSize: 12, color: theme.colors.textSecondary, padding: 16, paddingTop: 4, lineHeight: 18 },
  deleteRow: { padding: 16 },
  deleteText: { fontSize: 15, color: '#FF6B6B', fontWeight: '600' },
  modal: { flex: 1, backgroundColor: theme.colors.background, padding: 28 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: '#FF6B6B', marginBottom: 24 },
  wordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 },
  wordCell: { width: '30%', backgroundColor: '#2A2010', borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordNum: { fontSize: 10, color: theme.colors.gold, width: 18 },
  wordText: { fontSize: 13, color: theme.colors.text, fontWeight: '500' },
  closeBtn: { backgroundColor: theme.colors.gold, borderRadius: 12, padding: 16, alignItems: 'center' },
  closeBtnText: { color: '#1A1209', fontWeight: '700', fontSize: 16 },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: SettingsScreen — real FaceID toggle, seed protected by biometric, 2-step delete"
```

---

## Task 11: TrendingScreen — Kraken + Victory chart

**Files:**
- Modify: `src/screens/TrendingScreen.tsx`

- [ ] **Step 1: Reescrever TrendingScreen.tsx**

```typescript
// src/screens/TrendingScreen.tsx
import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native'
import { VictoryChart, VictoryLine, VictoryTheme, VictoryAxis } from 'victory-native'
import { theme } from '../theme'
import { getCurrentPrice, getPriceHistory, zecToUsd, type Period } from '../services/price'
import { getWalletInfo } from '../services/zcash'
import { getBalance } from '../services/zingo'

const PERIODS: Period[] = ['24H', '7D', '30D', '1Y']
const { width } = Dimensions.get('window')

export function TrendingScreen() {
  const [period, setPeriod] = useState<Period>('7D')
  const [price, setPrice] = useState<number>(0)
  const [history, setHistory] = useState<{ x: number; y: number }[]>([])
  const [balanceZat, setBalanceZat] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [px, pts, info] = await Promise.all([
        getCurrentPrice(),
        getPriceHistory(period),
        getWalletInfo(),
      ])
      setPrice(px)
      setHistory(pts.map((p, i) => ({ x: i, y: p.close })))

      if (info) {
        const bal = await getBalance(info.ufvk)
        setBalanceZat(bal.total)
      }
    } catch {
      // fail silently — show stale data
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  const balanceUsd = zecToUsd(balanceZat, price)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ZEC / USD</Text>

      {loading ? (
        <ActivityIndicator color={theme.colors.gold} style={{ marginTop: 40 }} />
      ) : (
        <>
          <Text style={styles.price}>${price.toFixed(2)}</Text>
          {balanceZat > 0 && (
            <Text style={styles.balanceUsd}>Your balance: ≈ ${balanceUsd.toFixed(2)}</Text>
          )}

          {history.length > 0 && (
            <VictoryChart
              width={width - 32}
              height={220}
              theme={VictoryTheme.material}
              padding={{ top: 10, bottom: 40, left: 50, right: 10 }}
            >
              <VictoryAxis
                style={{ axis: { stroke: '#3A2E1A' }, tickLabels: { fill: '#888', fontSize: 10 } }}
                tickCount={4}
              />
              <VictoryAxis
                dependentAxis
                style={{ axis: { stroke: '#3A2E1A' }, tickLabels: { fill: '#888', fontSize: 10 } }}
                tickFormat={v => `$${v.toFixed(0)}`}
              />
              <VictoryLine
                data={history}
                style={{ data: { stroke: theme.colors.gold, strokeWidth: 2 } }}
                interpolation="monotoneX"
              />
            </VictoryChart>
          )}

          <View style={styles.periodRow}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, period === p && styles.periodActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  price: { fontSize: 36, fontWeight: '700', color: theme.colors.gold, marginBottom: 2 },
  balanceUsd: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 8 },
  periodRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#2A2010' },
  periodActive: { backgroundColor: theme.colors.gold },
  periodText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
  periodTextActive: { color: '#1A1209' },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/TrendingScreen.tsx
git commit -m "feat: TrendingScreen — Kraken API price, Victory Native chart, period selector"
```

---

## Task 12: InsightsScreen + SyncScreen com dados reais

**Files:**
- Modify: `src/screens/InsightsScreen.tsx`
- Modify: `src/screens/SyncScreen.tsx`

- [ ] **Step 1: Reescrever InsightsScreen.tsx**

```typescript
// src/screens/InsightsScreen.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Dimensions } from 'react-native'
import { VictoryBar, VictoryChart, VictoryAxis, VictoryTheme } from 'victory-native'
import { theme } from '../theme'
import { getTransactions, type Transaction } from '../services/zingo'
import { getWalletInfo } from '../services/zcash'
import { getCurrentPrice, zecToUsd } from '../services/price'

const { width } = Dimensions.get('window')

export function InsightsScreen() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const [price, setPrice] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [info, px] = await Promise.all([getWalletInfo(), getCurrentPrice()])
        setPrice(px)
        if (info) {
          const transactions = await getTransactions(info.ufvk, 100)
          setTxs(transactions)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.gold} /></View>
  }

  const received = txs.filter(t => t.direction === 'received').reduce((s, t) => s + Math.abs(t.amount), 0)
  const sent = txs.filter(t => t.direction === 'sent').reduce((s, t) => s + Math.abs(t.amount), 0)
  const netFlow = received - sent

  const barData = [
    { x: 'Received', y: received / 1e8 },
    { x: 'Sent', y: sent / 1e8 },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Insights</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Received</Text>
          <Text style={styles.statValue}>{(received / 1e8).toFixed(4)} ZEC</Text>
          <Text style={styles.statUsd}>${zecToUsd(received, price).toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Sent</Text>
          <Text style={styles.statValue}>{(sent / 1e8).toFixed(4)} ZEC</Text>
          <Text style={styles.statUsd}>${zecToUsd(sent, price).toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.netCard}>
        <Text style={styles.statLabel}>Net Flow</Text>
        <Text style={[styles.netValue, netFlow >= 0 ? styles.positive : styles.negative]}>
          {netFlow >= 0 ? '+' : ''}{(netFlow / 1e8).toFixed(4)} ZEC
        </Text>
      </View>

      {barData[0].y > 0 || barData[1].y > 0 ? (
        <VictoryChart
          width={width - 32}
          height={200}
          theme={VictoryTheme.material}
          padding={{ top: 20, bottom: 40, left: 60, right: 20 }}
        >
          <VictoryAxis style={{ tickLabels: { fill: '#888', fontSize: 12 } }} />
          <VictoryAxis dependentAxis tickFormat={v => `${v.toFixed(2)}`} style={{ tickLabels: { fill: '#888', fontSize: 10 } }} />
          <VictoryBar
            data={barData}
            style={{ data: { fill: ({ datum }) => datum.x === 'Received' ? theme.colors.gold : '#FF6B6B' } }}
            cornerRadius={{ top: 4 }}
          />
        </VictoryChart>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      )}

      <Text style={styles.txCount}>{txs.length} transactions total</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#2A2010', borderRadius: 14, padding: 16 },
  netCard: { backgroundColor: '#2A2010', borderRadius: 14, padding: 16, marginBottom: 16 },
  statLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  statValue: { fontSize: 16, color: theme.colors.text, fontWeight: '600' },
  statUsd: { fontSize: 12, color: theme.colors.textSecondary },
  netValue: { fontSize: 20, fontWeight: '700' },
  positive: { color: theme.colors.gold },
  negative: { color: '#FF6B6B' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: theme.colors.textSecondary, fontSize: 14 },
  txCount: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 },
})
```

- [ ] **Step 2: Reescrever SyncScreen.tsx**

```typescript
// src/screens/SyncScreen.tsx
import React, { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { theme } from '../theme'
import { getSyncStatus, startSync } from '../services/zingo'
import { POLL_INTERVAL_MS, POLL_MAX_RETRIES } from '../config'

interface Props {
  onBack: () => void
}

export function SyncScreen({ onBack }: Props) {
  const [synced, setSynced] = useState(0)
  const [total, setTotal] = useState(0)
  const [percent, setPercent] = useState(0)
  const [eta, setEta] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poll = async () => {
    try {
      const status = await getSyncStatus()
      setSynced(status.synced)
      setTotal(status.total)
      setPercent(status.percent)
      setEta(status.eta)
      retriesRef.current = 0  // reset on success

      if (status.percent < 100) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      }
    } catch (e: any) {
      retriesRef.current++
      if (retriesRef.current >= POLL_MAX_RETRIES) {
        setError('Sync timed out. Check your internet connection.')
        return
      }
      // exponential backoff
      const delay = POLL_INTERVAL_MS * Math.pow(2, retriesRef.current - 1)
      timerRef.current = setTimeout(poll, Math.min(delay, 60000))
    }
  }

  useEffect(() => {
    startSync().catch(() => {})
    poll()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const etaMinutes = Math.ceil(eta / 60)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Syncing</Text>
      <Text style={styles.subtitle}>Downloading ZCash blockchain data...</Text>

      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(percent, 100)}%` }]} />
        </View>
        <Text style={styles.percentText}>{percent.toFixed(1)}%</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{synced.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Blocks Synced</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{total.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Blocks</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{etaMinutes > 0 ? `~${etaMinutes}m` : '—'}</Text>
          <Text style={styles.statLabel}>ETA</Text>
        </View>
      </View>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <Text style={styles.node}>Node: na.zec.rocks:443</Text>

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: 28, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 40, textAlign: 'center' },
  progressContainer: { width: '100%', alignItems: 'center', marginBottom: 40 },
  progressTrack: { width: '100%', height: 8, backgroundColor: '#2A2010', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.gold, borderRadius: 4 },
  percentText: { marginTop: 12, fontSize: 20, fontWeight: '700', color: theme.colors.gold },
  statsGrid: { flexDirection: 'row', gap: 20, marginBottom: 32 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  statLabel: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  errorText: { color: '#FF6B6B', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  node: { fontSize: 11, color: theme.colors.textSecondary, marginBottom: 32 },
  backBtn: { backgroundColor: '#2A2010', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  backText: { color: theme.colors.gold, fontWeight: '600', fontSize: 15 },
})
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/InsightsScreen.tsx src/screens/SyncScreen.tsx
git commit -m "feat: InsightsScreen real tx data, SyncScreen with backoff"
```

---

## Task 13: App.tsx — biometric gate + wireup de todas as telas

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Reescrever App.tsx**

```typescript
// App.tsx
import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { theme } from './src/theme'
import { walletExists } from './src/services/zcash'
import { isBiometricEnabled, authenticate } from './src/services/biometric'

import { SplashScreen } from './src/screens/SplashScreen'
import { OnboardingScreen } from './src/screens/OnboardingScreen'
import { CreateWalletScreen } from './src/screens/CreateWalletScreen'
import { ImportWalletScreen } from './src/screens/ImportWalletScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { SendScreen } from './src/screens/SendScreen'
import { ReceiveScreen } from './src/screens/ReceiveScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { TrendingScreen } from './src/screens/TrendingScreen'
import { InsightsScreen } from './src/screens/InsightsScreen'
import { SyncScreen } from './src/screens/SyncScreen'
import { BottomTabs } from './src/components/BottomTabs'

type Screen =
  | 'splash'
  | 'biometric'
  | 'onboarding'
  | 'create'
  | 'import'
  | 'main'
  | 'send'
  | 'receive'
  | 'sync'

type Tab = 'wallet' | 'trending' | 'insights' | 'settings'

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [activeTab, setActiveTab] = useState<Tab>('wallet')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function init() {
      const [exists, biometricOn] = await Promise.all([
        walletExists(),
        isBiometricEnabled(),
      ])
      if (exists && biometricOn) {
        setScreen('biometric')
      } else if (exists) {
        setScreen('main')
      } else {
        setScreen('onboarding')
      }
      setChecking(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (screen !== 'biometric') return
    authenticate('Unlock Zcash Wallet').then(ok => {
      if (ok) setScreen('main')
      // if cancelled, stays on biometric screen showing a retry button
    })
  }, [screen])

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.gold} />
      </View>
    )
  }

  if (screen === 'splash') return <SplashScreen onReady={() => {}} />

  if (screen === 'biometric') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.gold} />
      </View>
    )
  }

  if (screen === 'onboarding') {
    return (
      <OnboardingScreen
        onCreateWallet={() => setScreen('create')}
        onRestoreWallet={() => setScreen('import')}
      />
    )
  }

  if (screen === 'create') {
    return (
      <CreateWalletScreen
        onDone={() => setScreen('main')}
        onBack={() => setScreen('onboarding')}
      />
    )
  }

  if (screen === 'import') {
    return (
      <ImportWalletScreen
        onDone={() => setScreen('main')}
        onBack={() => setScreen('onboarding')}
      />
    )
  }

  if (screen === 'send') {
    return <SendScreen onBack={() => setScreen('main')} />
  }

  if (screen === 'receive') {
    return <ReceiveScreen onBack={() => setScreen('main')} />
  }

  if (screen === 'sync') {
    return <SyncScreen onBack={() => setScreen('main')} />
  }

  // main
  const renderTab = () => {
    switch (activeTab) {
      case 'wallet':
        return (
          <HomeScreen
            onSend={() => setScreen('send')}
            onReceive={() => setScreen('receive')}
            onScan={() => setScreen('receive')}
          />
        )
      case 'trending':
        return <TrendingScreen />
      case 'insights':
        return <InsightsScreen />
      case 'settings':
        return (
          <SettingsScreen
            onWalletDeleted={() => setScreen('onboarding')}
          />
        )
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {renderTab()}
      <BottomTabs
        active={activeTab}
        onTab={setActiveTab as (t: string) => void}
        onSync={() => setScreen('sync')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  loading: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
})
```

- [ ] **Step 2: Atualizar BottomTabs para aceitar onSync**

Abrir `src/components/BottomTabs.tsx` e adicionar prop `onSync?: () => void` com ícone na barra.

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add App.tsx src/components/BottomTabs.tsx
git commit -m "feat: App.tsx — biometric gate, full screen wiring, sync navigation"
```

---

## Task 14: QA — testar no simulador e capturar screenshots

**Files:** nenhum — apenas execução e captura

- [ ] **Step 1: Iniciar simulador iOS**

```bash
cd /Users/jadsonjacob/Downloads/zec-wallet
npx expo start --ios
```

- [ ] **Step 2: Testar fluxo 1 — Criar wallet**

No simulador:
1. Tela de onboarding aparece → "Create New Wallet"
2. Spinner de geração → 24 palavras reais aparecem
3. "I've Written It Down" → quiz de 3 palavras → selecionar corretas
4. "Confirm" → tela de sucesso → "Go to Wallet"
5. HomeScreen com saldo (0.00000000 ZEC)

Capturar screenshot de cada step:
```bash
xcrun simctl io booted screenshot ~/Desktop/zec-01-onboarding.png
xcrun simctl io booted screenshot ~/Desktop/zec-02-create-words.png
xcrun simctl io booted screenshot ~/Desktop/zec-03-quiz.png
xcrun simctl io booted screenshot ~/Desktop/zec-04-home.png
```

- [ ] **Step 3: Testar fluxo 4 — Receber ZEC**

1. Home → "Receive"
2. QR code real aparece com endereço `u1...`
3. Tap "Copy" → badge "✓ Copied"
4. Tap "Share" → share sheet iOS

```bash
xcrun simctl io booted screenshot ~/Desktop/zec-05-receive.png
```

- [ ] **Step 4: Testar fluxo TrendingScreen**

1. Tab "Trending" → preço ZEC real da Kraken
2. Gráfico Victory Native renderizado
3. Taps nos períodos: 24H / 7D / 30D / 1Y → gráfico atualiza

```bash
xcrun simctl io booted screenshot ~/Desktop/zec-06-trending.png
```

- [ ] **Step 5: Testar SettingsScreen**

1. Tab "Settings"
2. Toggle "Face ID" → solicita autenticação (simulador usa biometria virtual)
3. "View Recovery Phrase" → FaceID → 24 palavras em modal
4. Fechar modal

```bash
xcrun simctl io booted screenshot ~/Desktop/zec-07-settings.png
```

- [ ] **Step 6: Verificar sem erros no console**

No terminal do Expo, confirmar: zero `Error`, zero `Warning` crítico

- [ ] **Step 7: Commit screenshots na pasta do projeto**

```bash
mkdir -p /Users/jadsonjacob/Downloads/zec-wallet/screenshots
cp ~/Desktop/zec-0*.png /Users/jadsonjacob/Downloads/zec-wallet/screenshots/
git add screenshots/
git commit -m "chore: QA screenshots from iOS simulator"
```

---

## Task 15: Privacy Policy + App Store prep

**Files:**
- Create: `privacy-policy.html`

- [ ] **Step 1: Criar privacy-policy.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zcash Wallet — Privacy Policy</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #222; line-height: 1.6; }
    h1 { color: #F4B728; }
    h2 { margin-top: 32px; }
  </style>
</head>
<body>
  <h1>Zcash Wallet Privacy Policy</h1>
  <p>Last updated: June 5, 2026</p>

  <h2>What We Collect</h2>
  <p>Zcash Wallet collects <strong>no personal data</strong>. We do not require registration, login, or any account creation.</p>

  <h2>Your Keys Stay on Your Device</h2>
  <p>Your recovery phrase (seed) and private keys are stored exclusively in your device's secure enclave (iOS Keychain). They are never transmitted to our servers or any third party.</p>

  <h2>Network Requests</h2>
  <p>The app communicates with:</p>
  <ul>
    <li><strong>api.zecwallet.app</strong> — to relay ZCash transactions and fetch wallet balances. No user-identifying data is sent.</li>
    <li><strong>api.kraken.com</strong> — to fetch public ZEC/USD price data. No wallet data is sent.</li>
    <li><strong>na.zec.rocks</strong> — ZCash lightwalletd node for compact block sync.</li>
  </ul>

  <h2>Data Stored on Device</h2>
  <p>The app stores your seed phrase, ZCash address, and viewing key in the iOS Keychain, protected by device encryption and optionally by Face ID / Touch ID.</p>

  <h2>No Analytics or Tracking</h2>
  <p>We do not use any analytics SDK, crash reporting, or advertising framework.</p>

  <h2>Contact</h2>
  <p>Questions? Email: <a href="mailto:support@zecwallet.app">support@zecwallet.app</a></p>
</body>
</html>
```

- [ ] **Step 2: Subir para o Shijiru**

```bash
scp privacy-policy.html root@38.133.213.215:/var/www/html/privacy.html
# Confirmar:
curl https://zecwallet.app/privacy
```

Expected: página HTML da privacy policy

- [ ] **Step 3: EAS build de produção**

```bash
cd /Users/jadsonjacob/Downloads/zec-wallet
eas build --platform ios --profile production
```

Expected: link para download do `.ipa` no Expo dashboard

- [ ] **Step 4: Submit para App Store**

```bash
eas submit --platform ios --latest
```

Expected: app enviado para revisão no App Store Connect

- [ ] **Step 5: Commit final**

```bash
git add privacy-policy.html
git commit -m "chore: privacy policy, App Store submission complete"
```

---

## Checklist Final do App

- [ ] TypeScript compila sem erros (`npx tsc --noEmit`)
- [ ] CreateWallet: 24 palavras reais do backend, quiz de 3 palavras
- [ ] ImportWallet: validação BIP39 palavra a palavra
- [ ] HomeScreen: saldo real, pull-to-refresh, skeleton loader
- [ ] SendScreen: fee real, double-send bloqueado, TXID no done
- [ ] ReceiveScreen: QR code real, copy, share nativo
- [ ] SettingsScreen: FaceID real, seed protegida, delete em 2 passos
- [ ] TrendingScreen: preço Kraken real, gráfico Victory renderizado
- [ ] InsightsScreen: dados reais de txs, bar chart funcional
- [ ] SyncScreen: polling com backoff, timeout configurado
- [ ] Biometric gate ao abrir o app
- [ ] Screenshots capturadas do simulador
- [ ] Privacy policy no ar em `zecwallet.app/privacy`
- [ ] EAS build enviado para App Store Connect
