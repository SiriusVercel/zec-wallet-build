// src/screens/CreateWalletScreen.tsx
import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { usePreventScreenCapture } from 'expo-screen-capture'
import { Colors, Spacing, Radius, Typography } from '../theme'
import { generateWallet } from '../services/zingo'
import { saveSeed, saveWalletInfo } from '../services/zcash'
import { backupSeed } from '../services/backup'
import { CheckCircleIcon } from '../components/Icons'

type Step = 'generating' | 'backup' | 'quiz' | 'done'

interface QuizQuestion {
  index: number
  correct: string
  options: string[]
}

function pickQuizQuestions(words: string[]): QuizQuestion[] {
  const indices = Array.from({ length: words.length }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const positions = indices.slice(0, 3).sort((a, b) => a - b)
  return positions.map(i => {
    const correct = words[i]
    const distractors = words
      .filter((_, j) => j !== i)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
    const options = [...distractors, correct].sort(() => Math.random() - 0.5)
    return { index: i, correct, options }
  })
}

interface Props {
  onDone: () => void
  onBack: () => void
}

export function CreateWalletScreen({ onDone, onBack }: Props) {
  const { t } = useTranslation()
  usePreventScreenCapture()
  const [step, setStep] = useState<Step>('generating')
  const [words, setWords] = useState<string[]>([])
  const [walletData, setWalletData] = useState<{ address: string; ufvk: string; birthday: number } | null>(null)
  const [quiz, setQuiz] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setError(null)
    try {
      const result = await generateWallet()
      const mnemonicWords = result.mnemonic.trim().split(/\s+/)
      setWords(mnemonicWords)
      setWalletData({ address: result.address, ufvk: result.ufvk, birthday: result.birthday })
      setStep('backup')
    } catch (e: any) {
      setError(e.message || 'Failed to generate wallet')
    }
  }, [])

  React.useEffect(() => {
    generate()
  }, [generate])

  const startQuiz = () => {
    const q = pickQuizQuestions(words)
    setQuiz(q)
    setAnswers({})
    setStep('quiz')
  }

  const handleAnswer = (questionIndex: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: answer }))
  }

  const submitQuiz = async () => {
    const allCorrect = quiz.every(q => answers[q.index] === q.correct)
    if (!allCorrect) {
      Alert.alert(t('common.error'), t('createWallet.incorrectAnswers'))
      setAnswers({})
      return
    }
    try {
      const seedPhrase = words.join(' ')
      await saveSeed(seedPhrase)
      await saveWalletInfo(walletData!)
      backupSeed(seedPhrase, walletData ?? undefined)
      setStep('done')
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || 'Failed to save wallet')
    }
  }

  if (step === 'generating') {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.btn} onPress={generate}>
              <Text style={styles.btnText}>{t('createWallet.retry')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={Colors.zec} />
            <Text style={styles.subtitle}>{t('createWallet.generating')}</Text>
          </>
        )}
      </View>
    )
  }

  if (step === 'backup') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.pageHeader}>
            <TouchableOpacity onPress={onBack} style={styles.backIconBtn} activeOpacity={0.6}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.pageTitle}>{t('createWallet.title')}</Text>
            <View style={styles.backIconBtn} />
          </View>
          <Text style={styles.subtitle}>{t('createWallet.subtitle')}</Text>
          <View style={styles.wordsGrid}>
            {words.map((word, i) => (
              <View key={i} style={styles.wordCell}>
                <Text style={styles.wordNum}>{i + 1}</Text>
                <Text style={styles.wordText}>{word}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.btn} onPress={startQuiz}>
            <Text style={styles.btnText}>{t('createWallet.written')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (step === 'quiz') {
    const allAnswered = quiz.every(q => answers[q.index] !== undefined)
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.pageHeader}>
            <TouchableOpacity onPress={() => setStep('backup')} style={styles.backIconBtn} activeOpacity={0.6}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.pageTitle}>{t('createWallet.verifyTitle')}</Text>
            <View style={styles.backIconBtn} />
          </View>
          <Text style={styles.subtitle}>{t('createWallet.verifySubtitle')}</Text>
          {quiz.map((q, qi) => (
            <View key={qi} style={styles.quizBlock}>
              <Text style={styles.quizLabel}>{t('createWallet.wordPosition', { n: q.index + 1 })}</Text>
              <View style={styles.optionsRow}>
                {q.options.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.option,
                      answers[q.index] === opt && styles.optionSelected,
                    ]}
                    onPress={() => handleAnswer(q.index, opt)}
                  >
                    <Text style={[
                      styles.optionText,
                      answers[q.index] === opt && styles.optionTextSelected,
                    ]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.btn, !allAnswered && styles.btnDisabled]}
            onPress={submitQuiz}
            disabled={!allAnswered}
          >
            <Text style={styles.btnText}>{t('createWallet.confirm')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <CheckCircleIcon size={64} color={Colors.success} />
        <Text style={styles.title}>{t('createWallet.successTitle')}</Text>
        <Text style={styles.subtitle}>{t('createWallet.successSubtitle')}</Text>
        <TouchableOpacity style={styles.btn} onPress={onDone}>
          <Text style={styles.btnText}>{t('createWallet.goToWallet')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing.md, paddingBottom: 48 },
  center:    { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },

  // Header — title centered, back chevron on left, ghost spacer on right
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pageTitle: { ...Typography.heading3, color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  backIconBtn: {
    width: 40, height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 32, color: Colors.zec, marginTop: -4 },

  title:    { ...Typography.heading2, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: 'center', lineHeight: 20 },

  wordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.xl },
  wordCell: {
    width: '30%',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wordNum:  { fontSize: 10, color: Colors.zec, width: 18, fontWeight: '700' as const },
  wordText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' as const },

  btn:         { backgroundColor: Colors.zec, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', marginBottom: Spacing.sm },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: Colors.bg, fontWeight: '700' as const, fontSize: 16 },

  quizBlock: { marginBottom: Spacing.lg },
  quizLabel: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.sm, fontWeight: '600' as const },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  optionSelected:     { borderColor: Colors.zec, backgroundColor: Colors.bgElevated },
  optionText:         { color: Colors.textSecondary, fontSize: 14 },
  optionTextSelected: { color: Colors.zec, fontWeight: '600' as const },
  errorText:          { color: Colors.error, fontSize: 14, textAlign: 'center', marginBottom: Spacing.md },
})
