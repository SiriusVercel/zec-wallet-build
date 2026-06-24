import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { isValidZecAddress, estimateFee, sendTransaction } from '../services/zingo'
import type { Balance } from '../services/zingo'
import { getSeed, getWalletInfo } from '../services/zcash'
import { encryptWithServerKey } from '../services/crypto'
import { startLiveActivity, updateLiveActivity } from '../services/liveActivity'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { Button } from '../components/ui'
import { ArrowLeftIcon, CheckIcon } from '../components/Icons'

// ── Binance palette ──────────────────────────────────────────────────────────
const B = {
  bg:        '#0B0E11',
  surface:   '#1E2329',
  border:    '#2B3139',
  yellow:    '#F0B90B',
  textPri:   '#EAECEF',
  textSec:   '#848E9C',
  error:     '#F6465D',
  success:   '#0ECB81',
}

interface Props {
  onBack:            () => void
  availableBalance?: Balance
  initialAddress?:   string
}

type Step = 'input' | 'confirm' | 'done'

export default function SendScreen({ onBack, availableBalance, initialAddress }: Props) {
  const [step,       setStep]       = useState<Step>('input')
  const [toAddr,     setToAddr]     = useState(initialAddress ?? '')
  const [amount,     setAmount]     = useState('')
  const [memo,       setMemo]       = useState('')
  const [feeZat,     setFeeZat]     = useState(0)
  const [txid,       setTxid]       = useState('')
  const [loadingFee, setLoadingFee] = useState(false)
  const [sending,    setSending]    = useState(false)
  const [sendError,  setSendError]  = useState('')

  const sendingRef = useRef(false)

  const amountZat    = Math.floor(parseFloat(amount || '0') * 1e8)
  const addressValid = toAddr.length > 0 && isValidZecAddress(toAddr)
  const canReview    = addressValid && amountZat > 0
  const feeZec       = feeZat / 1e8
  const totalZec     = parseFloat(amount || '0') + feeZec
  const displayFee   = feeZat > 0 ? feeZat : 10_000   // default ~0.0001 ZEC shown before estimate

  async function handleReview() {
    if (!canReview) return
    setLoadingFee(true)
    setSendError('')
    try {
      const { fee } = await estimateFee(toAddr, amountZat)
      setFeeZat(fee)
      setStep('confirm')
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Could not estimate fee')
    } finally {
      setLoadingFee(false)
    }
  }

  async function handleSend() {
    if (sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setSendError('')
    try {
      const effectiveFee = feeZat > 0 ? feeZat : 10_000
      if (availableBalance !== undefined && amountZat + effectiveFee > availableBalance.total) {
        setSendError('Insufficient balance (amount + fee exceeds available ZEC)')
        sendingRef.current = false
        setSending(false)
        return
      }
      const [seed, walletInfo] = await Promise.all([getSeed(), getWalletInfo()])
      if (!seed) throw new Error('Seed not found — wallet may be corrupted')
      const encryptedMnemonic = encryptWithServerKey(seed)
      startLiveActivity('send', amountZat / 1e8, toAddr).catch(() => {})
      const result = await sendTransaction(
        encryptedMnemonic, toAddr, amountZat, memo || undefined, walletInfo?.birthday,
      )
      updateLiveActivity(result.txid, 'confirmed').catch(() => {})
      setTxid(result.txid)
      setStep('done')
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Transaction failed')
      sendingRef.current = false
      setSending(false)
    }
  }

  // ── DONE ────────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <View style={s.successCircle}>
            <CheckIcon size={32} color={B.bg} />
          </View>
          <Text style={s.doneTitle}>Transaction Sent!</Text>
          <Text style={s.doneSub}>Your ZEC is on its way</Text>
          <View style={s.txidCard}>
            <Text style={s.txidLabel}>TRANSACTION ID</Text>
            <Text style={s.txidText} selectable>
              {txid.length > 32 ? txid.slice(0, 16) + '…' + txid.slice(-16) : txid}
            </Text>
          </View>
          <TouchableOpacity style={s.outlineBtn} onPress={onBack}>
            <Text style={s.outlineBtnLabel}>Back to Wallet</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── CONFIRM ─────────────────────────────────────────────────────────────────
  if (step === 'confirm') {
    const addrShort = toAddr.length > 20
      ? toAddr.slice(0, 10) + '…' + toAddr.slice(-10)
      : toAddr

    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

            {/* Header */}
            <View style={s.header}>
              <TouchableOpacity onPress={() => setStep('input')} style={s.backBtn}>
                <Text style={s.backChevron}>‹</Text>
              </TouchableOpacity>
              <Text style={s.headerTitle}>Review Order</Text>
              <View style={s.headerSpacer} />
            </View>

            {/* Amount display */}
            <View style={s.amountDisplay}>
              <Text style={s.sendingLabel}>Sending</Text>
              <Text style={s.amountBig}>{parseFloat(amount).toFixed(8)}</Text>
              <Text style={s.amountCurrency}>ZEC</Text>
            </View>

            {/* Detail card */}
            <View style={s.detailCard}>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>TO</Text>
                <Text style={s.detailValue} numberOfLines={1}>{addrShort}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>AMOUNT</Text>
                <Text style={s.detailValue}>{parseFloat(amount).toFixed(8)} ZEC</Text>
              </View>
              <View style={s.detailRow}>
                <Text style={[s.detailLabel, { color: B.yellow }]}>NETWORK FEE</Text>
                <Text style={s.detailValue}>{feeZec.toFixed(8)} ZEC</Text>
              </View>
              <View style={s.divider} />
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>TOTAL</Text>
                <Text style={[s.detailValue, { color: B.yellow, fontWeight: '700' as const }]}>
                  {totalZec.toFixed(8)} ZEC
                </Text>
              </View>
              <View style={s.divider} />
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>POOL</Text>
                <Text style={[s.detailValue, { color: B.success }]}>Shielded (Orchard)</Text>
              </View>
            </View>

            {/* Warning banner */}
            <View style={s.warningBanner}>
              <Text style={s.warningText}>
                ⚠  Crypto transactions are irreversible. Please verify the address before sending.
              </Text>
            </View>

            {sendError ? (
              <Text style={s.errorText}>{sendError}</Text>
            ) : null}

            {sending ? (
              <View style={s.sendingRow}>
                <ActivityIndicator color={B.yellow} size="small" />
                <Text style={s.sendingText}>Broadcasting…</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
                  handleSend()
                }}
                disabled={sending}
              >
                <Text style={s.primaryBtnLabel}>Confirm Send</Text>
              </TouchableOpacity>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // ── INPUT ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={onBack} style={s.backBtn}>
              <Text style={s.backChevron}>‹</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>Send ZEC</Text>
            <View style={s.headerSpacer} />
          </View>

          {/* To Address */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>TO</Text>
            <TextInput
              value={toAddr}
              onChangeText={v => setToAddr(v.replace(/\s/g, ''))}
              placeholder="u1... / t1... / zs1..."
              placeholderTextColor={B.textSec}
              autoCorrect={false}
              autoCapitalize="none"
              multiline={false}
              blurOnSubmit
              style={[
                s.input,
                toAddr.length > 0 && !addressValid && s.inputError,
              ]}
            />
            {toAddr.length > 0 && !addressValid && (
              <Text style={s.fieldError}>Invalid ZEC address</Text>
            )}
          </View>

          {/* Amount */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>AMOUNT</Text>
            <View style={s.amountRow}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00000000"
                placeholderTextColor={B.textSec}
                keyboardType="decimal-pad"
                style={[s.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 }]}
              />
              <View style={s.currencyTag}>
                <Text style={s.currencyTagText}>ZEC</Text>
              </View>
            </View>
            {availableBalance !== undefined && (
              <Text style={s.availableHint}>
                Available: {(availableBalance.total / 1e8).toFixed(8)} ZEC
              </Text>
            )}
          </View>

          {/* Fee Card — always visible */}
          <View style={s.feeCard}>
            <Text style={s.feeCardLabel}>NETWORK FEE</Text>
            <View style={s.feeCardRow}>
              <Text style={s.feeCardValue}>
                {(displayFee / 1e8).toFixed(8)} ZEC
              </Text>
              {feeZat === 0 && (
                <Text style={s.feeCardEst}>  (estimate)</Text>
              )}
            </View>
          </View>

          {/* Memo */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>
              MEMO  <Text style={s.fieldLabelSub}>(optional · shielded only)</Text>
            </Text>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder="Private note visible only to recipient…"
              placeholderTextColor={B.textSec}
              multiline
              maxLength={512}
              style={[s.input, s.memoInput]}
            />
            <Text style={s.memoCount}>{memo.length}/512</Text>
          </View>

          {sendError ? (
            <Text style={s.errorText}>{sendError}</Text>
          ) : null}

          {loadingFee ? (
            <View style={s.sendingRow}>
              <ActivityIndicator color={B.yellow} size="small" />
              <Text style={s.sendingText}>Estimating fee…</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.primaryBtn, !canReview && s.primaryBtnDisabled]}
              onPress={handleReview}
              disabled={!canReview}
            >
              <Text style={s.primaryBtnLabel}>Continue</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: B.bg },
  container: { flexGrow: 1, padding: 20, gap: 20, paddingBottom: 40 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  backBtn:      { width: 40, height: 40, justifyContent: 'center' },
  backChevron:  { fontSize: 32, color: B.yellow, marginTop: -4 },
  headerTitle:  { fontSize: 17, fontWeight: '700' as const, color: B.textPri },
  headerSpacer: { width: 40 },

  // Fields
  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontSize: 11, fontWeight: '600' as const,
    color: B.textSec, letterSpacing: 1.2,
  },
  fieldLabelSub: { fontSize: 11, fontWeight: '400' as const, color: B.textSec, letterSpacing: 0 },
  fieldError: { fontSize: 12, color: B.error, marginTop: 2 },

  input: {
    backgroundColor: B.surface,
    borderWidth: 1, borderColor: B.border,
    borderRadius: 8, padding: 14,
    fontSize: 15, color: B.textPri,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inputError: { borderColor: B.error },
  memoInput:  { height: 80, textAlignVertical: 'top' },
  memoCount:  { fontSize: 11, color: B.textSec, textAlign: 'right' },

  // Amount row
  amountRow: { flexDirection: 'row' },
  currencyTag: {
    backgroundColor: B.border, paddingHorizontal: 16,
    justifyContent: 'center', alignItems: 'center',
    borderTopRightRadius: 8, borderBottomRightRadius: 8,
    borderWidth: 1, borderColor: B.border,
  },
  currencyTagText: { fontSize: 13, fontWeight: '700' as const, color: B.textSec },
  availableHint:   { fontSize: 12, color: B.textSec },

  // Fee card
  feeCard: {
    backgroundColor: B.surface,
    borderWidth: 1, borderColor: B.border,
    borderRadius: 8, padding: 14, gap: 6,
  },
  feeCardLabel: { fontSize: 11, fontWeight: '600' as const, color: B.textSec, letterSpacing: 1.2 },
  feeCardRow:   { flexDirection: 'row', alignItems: 'center' },
  feeCardValue: { fontSize: 15, color: B.textPri, fontWeight: '600' as const },
  feeCardEst:   { fontSize: 12, color: B.textSec },

  // Primary button
  primaryBtn: {
    backgroundColor: B.yellow, borderRadius: 8,
    height: 52, alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnLabel:    { fontSize: 16, fontWeight: '700' as const, color: B.bg },

  // Outline button
  outlineBtn: {
    borderWidth: 1.5, borderColor: B.yellow, borderRadius: 8,
    height: 52, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, width: '100%',
  },
  outlineBtnLabel: { fontSize: 16, fontWeight: '700' as const, color: B.yellow },

  // Confirm step
  amountDisplay: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  sendingLabel:  { fontSize: 13, color: B.textSec },
  amountBig:     { fontSize: 36, fontWeight: '700' as const, color: B.textPri },
  amountCurrency:{ fontSize: 18, fontWeight: '700' as const, color: B.textSec },

  detailCard: {
    backgroundColor: B.surface, borderRadius: 12,
    borderWidth: 1, borderColor: B.border, padding: 16, gap: 14,
  },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 12, fontWeight: '600' as const, color: B.textSec, letterSpacing: 0.8 },
  detailValue: { fontSize: 14, color: B.textPri, maxWidth: '60%', textAlign: 'right' as const },
  divider:     { height: 1, backgroundColor: B.border },

  warningBanner: {
    borderLeftWidth: 3, borderLeftColor: B.yellow,
    backgroundColor: B.surface, borderRadius: 8,
    padding: 14,
  },
  warningText: { fontSize: 13, color: B.textSec, lineHeight: 20 },

  // Done step
  successCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: B.success,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  doneTitle: { fontSize: 22, fontWeight: '700' as const, color: B.textPri },
  doneSub:   { fontSize: 14, color: B.textSec },
  txidCard: {
    backgroundColor: B.surface, borderRadius: 8,
    borderWidth: 1, borderColor: B.border,
    padding: 16, width: '100%', gap: 6,
    marginTop: 8,
  },
  txidLabel: { fontSize: 11, color: B.textSec, letterSpacing: 1.2, fontWeight: '600' as const },
  txidText:  { fontSize: 13, color: B.textPri, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Loading
  sendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52 },
  sendingText: { fontSize: 14, color: B.textSec },

  // Error
  errorText: { fontSize: 13, color: B.error, textAlign: 'center' as const },
})
