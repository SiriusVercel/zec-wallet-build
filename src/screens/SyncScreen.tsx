// SyncScreen.tsx — polling with exponential backoff, progress bar, ETA
import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { getSyncStatus, startSync, SyncStatus } from '../services/zingo'
import { POLL_INTERVAL_MS, POLL_MAX_RETRIES } from '../config'

interface Props {
  onBack: () => void
}

export default function SyncScreen({ onBack }: Props) {
  const [status,       setStatus]       = useState<SyncStatus | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retriesRef   = useRef(0)
  const mountedRef   = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    initSync()
    return () => {
      mountedRef.current = false
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  async function initSync() {
    try {
      await startSync()
    } catch { /* backend may already be syncing */ }
    scheduleNextPoll(0)
  }

  function scheduleNextPoll(consecutiveErrors: number) {
    if (!mountedRef.current) return

    const delay = consecutiveErrors === 0
      ? POLL_INTERVAL_MS
      : Math.min(POLL_INTERVAL_MS * Math.pow(2, consecutiveErrors - 1), 60000)

    timerRef.current = setTimeout(() => poll(consecutiveErrors), delay)
  }

  async function poll(consecutiveErrors: number) {
    if (!mountedRef.current) return

    try {
      const s = await getSyncStatus()
      if (!mountedRef.current) return

      retriesRef.current = 0
      setStatus(s)
      setErrorMessage(null)

      if (s.percent >= 100) {
        // Done — stop polling
        return
      }
      scheduleNextPoll(0)
    } catch {
      if (!mountedRef.current) return

      const newErrors = consecutiveErrors + 1
      retriesRef.current = newErrors

      if (newErrors >= POLL_MAX_RETRIES) {
        setErrorMessage('Sync timed out. Could not reach the node. Please try again.')
        return
      }
      scheduleNextPoll(newErrors)
    }
  }

  const percent      = status?.percent ?? 0
  const synced       = status?.synced  ?? 0
  const total        = status?.total   ?? 0
  const etaMinutes   = status?.eta && status.eta > 0
    ? Math.ceil(status.eta / 60)
    : null

  const blocksText = total > 0
    ? `${synced.toLocaleString()} / ${total.toLocaleString()}`
    : '...'

  const progressPct = `${Math.min(percent, 100).toFixed(0)}%`
  const progressWidth = `${Math.min(percent, 100)}%` as `${number}%`

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⚡</Text>
        </View>

        <Text style={styles.title}>Syncing ZCash Wallet</Text>
        <Text style={styles.subtitle}>
          Downloading compact blocks from lightwalletd.{'\n'}
          This may take a few minutes for new wallets.
        </Text>

        {/* Progress bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.pct}>{progressPct}</Text>
        </View>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>BLOCKS</Text>
            <Text style={styles.statValue}>{blocksText}</Text>
          </View>

          {etaMinutes !== null && (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>ETA</Text>
              <Text style={styles.statValue}>
                {etaMinutes < 1 ? '< 1 min' : `~${etaMinutes} min`}
              </Text>
            </View>
          )}

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>NODE</Text>
            <Text style={styles.statValue}>na.zec.rocks:443</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statLabel}>POOL</Text>
            <Text style={[styles.statValue, { color: Colors.zec }]}>🔒 Orchard</Text>
          </View>
        </View>

        {/* Error state */}
        {errorMessage && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.tip}>
          💡 ZCash uses compact block sync — your spending key never leaves this device.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  container: {
    flex: 1, padding: Spacing.lg,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.lg,
  },

  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.zecGlow, alignItems: 'center', justifyContent: 'center',
  },
  icon:     { fontSize: 40 },
  title:    { ...Typography.heading2, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },

  progressWrap: { width: '100%', gap: Spacing.sm },
  progressBg:   {
    height: 8, backgroundColor: Colors.bgElevated,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.zec, borderRadius: Radius.full },
  pct:          { ...Typography.bodyBold, color: Colors.zec, textAlign: 'right' },

  statsCard: {
    width: '100%', backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, gap: 4,
  },
  statRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statLabel: { ...Typography.caption, color: Colors.textMuted, letterSpacing: 1 },
  statValue: { ...Typography.bodyBold, color: Colors.textPrimary },

  errorCard: {
    width: '100%', backgroundColor: Colors.errorBg,
    borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.error + '40',
  },
  errorText: { ...Typography.body, color: Colors.error, textAlign: 'center' },

  backBtn: {
    paddingVertical: Spacing.sm + 4, paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.bgElevated, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  backBtnText: { ...Typography.bodyBold, color: Colors.textSecondary },

  tip: {
    ...Typography.caption,
    color: Colors.textMuted, textAlign: 'center',
    lineHeight: 18, paddingHorizontal: Spacing.lg,
  },
})
