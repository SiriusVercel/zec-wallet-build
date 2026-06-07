import React, { useEffect, useState } from 'react'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'

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

type Screen = 'onboarding' | 'create' | 'import' | 'main' | 'send' | 'receive' | 'sync'

export default function App() {
  const [screen,    setScreen]    = useState<Screen>('onboarding')
  const [activeTab, setActiveTab] = useState<Tab>('wallet')
  const [loading,   setLoading]   = useState(true)

  // ── Startup: check wallet + biometric ────────────────────────────────────
  useEffect(() => {
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

      {/* ── Onboarding flow ── */}
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

      {/* ── Main tabs ── */}
      {/* TrendingScreen and InsightsScreen embed their own BottomTabs */}
      {screen === 'main' && activeTab === 'trending' && (
        <TrendingScreen onTab={setActiveTab} />
      )}
      {screen === 'main' && activeTab === 'insights' && (
        <InsightsScreen onTab={setActiveTab} />
      )}

      {/* wallet and settings use external BottomTabs */}
      {screen === 'main' && (activeTab === 'wallet' || activeTab === 'settings') && (
        <View style={styles.root}>
          <View style={styles.content}>
            {activeTab === 'wallet' && (
              <HomeScreen
                onSend={() => setScreen('send')}
                onReceive={() => setScreen('receive')}
                onScan={() => setScreen('receive')}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsScreen onWalletDeleted={() => setScreen('onboarding')} />
            )}
          </View>

          <BottomTabs active={activeTab} onChange={setActiveTab} />
        </View>
      )}

      {/* ── Full-screen secondary screens ── */}
      {screen === 'send'    && <SendScreen    onBack={() => setScreen('main')} />}
      {screen === 'receive' && <ReceiveScreen onBack={() => setScreen('main')} />}
      {screen === 'sync'    && <SyncScreen    onBack={() => setScreen('main')} />}
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
