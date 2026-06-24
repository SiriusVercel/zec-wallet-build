import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Vibration, Animated,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Typography } from '../theme'
import { ZecLogo } from '../components/ZecLogo'

interface Props {
  title?: string
  subtitle?: string
  onSuccess: (pin: string) => void
  onCancel?: () => void
  verify?: (pin: string) => Promise<boolean>
  maxAttempts?: number
}

const KEYS = [
  { val: '1', hint: '' },
  { val: '2', hint: 'ABC' },
  { val: '3', hint: 'DEF' },
  { val: '4', hint: 'GHI' },
  { val: '5', hint: 'JKL' },
  { val: '6', hint: 'MNO' },
  { val: '7', hint: 'PQRS' },
  { val: '8', hint: 'TUV' },
  { val: '9', hint: 'WXYZ' },
  { val: '',  hint: '' },
  { val: '0', hint: '' },
  { val: '⌫', hint: '' },
]

function Key({ keyVal, hint, onPress }: { keyVal: string; hint: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current

  function handlePress() {
    if (!keyVal) return
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 100, useNativeDriver: true }),
    ]).start()
    onPress()
  }

  if (!keyVal) return <View style={styles.keyEmpty} />

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} style={styles.keyTouch}>
      <Animated.View style={[styles.key, { transform: [{ scale }] }]}>
        <Text style={keyVal === '⌫' ? styles.keyDel : styles.keyNum}>{keyVal}</Text>
        {hint ? <Text style={styles.keyHint}>{hint}</Text> : null}
      </Animated.View>
    </TouchableOpacity>
  )
}

export default function PinScreen({
  title = 'Enter PIN',
  subtitle = 'Enter your 6-digit PIN',
  onSuccess,
  onCancel,
  verify,
  maxAttempts = 5,
}: Props) {
  const [pin,      setPin]      = useState('')
  const [error,    setError]    = useState('')
  const [attempts, setAttempts] = useState(0)

  const fadeIn   = useRef(new Animated.Value(0)).current
  const slideUp  = useRef(new Animated.Value(30)).current
  const dotsX    = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }, [])

  useEffect(() => {
    if (pin.length === 6) handleComplete(pin)
  }, [pin])

  async function handleComplete(code: string) {
    if (verify) {
      const ok = await verify(code)
      if (ok) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onSuccess(code)
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Vibration.vibrate([0, 60, 40, 60, 40, 60])
        // Shake dots
        Animated.sequence([
          Animated.timing(dotsX, { toValue: -12, duration: 60, useNativeDriver: true }),
          Animated.timing(dotsX, { toValue: 12,  duration: 60, useNativeDriver: true }),
          Animated.timing(dotsX, { toValue: -8,  duration: 60, useNativeDriver: true }),
          Animated.timing(dotsX, { toValue: 0,   duration: 60, useNativeDriver: true }),
        ]).start()
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setError(
          newAttempts >= maxAttempts
            ? 'Too many attempts.'
            : `Incorrect PIN — ${maxAttempts - newAttempts} attempt${maxAttempts - newAttempts === 1 ? '' : 's'} left`
        )
        setPin('')
      }
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onSuccess(code)
    }
  }

  function handleKey(key: string) {
    if (attempts >= maxAttempts) return
    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      setError('')
      return
    }
    if (!key || pin.length >= 6) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPin(p => p + key)
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.inner, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        <ZecLogo size={52} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Dots */}
        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: dotsX }] }]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </Animated.View>

        {error
          ? <Text style={styles.error}>{error}</Text>
          : <View style={{ height: 18 }} />
        }

        {/* Numpad */}
        <View style={styles.pad}>
          {KEYS.map((k, i) => (
            <Key key={i} keyVal={k.val} hint={k.hint} onPress={() => handleKey(k.val)} />
          ))}
        </View>

        {onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} activeOpacity={0.6}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  )
}

const KEY_SIZE = 76

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  title:    { ...Typography.heading2, color: Colors.textPrimary, marginTop: Spacing.md },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  dotsRow:  { flexDirection: 'row', gap: 18, marginVertical: Spacing.md },
  dot: {
    width: 13, height: 13, borderRadius: 999,
    borderWidth: 1.5, borderColor: Colors.borderLight,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.zec,
    borderColor: Colors.zec,
    shadowColor: Colors.zec,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  error:     { ...Typography.caption, color: Colors.error, textAlign: 'center' },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: KEY_SIZE * 3 + Spacing.md * 2,
    gap: Spacing.md,
    marginTop: Spacing.sm,
    justifyContent: 'center',
  },
  keyTouch:  { width: KEY_SIZE, height: KEY_SIZE },
  key: {
    width: KEY_SIZE, height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  keyEmpty:  { width: KEY_SIZE, height: KEY_SIZE },
  keyNum:    { fontSize: 24, fontWeight: '300' as const, color: Colors.textPrimary, letterSpacing: 0 },
  keyHint:   { fontSize: 8, fontWeight: '600' as const, color: Colors.textMuted, letterSpacing: 1.5 },
  keyDel:    { fontSize: 18, color: Colors.textSecondary },
  cancelBtn: { marginTop: Spacing.sm, padding: Spacing.sm },
  cancelLabel: { ...Typography.body, color: Colors.textMuted },
})
