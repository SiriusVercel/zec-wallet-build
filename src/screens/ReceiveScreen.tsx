import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Share,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { getWalletInfo } from '../services/zcash'
import { ArrowLeftIcon, CheckIcon } from '../components/Icons'
import { scheduleClipboardClear } from '../services/security'

interface Props { onBack: () => void }

export default function ReceiveScreen({ onBack }: Props) {
  const { t } = useTranslation()
  const [address,  setAddress]  = useState<string>('')
  const [loading,  setLoading]  = useState<boolean>(true)
  const [copied,   setCopied]   = useState<boolean>(false)
  const clipboardClearRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    getWalletInfo()
      .then(w => { if (w) setAddress(w.address) })
      .finally(() => setLoading(false))
  }, [])

  async function copyAddress() {
    await Clipboard.setStringAsync(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    if (clipboardClearRef.current) clipboardClearRef.current()
    clipboardClearRef.current = scheduleClipboardClear(120_000)
  }

  async function shareAddress() {
    await Share.share({ message: address, title: 'My ZEC Address' })
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <ArrowLeftIcon size={16} color={Colors.zec} />
            <Text style={styles.back}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('receive.title')}</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* QR Code */}
        <View style={styles.qrWrap}>
          {loading ? (
            <View style={styles.qrBox}>
              <ActivityIndicator size="large" color={Colors.zec} />
            </View>
          ) : address ? (
            <View style={styles.qrBox}>
              <QRCode
                value={address}
                size={200}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            </View>
          ) : (
            <View style={styles.qrBox}>
              <Text style={styles.qrError}>No address</Text>
            </View>
          )}
        </View>

        {/* Address text */}
        <Text style={styles.addressText} selectable>
          {loading ? 'Loading…' : address || '—'}
        </Text>

        {/* Copy + Share */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionPrimary]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); copyAddress() }}
            disabled={loading || !address}
          >
            <View style={styles.actionLabelRow}>
              {copied && <CheckIcon size={14} color={Colors.bg} />}
              <Text style={styles.actionLabelPrimary}>
                {copied ? t('receive.copied') : t('receive.copy')}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); shareAddress() }}
            disabled={loading || !address}
          >
            <Text style={styles.actionLabel}>{t('receive.share')}</Text>
          </TouchableOpacity>
        </View>

        {/* Done */}
        <TouchableOpacity style={styles.doneBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onBack() }}>
          <Text style={styles.doneBtnLabel}>{t('receive.done')}</Text>
        </TouchableOpacity>

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <View style={styles.privacyDot} />
          <Text style={styles.privacyText}>
            This unified address (u1) accepts both shielded and transparent payments. Shielded transactions encrypt sender, receiver, and amount on-chain.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { flexGrow: 1, padding: Spacing.lg, gap: Spacing.md, alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back:    { ...Typography.body, color: Colors.zec },
  title: { ...Typography.heading3, color: Colors.textPrimary },

  qrWrap: { alignItems: 'center', marginVertical: Spacing.sm },
  qrBox: {
    width: 232, height: 232, backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  qrError: { color: Colors.textMuted, ...Typography.caption },

  addressText: {
    ...Typography.mono, color: Colors.textSecondary,
    fontSize: 11, lineHeight: 18, textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },

  actions: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  actionBtn: {
    flex: 1, borderRadius: Radius.full, paddingVertical: Spacing.md,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.zec,
  },
  actionPrimary:      { backgroundColor: Colors.zec },
  actionLabelRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionLabelPrimary: { ...Typography.bodyBold, color: Colors.bg },
  actionLabel:        { ...Typography.bodyBold, color: Colors.zec },

  doneBtn: {
    width: '100%', borderRadius: Radius.full, paddingVertical: Spacing.md,
    alignItems: 'center', backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.sm,
  },
  doneBtnLabel: { ...Typography.bodyBold, color: Colors.textPrimary },

  privacyNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  privacyDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.zec, marginTop: 5,
  },
  privacyText: {
    flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 18,
  },
})
