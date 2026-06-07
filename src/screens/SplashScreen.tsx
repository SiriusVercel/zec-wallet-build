import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Colors, Typography, Spacing } from '../theme'
import { walletExists } from '../services/zcash'

interface Props {
  onReady: (hasWallet: boolean) => void
}

export default function SplashScreen({ onReady }: Props) {
  const opacity = new Animated.Value(0)
  const scale   = new Animated.Value(0.85)

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, tension: 40, friction: 8, useNativeDriver: true }),
    ]).start()

    setTimeout(async () => {
      const has = await walletExists()
      onReady(has)
    }, 2000)
  }, [])

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrap, { opacity, transform: [{ scale }] }]}>
        {/* ZCash Z logo */}
        <View style={styles.logoOuter}>
          <View style={styles.logoInner}>
            <Text style={styles.logoZ}>Z</Text>
          </View>
        </View>
        <Text style={styles.appName}>ZEC Wallet</Text>
        <Text style={styles.tagline}>ZCash · Private · Shielded</Text>
      </Animated.View>

      <Animated.Text style={[styles.powered, { opacity }]}>
        Powered by Orchard
      </Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  logoWrap:  { alignItems: 'center', gap: Spacing.md },
  logoOuter: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: Colors.zec,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.zec, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 30, elevation: 20,
  },
  logoInner: { alignItems: 'center', justifyContent: 'center' },
  logoZ:     { fontSize: 56, fontWeight: '900', color: Colors.bg, letterSpacing: -2 },
  appName:   { ...Typography.heading1, color: Colors.textPrimary, letterSpacing: -0.5 },
  tagline:   { ...Typography.body, color: Colors.textSecondary, letterSpacing: 2 },
  powered:   {
    position: 'absolute', bottom: 48,
    ...Typography.caption, color: Colors.textMuted, letterSpacing: 1,
  },
})
