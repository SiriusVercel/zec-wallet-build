import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { Button } from '../components/ui'
import { isValidZecAddress, estimateFee, sendTransaction } from '../services/zingo'
import { getSeed } from '../services/zcash'

interface Props { onBack: () => void }

type Step = 'input' | 'confirm' | 'done'

export default function SendScreen({ onBack }: Props) {
  const { t } = useTranslation()
  const [step,       setStep]       = useState<Step>('input')
  const [toAddr,     setToAddr]     = useState('')
  const [amount,     setAmount]     = useState('')
  const [memo,       setMemo]       = useState('')
  const [feeZat,     setFeeZat]     = useState(0)
  const [txid,       setTxid]       = useState('')
  const [loadingFee, setLoadingFee] = useState(false)
  const [sending,    setSending]    = useState(false)

  // double-send guard — set to true on first tap, never reset
  const sendingRef = useRef(false)

  const amountZat    = Math.floor(parseFloat(amount || '0') * 1e8)
  const addressValid = isValidZecAddress(toAddr)
  const canReview    = addressValid && amountZat > 0

  const feeZec   = feeZat / 1e8
  const totalZec = parseFloat(amount || '0') + feeZec

  // ── Step: input ──────────────────────────────────────────────────────────────

  async function handleReview() {
    if (!canReview) return
    setLoadingFee(true)
    try {
      const { fee } = await estimateFee(toAddr, amountZat)
      setFeeZat(fee)
      setStep('confirm')
    } catch (e: any) {
      Alert.alert('Fee Estimate Failed', e.message || 'Could not estimate fee')
    } finally {
      setLoadingFee(false)
    }
  }

  // ── Step: confirm ────────────────────────────────────────────────────────────

  async function handleSend() {
    if (sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    try {
      const mnemonic = await getSeed()
      if (!mnemonic) throw new Error('Seed not found — wallet may be corrupted')
      const result = await sendTransaction(mnemonic, toAddr, amountZat, memo || undefined)
      setTxid(result.txid)
      setStep('done')
    } catch (e: any) {
      Alert.alert('Send Failed', e.message || 'Unknown error')
      // release guard so user can retry
      sendingRef.current = false
      setSending(false)
    }
  }

  // ── Step: done ───────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <View style={styles.doneIconWrap}>
            <Text style={styles.doneCheckmark}>✓</Text>
          </View>
          <Text style={styles.doneTitle}>{t('send.sentTitle')}</Text>
          <View style={styles.txidCard}>
            <Text style={styles.txidLabel}>{t('send.txid').toUpperCase()}</Text>
            <Text style={styles.txidText} selectable>
              {txid.length > 32 ? txid.slice(0, 32) + '...' : txid}
            </Text>
          </View>
          <TouchableOpacity style={styles.backToWalletBtn} onPress={onBack}>
            <Text style={styles.backToWalletLabel}>{t('send.backToWallet')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Steps: input + confirm ───────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={step === 'confirm' ? () => setStep('input') : onBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.headerBack}>
                {step === 'confirm' ? t('send.edit') : `← ${t('send.cancel')}`}
              </Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {step === 'confirm' ? t('send.review') : t('send.title')}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          {/* ── STEP: INPUT ── */}
          {step === 'input' && (
            <>
              {/* Destination address */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('send.toAddress')}</Text>
                <TextInput
                  value={toAddr}
                  onChangeText={setToAddr}
                  placeholder="u1... / t1... / zs1..."
                  placeholderTextColor={Colors.textMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    toAddr.length > 0 && !addressValid && styles.inputError,
                  ]}
                />
                {toAddr.length > 0 && !addressValid && (
                  <Text style={styles.errorHint}>{t('send.invalidAddress')}</Text>
                )}
              </View>

              {/* Amount */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('send.amount')}</Text>
                <View style={styles.amountRow}>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.0000"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.amountInput]}
                  />
                  <View style={styles.currencyTag}>
                    <Text style={styles.currencyTagText}>ZEC</Text>
                  </View>
                </View>
              </View>

              {/* Memo */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>
                  {t('send.memo')}{' '}
                  <Text style={styles.fieldLabelSub}>(optional · shielded only)</Text>
                </Text>
                <TextInput
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="Private note visible only to recipient..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  maxLength={512}
                  style={[styles.input, styles.memoInput]}
                />
                <Text style={styles.fieldHint}>
                  {memo.length}/512 · only delivered to shielded addresses
                </Text>
              </View>

              {loadingFee ? (
                <View style={styles.feeLoadingRow}>
                  <ActivityIndicator color={Colors.zec} size="small" />
                  <Text style={styles.feeLoadingText}>{t('common.loading')}</Text>
                </View>
              ) : (
                <Button
                  label={t('send.review')}
                  onPress={handleReview}
                  variant="primary"
                  disabled={!canReview}
                />
              )}
            </>
          )}

          {/* ── STEP: CONFIRM ── */}
          {step === 'confirm' && (
            <>
              <View style={styles.confirmCard}>
                {/* To */}
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>{t('send.to').toUpperCase()}</Text>
                  <Text style={styles.confirmValue} numberOfLines={2}>
                    {toAddr.length > 20
                      ? toAddr.slice(0, 10) + '...' + toAddr.slice(-10)
                      : toAddr}
                  </Text>
                </View>

                <View style={styles.divider} />

                {/* Amount */}
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>{t('send.amountLabel').toUpperCase()}</Text>
                  <Text style={styles.confirmValue}>{parseFloat(amount).toFixed(8)} ZEC</Text>
                </View>

                {/* Fee */}
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>{t('send.fee').toUpperCase()}</Text>
                  <Text style={styles.confirmValue}>{feeZec.toFixed(8)} ZEC</Text>
                </View>

                {/* Total */}
                <View style={[styles.confirmRow, styles.totalRow]}>
                  <Text style={styles.confirmLabel}>{t('send.total').toUpperCase()}</Text>
                  <Text style={styles.totalValue}>{totalZec.toFixed(8)} ZEC</Text>
                </View>

                {/* Memo (if present) */}
                {memo ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.confirmRow}>
                      <Text style={styles.confirmLabel}>MEMO</Text>
                      <Text style={styles.confirmValue}>{memo}</Text>
                    </View>
                  </>
                ) : null}

                <View style={styles.divider} />

                {/* Pool */}
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>{t('send.pool').toUpperCase()}</Text>
                  <Text style={[styles.confirmValue, styles.poolValue]}>
                    {t('send.shieldedPool')}
                  </Text>
                </View>
              </View>

              {sending ? (
                <View style={styles.feeLoadingRow}>
                  <ActivityIndicator color={Colors.zec} size="small" />
                  <Text style={styles.feeLoadingText}>{t('send.sending')}</Text>
                </View>
              ) : (
                <Button
                  label={t('send.confirmSend')}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
                    handleSend()
                  }}
                  variant="primary"
                  disabled={sending}
                />
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { flexGrow: 1, padding: Spacing.lg, gap: Spacing.md },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  headerBack:  { ...Typography.body, color: Colors.zec },
  headerTitle: { ...Typography.heading3, color: Colors.textPrimary },

  // Fields
  fieldWrap:    { gap: 6 },
  fieldLabel:   { ...Typography.caption, color: Colors.textSecondary },
  fieldLabelSub:{ color: Colors.textMuted },
  fieldHint:    { ...Typography.caption, color: Colors.textMuted },
  errorHint:    { ...Typography.caption, color: Colors.error },

  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    padding: Spacing.md,
    ...Typography.body,
  },
  inputError: { borderColor: Colors.error },

  amountRow:       { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  amountInput:     { flex: 1, fontSize: 22, fontWeight: '600' as const },
  currencyTag:     { backgroundColor: Colors.zecGlow, borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.zec },
  currencyTagText: { ...Typography.bodyBold, color: Colors.zec },

  memoInput: { height: 80, textAlignVertical: 'top' as const },

  // Fee loading
  feeLoadingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, height: 56 },
  feeLoadingText: { ...Typography.body, color: Colors.textSecondary },

  // Confirm card
  confirmCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  confirmRow:   { gap: 4 },
  confirmLabel: { ...Typography.caption, color: Colors.textMuted, letterSpacing: 1 },
  confirmValue: { ...Typography.body, color: Colors.textPrimary },
  poolValue:    { color: Colors.success },
  divider:      { height: 1, backgroundColor: Colors.border },
  totalRow:     { paddingTop: Spacing.sm },
  totalValue:   { fontSize: 24, fontWeight: '700' as const, color: Colors.zec },

  // Done
  doneIconWrap:    { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.successBg, alignItems: 'center', justifyContent: 'center' },
  doneCheckmark:   { fontSize: 40, color: Colors.success },
  doneTitle:       { ...Typography.heading1, color: Colors.success },
  txidCard:        { backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, width: '100%', gap: 6 },
  txidLabel:       { ...Typography.caption, color: Colors.textMuted, letterSpacing: 1 },
  txidText:        { ...Typography.mono, color: Colors.textPrimary },
  backToWalletBtn: { marginTop: Spacing.md, paddingVertical: Spacing.sm },
  backToWalletLabel: { ...Typography.body, color: Colors.zec },
})
