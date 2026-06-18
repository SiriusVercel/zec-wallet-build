import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { deriveWallet } from '../services/zingo'
import { saveSeed, saveWalletInfo } from '../services/zcash'
import { backupSeed } from '../services/backup'
import { ArrowLeftIcon } from '../components/Icons'

interface Props {
  onDone: () => void
  onBack: () => void
}

/** Returns words that fail basic BIP39 format: lowercase a-z, 3–8 chars */
function getInvalidWords(words: string[]): string[] {
  return words.filter(w => !/^[a-z]{3,8}$/.test(w))
}

export default function ImportWalletScreen({ onDone, onBack }: Props) {
  const { t } = useTranslation()
  const [phrase,   setPhrase]   = useState('')
  const [birthday, setBirthday] = useState('')
  const [loading,  setLoading]  = useState(false)

  // Derived state — memoised so it updates on every keystroke
  const words = useMemo(
    () => phrase.trim().split(/\s+/).filter(Boolean),
    [phrase],
  )
  const wordCount    = words.length
  const invalidWords = useMemo(() => getInvalidWords(words), [words])
  const shownInvalid = invalidWords.slice(0, 3)

  const countOk   = wordCount === 12 || wordCount === 24
  const validOk   = invalidWords.length === 0
  const canSubmit = countOk && validOk && !loading

  const wordCountColor =
    wordCount === 24 ? Colors.success :
    wordCount === 12 ? Colors.zec     :
    Colors.textMuted

  async function handleRestore() {
    if (!canSubmit) return
    const mnemonic     = words.join(' ')
    const birthdayNum  = birthday.trim() ? Number(birthday.trim()) : undefined

    setLoading(true)
    try {
      const derived = await deriveWallet(mnemonic, birthdayNum)
      await saveSeed(mnemonic)
      await saveWalletInfo({
        address:  derived.address,
        ufvk:     derived.ufvk,
        birthday: derived.birthday,
      })
      backupSeed(mnemonic)
      onDone()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      Alert.alert(t('common.error'), msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ArrowLeftIcon size={14} color={Colors.zec} />
                <Text style={styles.backLabel}>{t('importWallet.back')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{t('importWallet.title')}</Text>
          <Text style={styles.subtitle}>{t('importWallet.subtitle')}</Text>

          {/* Recovery phrase input */}
          <View style={styles.inputWrap}>
            <View style={styles.inputHeader}>
              <Text style={styles.inputLabel}>Recovery Phrase</Text>
              <Text style={[styles.wordCount, { color: wordCountColor }]}>
                {t('importWallet.wordCount', { count: wordCount, total: countOk ? '✓' : (wordCount < 12 ? 12 : 24) })}
              </Text>
            </View>

            <TextInput
              value={phrase}
              onChangeText={setPhrase}
              placeholder={t('importWallet.placeholder')}
              placeholderTextColor={Colors.textMuted}
              multiline
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              style={[
                styles.phraseInput,
                invalidWords.length > 0 && styles.phraseInputError,
                countOk && validOk && styles.phraseInputValid,
              ]}
            />

            {/* Invalid word hints — show at most 3 */}
            {shownInvalid.length > 0 && (
              <View style={styles.errorWrap}>
                <Text style={styles.errorLabel}>
                  {t('importWallet.invalidWords', { words: shownInvalid.join(', ') })}
                  {invalidWords.length > 3 ? ` +${invalidWords.length - 3} more` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Tip card */}
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              Words must be lowercase English, 3–8 characters each. ZCash wallets use 24-word phrases; some legacy wallets use 12.
            </Text>
          </View>

          {/* Birthday block (optional) */}
          <View style={styles.inputWrap}>
            <View style={styles.inputHeader}>
              <Text style={styles.inputLabel}>{t('importWallet.birthdayLabel')}</Text>
              <Text style={styles.inputHint}>{t('importWallet.birthdayHint')}</Text>
            </View>
            <TextInput
              value={birthday}
              onChangeText={setBirthday}
              placeholder={t('importWallet.birthdayPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              style={styles.singleInput}
            />
          </View>

          {/* Restore button / loading */}
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.zec} />
              <Text style={styles.loadingText}>{t('importWallet.restoring')}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.restoreBtn, !canSubmit && styles.restoreBtnDisabled]}
              onPress={handleRestore}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              <Text style={[styles.restoreBtnLabel, !canSubmit && styles.restoreBtnLabelDisabled]}>
                {t('importWallet.restore')}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.disclaimer}>
            Your wallet is protected by device-level encryption and optional biometric authentication.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex:      { flex: 1 },
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { flexGrow: 1, padding: Spacing.lg, gap: Spacing.md },

  header:    { flexDirection: 'row' },
  backBtn:   { paddingVertical: Spacing.xs },
  backLabel: { ...Typography.body, color: Colors.zec },

  title:    { ...Typography.heading2, color: Colors.textPrimary },
  subtitle: { ...Typography.body, color: Colors.textSecondary, lineHeight: 24 },

  inputWrap:   { gap: 8 },
  inputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputLabel:  { ...Typography.caption, color: Colors.textSecondary },
  inputHint:   { ...Typography.caption, color: Colors.textMuted },

  wordCount: { ...Typography.caption, fontWeight: '600' as const },

  phraseInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    padding: Spacing.md,
    minHeight: 140,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 22,
  },
  phraseInputError: {
    borderColor: Colors.error,
  },
  phraseInputValid: {
    borderColor: Colors.success,
  },

  errorWrap: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  errorLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  errorWords: {
    color: Colors.error,
    fontWeight: '600' as const,
    fontFamily: 'monospace',
  },

  singleInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    padding: Spacing.md,
    ...Typography.body,
  },

  tipCard: {
    backgroundColor: 'rgba(244,183,40,0.08)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.zecGlow,
  },
  tipText: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 18 },

  loadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  loadingText: { ...Typography.body, color: Colors.textSecondary },

  restoreBtn: {
    backgroundColor: Colors.zec,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  restoreBtnDisabled: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  restoreBtnLabel: {
    ...Typography.bodyBold,
    color: Colors.bg,
  },
  restoreBtnLabelDisabled: {
    color: Colors.textMuted,
  },

  disclaimer: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
})
