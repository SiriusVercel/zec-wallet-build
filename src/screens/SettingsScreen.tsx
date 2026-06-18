import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, Switch, Modal, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import { Colors, Typography, Spacing, Radius } from '../theme'
import i18n from '../i18n'
import {
  isBiometricAvailable,
  isBiometricEnabled,
  setBiometricEnabled,
  authenticate,
} from '../services/biometric'
import { getSeed, getWalletInfo, clearWallet } from '../services/zcash'
import { exportBackupKey } from '../services/backup'
import { KeyIcon, TrashIcon, ChevronRightIcon, WarningIcon } from '../components/Icons'

interface Props {
  onWalletDeleted: () => void
}

export default function SettingsScreen({ onWalletDeleted }: Props) {
  const { t } = useTranslation()
  const [address,            setAddress]            = useState<string | null>(null)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled,   setBiometricEnabledState] = useState(false)
  const [seedWords,          setSeedWords]          = useState<string[]>([])
  const [seedModalVisible,   setSeedModalVisible]   = useState(false)
  const [loadingSeed,        setLoadingSeed]        = useState(false)

  useEffect(() => {
    async function init() {
      const [available, enabled, info] = await Promise.all([
        isBiometricAvailable(),
        isBiometricEnabled(),
        getWalletInfo(),
      ])
      setBiometricAvailable(available)
      setBiometricEnabledState(enabled)
      if (info) setAddress(info.address)
    }
    init()
  }, [])

  async function handleBiometricToggle(value: boolean) {
    if (value) {
      // Enabling: require authentication first
      const ok = await authenticate(t('settings.authPromptEnable'))
      if (!ok) return
    }
    await setBiometricEnabled(value)
    setBiometricEnabledState(value)
  }

  async function handleViewSeed() {
    setLoadingSeed(true)
    try {
      const ok = await authenticate(t('settings.authPromptPhrase'))
      if (!ok) {
        setLoadingSeed(false)
        return
      }
      const seed = await getSeed()
      if (!seed) {
        Alert.alert(t('common.error'), 'Recovery phrase not found.')
        setLoadingSeed(false)
        return
      }
      setSeedWords(seed.trim().split(/\s+/))
      setSeedModalVisible(true)
    } finally {
      setLoadingSeed(false)
    }
  }

  function handleDeleteWallet() {
    Alert.alert(
      t('settings.deleteConfirm1Title'),
      t('settings.deleteConfirm1Message'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('settings.deleteConfirm2Title'),
              t('settings.deleteConfirm2Message'),
              [
                { text: t('settings.cancel'), style: 'cancel' },
                {
                  text: t('settings.deleteForever'),
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

  async function handleExportBackupKey() {
    const ok = await authenticate(t('settings.authPromptPhrase'))
    if (!ok) return
    const key = await exportBackupKey()
    if (!key) {
      Alert.alert(t('common.error'), 'No recovery key found for this wallet.')
      return
    }
    await Clipboard.setStringAsync(key)
    Alert.alert(
      'Recovery Key Copied',
      'Your recovery key has been copied to clipboard. Store it securely — it is needed to recover your wallet from server backup.',
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.pageTitle}>{t('settings.title')}</Text>

        {/* ── SECURITY ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.securitySection')}</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.rowLabel}>{t('settings.faceId')}</Text>
                <Text style={styles.rowHint}>
                  {biometricAvailable
                    ? t('settings.faceIdSub')
                    : 'Not available on this device'}
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricAvailable}
                trackColor={{ false: Colors.border, true: Colors.zec }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* ── RECOVERY ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.recoverySection')}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleViewSeed}
              disabled={loadingSeed}
            >
              {loadingSeed ? (
                <ActivityIndicator size="small" color={Colors.zec} />
              ) : (
                <View style={styles.actionLabelRow}>
                  <KeyIcon size={18} color={Colors.zec} />
                  <Text style={styles.actionLabel}>{t('settings.viewPhrase')}</Text>
                </View>
              )}
              <ChevronRightIcon size={20} color={Colors.textMuted} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.actionRow} onPress={handleExportBackupKey}>
              <View style={styles.actionLabelRow}>
                <KeyIcon size={18} color={Colors.purple} />
                <Text style={[styles.actionLabel, { color: Colors.purple }]}>Export Recovery Key</Text>
              </View>
              <ChevronRightIcon size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── WALLET ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.walletSection')}</Text>
          <View style={styles.card}>
            <View style={styles.addrBlock}>
              <Text style={styles.addrLabel}>{t('settings.address')}</Text>
              {address ? (
                <Text style={styles.addrValue} selectable>
                  {address}
                </Text>
              ) : (
                <Text style={styles.rowHint}>Loading…</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── LANGUAGE ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.languageSection')}</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.rowLabel}>{t('settings.language')}</Text>
              </View>
              <Text style={styles.rowHint}>{i18n.language.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* ── DANGER ZONE ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.error }]}>{t('settings.dangerSection')}</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteWallet}>
            <View style={styles.deleteBtnRow}>
              <TrashIcon size={18} color={Colors.error} />
              <Text style={styles.deleteBtnLabel}>{t('settings.deleteWallet')}</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.deleteHint}>
            Your ZEC stays on the blockchain. You can restore anytime with your recovery phrase.
          </Text>
        </View>
      </ScrollView>

      {/* ── Recovery phrase modal ── */}
      <Modal
        visible={seedModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSeedModalVisible(false)}
      >
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <Text style={modal.title}>{t('settings.phraseModalTitle')}</Text>
            <View style={modal.warningRow}>
              <WarningIcon size={16} color={Colors.warning} />
              <Text style={modal.warning}>{t('settings.phraseWarning')}</Text>
            </View>
            <ScrollView contentContainerStyle={modal.grid}>
              {seedWords.map((word, i) => (
                <View key={i} style={modal.wordCell}>
                  <Text style={modal.wordNum}>{i + 1}</Text>
                  <Text style={modal.wordText}>{word}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={modal.closeBtn}
              onPress={() => {
                setSeedModalVisible(false)
                setSeedWords([])
              }}
            >
              <Text style={modal.closeBtnText}>{t('settings.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.bg },
  container:     { flexGrow: 1, padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  pageTitle:     { ...Typography.heading2, color: Colors.textPrimary },
  section:       { gap: Spacing.sm },
  sectionTitle:  { ...Typography.caption, color: Colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },
  card:          { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  switchRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md },
  switchLabel:   { flex: 1, marginRight: Spacing.md },
  rowLabel:      { ...Typography.bodyBold, color: Colors.textPrimary },
  rowHint:       { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  actionRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  actionLabelRow:{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actionLabel:   { ...Typography.bodyBold, color: Colors.zec },
  deleteBtnRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addrBlock:     { paddingVertical: Spacing.md, gap: Spacing.xs },
  addrLabel:     { ...Typography.caption, color: Colors.textMuted },
  addrValue:     { ...Typography.mono, color: Colors.textPrimary, fontSize: 11, lineHeight: 17 },
  deleteBtn:     { borderWidth: 1.5, borderColor: Colors.error, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center' },
  deleteBtnLabel:{ ...Typography.bodyBold, color: Colors.error },
  deleteHint:    { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  divider:       { height: 1, backgroundColor: Colors.border },
})

const modal = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet:       { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl, maxHeight: '85%' },
  title:       { ...Typography.heading3, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm },
  warningRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, justifyContent: 'center', marginBottom: Spacing.md },
  warning:     { ...Typography.caption, color: Colors.warning, flex: 1, lineHeight: 18 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: Spacing.lg },
  wordCell:    { width: '30%', backgroundColor: Colors.bgElevated, borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordNum:     { fontSize: 10, color: Colors.zec, width: 18 },
  wordText:    { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  closeBtn:    { backgroundColor: Colors.bgElevated, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  closeBtnText:{ ...Typography.bodyBold, color: Colors.textPrimary },
})
