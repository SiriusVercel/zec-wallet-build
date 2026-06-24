// Componentes UI reutilizáveis — ZEC Wallet design system
import React from 'react'
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, ViewStyle, TextStyle,
} from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { ArrowDownIcon, ArrowUpIcon } from './Icons'

// ── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps {
  label: string
  onPress: () => void
  variant?: 'primary' | 'outline' | 'ghost'
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const isPrimary = variant === 'primary'
  const isOutline = variant === 'outline'
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.btn,
        isPrimary && styles.btnPrimary,
        isOutline && styles.btnOutline,
        isPrimary && (disabled || loading) && styles.btnPrimaryDisabled,
        !isPrimary && (disabled || loading) && styles.btnDisabled,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={isPrimary ? Colors.bg : Colors.zec} />
        : <Text style={[
            styles.btnLabel,
            isOutline && styles.btnLabelOutline,
            isPrimary && (disabled || loading) && styles.btnLabelDisabled,
          ]}>
            {label}
          </Text>
      }
    </TouchableOpacity>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>
}

// ── Input ────────────────────────────────────────────────────────────────────

interface InputProps {
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  label?: string
  multiline?: boolean
  secureTextEntry?: boolean
  style?: ViewStyle
  mono?: boolean
}

export function Input({ value, onChangeText, placeholder, label, multiline, secureTextEntry, style, mono }: InputProps) {
  return (
    <View style={style}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCorrect={false}
        autoCapitalize="none"
        style={[styles.input, multiline && styles.inputMulti, mono && styles.inputMono]}
      />
    </View>
  )
}

// ── BalanceDisplay ────────────────────────────────────────────────────────────

interface BalanceProps {
  zec: string
  usd?: string
  syncing?: boolean
}

export function BalanceDisplay({ zec, usd, syncing }: BalanceProps) {
  return (
    <View style={styles.balanceWrap}>
      {syncing && (
        <View style={styles.syncBadge}>
          <ActivityIndicator size="small" color={Colors.zec} />
          <Text style={styles.syncText}>syncing...</Text>
        </View>
      )}
      <Text style={styles.balanceAmount}>{zec}</Text>
      <Text style={styles.balanceCurrency}>ZEC</Text>
      {usd && <Text style={styles.balanceUsd}>${usd} USD</Text>}
    </View>
  )
}

// ── SeedWord ──────────────────────────────────────────────────────────────────

export function SeedWord({ index, word }: { index: number; word: string }) {
  return (
    <View style={styles.seedWord}>
      <Text style={styles.seedIndex}>{index + 1}</Text>
      <Text style={styles.seedText}>{word}</Text>
    </View>
  )
}

// ── TxRow ─────────────────────────────────────────────────────────────────────

interface TxRowProps {
  amount: number
  timestamp: number
  confirmed: boolean
  txid: string
  onPress?: () => void
}

export function TxRow({ amount, timestamp, confirmed, txid, onPress }: TxRowProps) {
  const isIn   = amount > 0
  const date   = new Date(timestamp * 1000).toLocaleDateString()
  const zec    = Math.abs(amount / 1e8).toFixed(4)
  return (
    <TouchableOpacity onPress={onPress} style={styles.txRow} activeOpacity={0.7}>
      <View style={[styles.txIcon, { backgroundColor: isIn ? 'rgba(0,200,150,0.15)' : 'rgba(255,68,68,0.15)' }]}>
        {isIn
          ? <ArrowDownIcon size={16} color={Colors.success} />
          : <ArrowUpIcon size={16} color={Colors.error} />}
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txId}>{txid.slice(0, 12)}...</Text>
        <Text style={styles.txDate}>{date} {!confirmed && '· pending'}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isIn ? Colors.success : Colors.error }]}>
        {isIn ? '+' : '-'}{zec} ZEC
      </Text>
    </TouchableOpacity>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  btn: {
    height: 56, borderRadius: Radius.full, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: Spacing.xl,
  },
  btnPrimary:  { backgroundColor: Colors.zec },
  btnOutline:  { borderWidth: 1.5, borderColor: Colors.zec },
  btnDisabled: { opacity: 0.38 },
  btnPrimaryDisabled: { backgroundColor: '#5A4600' },
  btnLabel:         { ...Typography.bodyBold, color: Colors.bg, fontSize: 16 },
  btnLabelOutline:  { color: Colors.zec },
  btnLabelDisabled: { color: Colors.textMuted },

  card: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },

  inputLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.bgInput, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, color: Colors.textPrimary, padding: Spacing.md,
    ...Typography.body,
  },
  inputMulti: { height: 120, textAlignVertical: 'top' },
  inputMono:  { ...Typography.mono },

  balanceWrap:    { alignItems: 'center', paddingVertical: Spacing.xl },
  syncBadge:      { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: 6 },
  syncText:       { ...Typography.caption, color: Colors.textSecondary },
  balanceAmount:  { fontSize: 52, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -2 },
  balanceCurrency:{ ...Typography.heading3, color: Colors.zec, marginTop: -4 },
  balanceUsd:     { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.xs },

  seedWord: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgInput,
    borderRadius: Radius.sm, padding: Spacing.sm, gap: Spacing.sm, flex: 1, margin: 4,
  },
  seedIndex: { ...Typography.caption, color: Colors.textMuted, width: 20, textAlign: 'right' },
  seedText:  { ...Typography.mono, color: Colors.textPrimary } as TextStyle,

  txRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.md,
  },
  txIcon:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txInfo:   { flex: 1 },
  txId:     { ...Typography.mono, color: Colors.textPrimary },
  txDate:   { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  txAmount: { ...Typography.bodyBold },
})
