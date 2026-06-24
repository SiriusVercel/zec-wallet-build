import React, { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Animated,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '../theme'
import { ZecLogo } from '../components/ZecLogo'
import { PlusCircleIcon, RotateCCWIcon } from '../components/Icons'

interface Props {
  onCreateWallet: () => void
  onImportWallet: () => void
}

export default function OnboardingScreen({ onCreateWallet, onImportWallet }: Props) {
  const { t } = useTranslation()

  const glowOpacity       = useRef(new Animated.Value(0.04)).current
  const actionsOpacity    = useRef(new Animated.Value(0)).current
  const actionsTranslate  = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.15, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.04, duration: 2000, useNativeDriver: true }),
      ])
    ).start()

    Animated.parallel([
      Animated.timing(actionsOpacity, {
        toValue: 1, duration: 400,
        easing: (t) => t * (2 - t),
        useNativeDriver: true,
      }),
      Animated.timing(actionsTranslate, {
        toValue: 0, duration: 400,
        easing: (t) => t * (2 - t),
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logoSection}>
          <View style={styles.glowWrapper}>
            <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
            <ZecLogo size={90} />
          </View>
          <Text style={styles.appName}>{t('appName')}</Text>
          <Text style={styles.tagline}>PRIVACY · FREEDOM · ZEC</Text>
        </View>

        <Animated.View
          style={[
            styles.actions,
            { opacity: actionsOpacity, transform: [{ translateY: actionsTranslate }] },
          ]}
        >
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onCreateWallet() }}
            activeOpacity={0.85}
          >
            <PlusCircleIcon size={22} color="#000" />
            <Text style={styles.btnPrimaryLabel}>{t('onboarding.createWallet')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onImportWallet() }}
            activeOpacity={0.85}
          >
            <RotateCCWIcon size={22} color={Colors.textSecondary} />
            <Text style={styles.btnSecondaryLabel}>{t('onboarding.restoreWallet')}</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            {t('onboarding.terms')}
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, justifyContent: 'space-between', padding: Spacing.lg, paddingBottom: Spacing.xxl },

  logoSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  glowWrapper: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.zec,
  },

  appName: { fontSize: 36, fontWeight: '900' as const, color: Colors.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 13, fontWeight: '600' as const, color: Colors.zec, letterSpacing: 3 },

  actions: { gap: Spacing.md },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.zec, borderRadius: Radius.full,
    height: 58, gap: Spacing.sm,
    shadowColor: Colors.zec, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  btnPrimaryLabel: { fontSize: 17, fontWeight: '800' as const, color: '#000' },

  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    height: 58, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  btnSecondaryLabel: { fontSize: 17, fontWeight: '600' as const, color: Colors.textSecondary },

  legal: {
    textAlign: 'center', fontSize: 12,
    color: Colors.textMuted, lineHeight: 18, marginTop: Spacing.xs,
  },
})
