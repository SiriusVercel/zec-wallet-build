// src/screens/CreateWalletScreen.tsx
import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { Colors } from '../theme'
import { generateWallet } from '../services/zingo'
import { saveSeed, saveWalletInfo } from '../services/zcash'

type Step = 'generating' | 'backup' | 'quiz' | 'done'

interface QuizQuestion {
  index: number
  correct: string
  options: string[]
}

function pickQuizQuestions(words: string[]): QuizQuestion[] {
  const positions = [4, 11, 19]
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
      Alert.alert('Incorrect', 'Some answers are wrong. Review your recovery phrase and try again.')
      setAnswers({})
      return
    }
    try {
      await saveSeed(words.join(' '))
      await saveWalletInfo(walletData!)
      setStep('done')
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save wallet')
    }
  }

  if (step === 'generating') {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.btn} onPress={generate}>
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={Colors.zec} />
            <Text style={styles.subtitle}>Generating your wallet...</Text>
          </>
        )}
      </View>
    )
  }

  if (step === 'backup') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your Recovery Phrase</Text>
        <Text style={styles.subtitle}>
          Write these 24 words down in order. This is the only way to recover your wallet.
        </Text>
        <View style={styles.wordsGrid}>
          {words.map((word, i) => (
            <View key={i} style={styles.wordCell}>
              <Text style={styles.wordNum}>{i + 1}</Text>
              <Text style={styles.wordText}>{word}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.btn} onPress={startQuiz}>
          <Text style={styles.btnText}>{"I've Written It Down →"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  if (step === 'quiz') {
    const allAnswered = quiz.every(q => answers[q.index] !== undefined)
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Verify Your Backup</Text>
        <Text style={styles.subtitle}>Select the correct word for each position.</Text>
        {quiz.map((q, qi) => (
          <View key={qi} style={styles.quizBlock}>
            <Text style={styles.quizLabel}>Word #{q.index + 1}</Text>
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
          <Text style={styles.btnText}>Confirm</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  return (
    <View style={styles.center}>
      <Text style={styles.doneIcon}>✓</Text>
      <Text style={styles.title}>Wallet Created!</Text>
      <Text style={styles.subtitle}>Your wallet is ready. Keep your recovery phrase safe.</Text>
      <TouchableOpacity style={styles.btn} onPress={onDone}>
        <Text style={styles.btnText}>Go to Wallet</Text>
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
  doneIcon: { fontSize: 56, marginBottom: 16 },
  errorText: { color: Colors.error, fontSize: 14, textAlign: 'center', marginBottom: 16 },
})
