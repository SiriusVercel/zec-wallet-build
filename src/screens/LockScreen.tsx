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
