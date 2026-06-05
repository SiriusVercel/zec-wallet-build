import React, { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Tab } from './src/components/BottomTabs'
import SplashScreen       from './src/screens/SplashScreen'
import OnboardingScreen   from './src/screens/OnboardingScreen'
import { CreateWalletScreen } from './src/screens/CreateWalletScreen'
import ImportWalletScreen from './src/screens/ImportWalletScreen'
import HomeScreen         from './src/screens/HomeScreen'
import TrendingScreen     from './src/screens/TrendingScreen'
import InsightsScreen     from './src/screens/InsightsScreen'
import ReceiveScreen      from './src/screens/ReceiveScreen'
import SendScreen         from './src/screens/SendScreen'
import SettingsScreen     from './src/screens/SettingsScreen'

type Screen = 'splash' | 'onboarding' | 'create' | 'import' | 'main' | 'receive' | 'send'

export default function App() {
  const [screen,    setScreen]    = useState<Screen>('splash')
  const [activeTab, setActiveTab] = useState<Tab>('wallet')

  function handleTab(t: Tab) {
    setActiveTab(t)
    if (t === 'settings') setActiveTab('settings')
  }

  return (
    <>
      <StatusBar style="light" />

      {screen === 'splash' && (
        <SplashScreen onReady={has => setScreen(has ? 'main' : 'onboarding')} />
      )}
      {screen === 'onboarding' && (
        <OnboardingScreen
          onCreateWallet={() => setScreen('create')}
          onImportWallet={() => setScreen('import')}
        />
      )}
      {screen === 'create' && (
        <CreateWalletScreen onDone={() => { setScreen('main'); setActiveTab('wallet') }} onBack={() => setScreen('onboarding')} />
      )}
      {screen === 'import' && (
        <ImportWalletScreen onDone={() => { setScreen('main'); setActiveTab('wallet') }} onBack={() => setScreen('onboarding')} />
      )}

      {/* Main app com bottom tabs */}
      {screen === 'main' && activeTab === 'wallet' && (
        <HomeScreen
          onSend={() => setScreen('send')}
          onReceive={() => setScreen('receive')}
          onSettings={() => setActiveTab('settings')}
          onTab={handleTab}
          activeTab={activeTab}
        />
      )}
      {screen === 'main' && activeTab === 'trending' && (
        <TrendingScreen onTab={handleTab} />
      )}
      {screen === 'main' && activeTab === 'insights' && (
        <InsightsScreen onTab={handleTab} />
      )}
      {screen === 'main' && activeTab === 'settings' && (
        <SettingsScreen
          onBack={() => setActiveTab('wallet')}
          onWipeWallet={() => setScreen('onboarding')}
        />
      )}

      {screen === 'receive' && <ReceiveScreen onBack={() => setScreen('main')} />}
      {screen === 'send'    && <SendScreen    onBack={() => setScreen('main')} />}
    </>
  )
}
