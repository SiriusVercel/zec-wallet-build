import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Colors, Typography, Spacing } from '../theme'
import PinScreen from './PinScreen'
import { setPin } from '../services/pin'

interface Props {
  onDone: () => void
  onSkip: () => void
}

export default function PinSetupScreen({ onDone, onSkip }: Props) {
  const [step, setStep] = useState<'create' | 'confirm'>('create')
  const [firstPin, setFirstPin] = useState('')

  function handleCreate(pin: string) {
    setFirstPin(pin)
    setStep('confirm')
  }

  async function handleConfirm(pin: string) {
    if (pin !== firstPin) {
      return Promise.reject(new Error('mismatch'))
    }
    await setPin(pin)
    onDone()
    return true
  }

  if (step === 'confirm') {
    return (
      <PinScreen
        title="Confirm PIN"
        subtitle="Enter the same PIN again to confirm"
        onSuccess={() => {}}
        verify={async (pin) => {
          if (pin !== firstPin) return false
          await setPin(pin)
          onDone()
          return true
        }}
        onCancel={() => setStep('create')}
      />
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <PinScreen
        title="Create PIN"
        subtitle="Choose a 6-digit PIN to protect your wallet"
        onSuccess={handleCreate}
        onCancel={onSkip}
      />
      <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipLabel}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  skipBtn: { alignItems: 'center', paddingVertical: Spacing.lg, paddingBottom: 40 },
  skipLabel: { ...Typography.body, color: Colors.textMuted },
})
