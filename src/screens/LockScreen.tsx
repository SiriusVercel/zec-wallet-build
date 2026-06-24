import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { authenticate, isBiometricEnabled } from '../services/biometric'
import { isPinEnabled, verifyPin } from '../services/pin'
import { ZecLogo } from '../components/ZecLogo'
import PinScreen from './PinScreen'

interface Props {
  onUnlock: () => void
}

export default function LockScreen({ onUnlock }: Props) {
  const [mode,    setMode]    = useState<'loading' | 'biometric' | 'pin' | 'both'>('loading')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function detectMode() {
      const [bioEnabled, pinEnabled] = await Promise.all([
        isBiometricEnabled(),
        isPinEnabled(),
      ])
      if (bioEnabled && pinEnabled) setMode('both')
      else if (bioEnabled) setMode('biometric')
      else if (pinEnabled) setMode('pin')
      else {
        // No lock configured — auto-unlock
        onUnlock()
        return
      }
      // Auto-prompt biometric if available
      if (bioEnabled) promptBiometric()
    }
    detectMode()
  }, [])

  async function promptBiometric() {
    setLoading(true)
    setError('')
    const ok = await authenticate('Unlock ZEC Wallet')
    setLoading(false)
    if (ok) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onUnlock()
    }
  }

  async function handlePinSuccess() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onUnlock()
  }

  if (mode === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.zec} size="large" />
      </View>
    )
  }

  if (mode === 'pin') {
    return (
      <PinScreen
        title="ZEC Wallet"
        subtitle="Enter your PIN to continue"
        verify={verifyPin}
        onSuccess={handlePinSuccess}
      />
    )
  }

  if (mode === 'both') {
    return (
      <View style={{ flex: 1 }}>
        <PinScreen
          title="ZEC Wallet"
          subtitle="Enter PIN or use Face ID"
          verify={verifyPin}
          onSuccess={handlePinSuccess}
        />
        <TouchableOpacity
          style={styles.faceIdBtn}
          onPress={promptBiometric}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.zec} size="small" />
            : <Text style={styles.faceIdLabel}>Use Face ID</Text>
          }
        </TouchableOpacity>
      </View>
    )
  }

  // Biometric only
  return (
    <View style={styles.container}>
      <ZecLogo size={72} />
      <Text style={styles.title}>ZEC Wallet</Text>
      <Text style={styles.subtitle}>Authenticate to continue</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color={Colors.zec} size="large" style={styles.btn} />
      ) : (
        <TouchableOpacity style={styles.btn} onPress={promptBiometric} activeOpacity={0.8}>
          <Text style={styles.btnLabel}>Use Face ID</Text>
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
  faceIdBtn: {
    marginHorizontal: Spacing.xl,
    marginBottom: 48,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  faceIdLabel: { ...Typography.bodyBold, color: Colors.zec },
})
