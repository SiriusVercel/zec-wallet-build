import './src/i18n'
import React, { useEffect, useState, useRef } from 'react'
import { AppState, AppStateStatus, ActivityIndicator, View, StyleSheet, LogBox, Alert } from 'react-native'
import { StatusBar } from 'expo-status-bar'

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'i18next::pluralResolver',
])

import { walletExists, getSeed, getWalletInfo } from './src/services/zcash'
import { isBiometricEnabled } from './src/services/biometric'
import { isJailbroken } from './src/services/security'
import { backupSeed } from './src/services/backup'
import { Colors }            from './src/theme'

import { BottomTabs }        from './src/components/BottomTabs'
import type { Tab }          from './src/components/BottomTabs'

import OnboardingScreen   from './src/screens/OnboardingScreen'
import { CreateWalletScreen } from './src/screens/CreateWalletScreen'
import ImportWalletScreen from './src/screens/ImportWalletScreen'
import HomeScreen         from './src/screens/HomeScreen'
import TrendingScreen     from './src/screens/TrendingScreen'
import InsightsScreen     from './src/screens/InsightsScreen'
import SendScreen         from './src/screens/SendScreen'
import ReceiveScreen      from './src/screens/ReceiveScreen'
import SettingsScreen     from './src/screens/SettingsScreen'
import SyncScreen         from './src/screens/SyncScreen'
import LockScreen         from './src/screens/LockScreen'
import QRScannerScreen    from './src/screens/QRScannerScreen'
import PinSetupScreen     from './src/screens/PinSetupScreen'
import { ZecLogo }        from './src/components/ZecLogo'
import type { Balance }   from './src/services/zingo'
import { hasPin }         from './src/services/pin'

type Screen = 'onboarding' | 'create' | 'import' | 'pin-setup' | 'main' | 'send' | 'receive' | 'sync' | 'scan'

// ── SCREENSHOT MODE: set to a Screen value to jump directly for QA ────────
const SCREENSHOT_SCREEN: Screen | null = null
const SCREENSHOT_TAB: Tab = 'wallet'
// ─────────────────────────────────────────────────────────────────────────

const LOCK_TIMEOUT_MS = 5 * 60 * 1000  // 5 minutes

export default function App() {
  const [screen,       setScreen]      = useState<Screen>(SCREENSHOT_SCREEN ?? 'onboarding')
  const [activeTab,    setActiveTab]   = useState<Tab>(SCREENSHOT_TAB)
  const [loading,      setLoading]     = useState(SCREENSHOT_SCREEN === null)
  const [isLocked,     setIsLocked]    = useState(false)
  const [isBackground, setIsBackground] = useState(false)
  const [balance,      setBalance]     = useState<Balance>({ orchard: 0, sapling: 0, transparent: 0, total: 0 })
  const [scannedAddr,  setScannedAddr] = useState<string | undefined>(undefined)
  const lastBackgroundRef              = useRef<number | null>(null)

  // ── Startup: jailbreak check + wallet + biometric ────────────────────────
  useEffect(() => {
    if (SCREENSHOT_SCREEN !== null) return

    async function init() {
      const jailbroken = await isJailbroken()
      if (jailbroken) {
        Alert.alert(
          'Security Warning',
          'This device appears to be jailbroken. Your seed phrase and keys may be at risk. We recommend using a non-jailbroken device.',
          [{ text: 'I Understand', style: 'destructive' }],
        )
      }

      const [exists, bioEnabled, pinAlreadySet] = await Promise.all([
        walletExists(),
        isBiometricEnabled(),
        hasPin(),
      ])

      if (!exists) {
        setScreen('onboarding')
        setLoading(false)
        return
      }

      // If any lock is configured, show LockScreen (handles PIN + Face ID)
      if (bioEnabled || pinAlreadySet) {
        setIsLocked(true)
      }

      setScreen('main')
      setLoading(false)
    }

    init()
  }, [])

  // ── Re-backup on foreground (keeps server in sync) ───────────────────────
  useEffect(() => {
    async function refreshBackup() {
      try {
        const [seed, info] = await Promise.all([getSeed(), getWalletInfo()])
        if (seed && info) {
          backupSeed(seed, { address: info.address, ufvk: info.ufvk, birthday: info.birthday })
        }
      } catch { /* silent */ }
    }
    if (screen === 'main') refreshBackup()
  }, [screen])

  // ── Background blur + auto-lock ───────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        setIsBackground(true)
        lastBackgroundRef.current = Date.now()
      } else if (nextState === 'active') {
        setIsBackground(false)
        // Re-sync backup when returning from background
        getSeed().then(seed => getWalletInfo().then(info => {
          if (seed && info) backupSeed(seed, { address: info.address, ufvk: info.ufvk, birthday: info.birthday })
        })).catch(() => {})
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

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={Colors.zec} />
      </View>
    )
  }

  // ── Main app shell ────────────────────────────────────────────────────────
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
              onDone={() => setScreen('pin-setup')}
              onBack={() => setScreen('onboarding')}
            />
          )}

          {screen === 'import' && (
            <ImportWalletScreen
              onDone={() => setScreen('pin-setup')}
              onBack={() => setScreen('onboarding')}
            />
          )}

          {screen === 'pin-setup' && (
            <PinSetupScreen
              onDone={() => { setActiveTab('wallet'); setScreen('main') }}
              onSkip={() => { setActiveTab('wallet'); setScreen('main') }}
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
                    onScan={() => setScreen('scan')}
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

          {screen === 'send'    && <SendScreen    onBack={() => { setScannedAddr(undefined); setScreen('main') }} availableBalance={balance} initialAddress={scannedAddr} />}
          {screen === 'receive' && <ReceiveScreen onBack={() => setScreen('main')} />}
          {screen === 'sync'    && <SyncScreen    onBack={() => setScreen('main')} />}
          {screen === 'scan'    && (
            <QRScannerScreen
              onScan={(addr) => { setScannedAddr(addr); setScreen('send') }}
              onClose={() => setScreen('main')}
            />
          )}
        </>
      )}

      {/* Privacy overlay — blocks iOS multitask screenshot */}
      {isBackground && (
        <View style={styles.privacyOverlay}>
          <ZecLogo size={72} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    flex: 1,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
})
