// src/screens/CreateWalletScreen.tsx
import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../theme'
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
    setQuiz(pickQuizQuestions(words))
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
      backupSeed(seedPhrase)
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
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('createWallet.title')}</Text>
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
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>{t('createWallet.back')}</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  if (step === 'quiz') {
    const allAnswered = quiz.every(q => answers[q.index] !== undefined)
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('createWallet.verifyTitle')}</Text>
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
    )
  }

  return (
    <View style={styles.center}>
      <CheckCircleIcon size={64} color={Colors.success} />
      <Text style={styles.title}>{t('createWallet.successTitle')}</Text>
      <Text style={styles.subtitle}>{t('createWallet.successSubtitle')}</Text>
      <TouchableOpacity style={styles.btn} onPress={onDone}>
        <Text style={styles.btnText}>{t('createWallet.goToWallet')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24, textAlign: 'center', lineHeight: 20 },
  wordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 },
  wordCell: { width: '30%', backgroundColor: Colors.bgElevated, borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordNum: { fontSize: 10, color: Colors.zec, width: 18 },
  wordText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  btn: { backgroundColor: Colors.zec, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: Colors.bg, fontWeight: '700', fontSize: 16 },
  backBtn: { alignItems: 'center', padding: 12 },
  backText: { color: Colors.textSecondary, fontSize: 14 },
  quizBlock: { marginBottom: 24 },
  quizLabel: { fontSize: 14, color: Colors.textSecondary, marginBottom: 10 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  optionSelected: { borderColor: Colors.zec, backgroundColor: Colors.bgElevated },
  optionText: { color: Colors.textSecondary, fontSize: 14 },
  optionTextSelected: { color: Colors.zec, fontWeight: '600' },

  errorText: { color: Colors.error, fontSize: 14, textAlign: 'center', marginBottom: 16 },
})
