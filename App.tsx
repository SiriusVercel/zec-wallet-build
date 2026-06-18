import './src/i18n'
import React, { useEffect, useState, useRef } from 'react'
import { AppState, AppStateStatus, ActivityIndicator, View, StyleSheet, LogBox } from 'react-native'
import { StatusBar } from 'expo-status-bar'

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'i18next::pluralResolver',
])

import { walletExists }      from './src/services/zcash'
import { isBiometricEnabled, authenticate } from './src/services/biometric'
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
import LockScreen from './src/screens/LockScreen'
import type { Balance } from './src/services/zingo'

type Screen = 'onboarding' | 'create' | 'import' | 'main' | 'send' | 'receive' | 'sync'

// ── SCREENSHOT MODE: set to a Screen value to jump directly for QA ────────
const SCREENSHOT_SCREEN: Screen | null = null
const SCREENSHOT_TAB: Tab = 'wallet'
// ─────────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,    setScreen]    = useState<Screen>(SCREENSHOT_SCREEN ?? 'onboarding')
  const [activeTab, setActiveTab] = useState<Tab>(SCREENSHOT_TAB)
  const [loading,   setLoading]   = useState(SCREENSHOT_SCREEN === null)
  const [isLocked, setIsLocked]   = useState(false)
  const [balance,  setBalance]    = useState<Balance>({ orchard: 0, sapling: 0, transparent: 0, total: 0 })
  const lastBackgroundRef         = useRef<number | null>(null)
  const LOCK_TIMEOUT_MS           = 30_000

  // ── Startup: check wallet + biometric ────────────────────────────────────
  useEffect(() => {
    if (SCREENSHOT_SCREEN !== null) return   // skip in screenshot mode

    async function init() {
      const [exists, bioEnabled] = await Promise.all([
        walletExists(),
        isBiometricEnabled(),
      ])

      if (!exists) {
        setScreen('onboarding')
        setLoading(false)
        return
      }

      if (bioEnabled) {
        // Keep loading=true while biometric prompt is shown
        const ok = await authenticate('Unlock Zcash Wallet')
        setScreen(ok ? 'main' : 'onboarding')
      } else {
        setScreen('main')
      }

      setLoading(false)
    }

    init()
  }, [])

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

          {screen === 'send'    && <SendScreen    onBack={() => setScreen('main')} availableBalance={balance} />}
          {screen === 'receive' && <ReceiveScreen onBack={() => setScreen('main')} />}
          {screen === 'sync'    && <SyncScreen    onBack={() => setScreen('main')} />}
        </>
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
})
