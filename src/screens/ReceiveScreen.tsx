import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Share,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { getWalletInfo } from '../services/zcash'

interface Props { onBack: () => void }

type Pool = 'shielded' | 'transparent'

export default function ReceiveScreen({ onBack }: Props) {
  const [address,  setAddress]  = useState<string>('')
  const [loading,  setLoading]  = useState<boolean>(true)
  const [pool,     setPool]     = useState<Pool>('shielded')
  const [copied,   setCopied]   = useState<boolean>(false)

  useEffect(() => {
    getWalletInfo()
      .then(w => { if (w) setAddress(w.address) })
      .finally(() => setLoading(false))
  }, [])

  async function copyAddress() {
    await Clipboard.setStringAsync(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareAddress() {
    await Share.share({ message: address, title: 'My ZEC Address' })
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Receive ZEC</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Pool toggle */}
        <View style={styles.poolToggle}>
          {(['shielded', 'transparent'] as Pool[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.poolBtn, pool === p && styles.poolBtnActive]}
              onPress={() => setPool(p)}
            >
              <Text style={[styles.poolBtnLabel, pool === p && styles.poolBtnLabelActive]}>
                {p === 'shielded' ? 'Shielded' : 'Transparent'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Warning for transparent */}
        {pool === 'transparent' && (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              ⚠️ Transparent addresses are visible on the public blockchain. Use shielded for privacy.
            </Text>
          </View>
        )}

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
            onPress={copyAddress}
            disabled={loading || !address}
          >
            <Text style={styles.actionLabelPrimary}>
              {copied ? '✓ Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={shareAddress}
            disabled={loading || !address}
          >
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Done */}
        <TouchableOpacity style={styles.doneBtn} onPress={onBack}>
          <Text style={styles.doneBtnLabel}>Done</Text>
        </TouchableOpacity>

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
  back:  { ...Typography.body, color: Colors.zec },
  title: { ...Typography.heading3, color: Colors.textPrimary },

  poolToggle: {
    flexDirection: 'row', backgroundColor: Colors.bgCard,
    borderRadius: Radius.full, padding: 4,
    borderWidth: 1, borderColor: Colors.border, width: '100%',
  },
  poolBtn:            { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.full, alignItems: 'center' },
  poolBtnActive:      { backgroundColor: Colors.zec },
  poolBtnLabel:       { ...Typography.caption, color: Colors.textSecondary },
  poolBtnLabelActive: { ...Typography.caption, color: Colors.bg, fontWeight: '700' },

  warnCard: {
    backgroundColor: 'rgba(255,179,71,0.1)', borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,179,71,0.3)',
    width: '100%',
  },
  warnText: { ...Typography.caption, color: Colors.warning, lineHeight: 18 },

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
  actionLabelPrimary: { ...Typography.bodyBold, color: Colors.bg },
  actionLabel:        { ...Typography.bodyBold, color: Colors.zec },

  doneBtn: {
    width: '100%', borderRadius: Radius.full, paddingVertical: Spacing.md,
    alignItems: 'center', backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.sm,
  },
  doneBtnLabel: { ...Typography.bodyBold, color: Colors.textPrimary },
})
