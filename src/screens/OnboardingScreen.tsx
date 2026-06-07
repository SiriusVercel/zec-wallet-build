// Onboarding — idêntico ao app real Zcash Wallet
// Dark warm brown bg, ZCash logo, "PRIVACY · FREEDOM · ZEC"
// 2 botões: Create New Wallet (gold) + Restore Wallet (dark)
import React from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, ImageBackground,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { ZecLogo } from '../components/ZecLogo'

interface Props {
  onCreateWallet: () => void
  onImportWallet: () => void
}

export default function OnboardingScreen({ onCreateWallet, onImportWallet }: Props) {
  const { t } = useTranslation()
  return (
    <SafeAreaView style={styles.safe}>
      {/* Subtle radial glow behind logo */}
      <View style={styles.glow} />

      <View style={styles.container}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <ZecLogo size={90} />
          <Text style={styles.appName}>{t('appName')}</Text>
          <Text style={styles.tagline}>PRIVACY · FREEDOM · ZEC</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onCreateWallet() }} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryIcon}>⊕</Text>
            <Text style={styles.btnPrimaryLabel}>{t('onboarding.createWallet')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSecondary} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onImportWallet() }} activeOpacity={0.85}>
            <Text style={styles.btnSecondaryIcon}>↺</Text>
            <Text style={styles.btnSecondaryLabel}>{t('onboarding.restoreWallet')}</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            {t('onboarding.terms')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  glow: {
    position: 'absolute', top: '20%', left: '50%',
    width: 300, height: 300, marginLeft: -150, marginTop: -150,
    borderRadius: 150,
    backgroundColor: 'rgba(244,196,42,0.06)',
  },
  container: { flex: 1, justifyContent: 'space-between', padding: Spacing.lg, paddingBottom: Spacing.xxl },

  logoSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  appName: { fontSize: 36, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 13, fontWeight: '600', color: Colors.zec, letterSpacing: 3 },

  actions: { gap: Spacing.md },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.zec, borderRadius: Radius.full,
    height: 58, gap: Spacing.sm,
    shadowColor: Colors.zec, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  btnPrimaryIcon:  { fontSize: 20, color: '#000' },
  btnPrimaryLabel: { fontSize: 17, fontWeight: '800', color: '#000' },

  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    height: 58, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  btnSecondaryIcon:  { fontSize: 20, color: Colors.textSecondary },
  btnSecondaryLabel: { fontSize: 17, fontWeight: '600', color: Colors.textSecondary },

  legal: {
    textAlign: 'center', fontSize: 12,
    color: Colors.textMuted, lineHeight: 18, marginTop: Spacing.xs,
  },
})
