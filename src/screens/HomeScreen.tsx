import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, RefreshControl, Animated,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { ZecLogoSmall } from '../components/ZecLogo'
import { ArrowUpIcon, ArrowDownIcon, ScanIcon, SettingsIcon } from '../components/Icons'
import { getWalletInfo } from '../services/zcash'
import { getBalance, getSyncStatus, getTransactions, startSync, Balance, SyncStatus, Transaction } from '../services/zingo'
import { getCurrentPrice, zecToUsd } from '../services/price'
import { POLL_INTERVAL_MS } from '../config'
import { startLiveActivity, updateLiveActivity } from '../services/liveActivity'

const C = {
  bg:      '#0C0C0F',
  card:    '#16181D',
  border:  '#232730',
  yellow:  '#F0B90B',
  green:   '#0ECB81',
  red:     '#F6465D',
  white:   '#FFFFFF',
  sec:     '#7B8499',
  muted:   '#3D4457',
}

interface Props {
  onSend:           () => void
  onReceive:        () => void
  onScan:           () => void
  onBalanceChange?: (balance: Balance) => void
}

// ── Pressable circle button ──────────────────────────────────────────────────
function CircleBtn({ icon, label, iconColor, onPress }: {
  icon: React.ReactNode
  label: string
  iconColor: string
  onPress: () => void
}) {
  const scale = useRef(new Animated.Value(1)).current
  const press = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 8 }).start()

  return (
    <View style={cb.wrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          style={cb.circle}
          onPressIn={() => press(0.88)}
          onPressOut={() => press(1)}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress() }}
          activeOpacity={1}
        >
          {icon}
        </TouchableOpacity>
      </Animated.View>
      <Text style={[cb.label, { color: C.sec }]}>{label}</Text>
    </View>
  )
}
const cb = StyleSheet.create({
  wrap:   { alignItems: 'center', gap: 10 },
  circle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '500' as const },
})

// ── Transaction row ──────────────────────────────────────────────────────────
function TxRow({ tx, index, isLast }: { tx: Transaction; index: number; isLast: boolean }) {
  const opacity    = useRef(new Animated.Value(0)).current
  const translateX = useRef(new Animated.Value(-20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 280, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 280, delay: index * 50, useNativeDriver: true }),
    ]).start()
  }, [])

  const received = tx.direction === 'received'
  const zec = (Math.abs(tx.amount) / 1e8).toFixed(8)
  const short = tx.txid.length > 14
    ? tx.txid.slice(0, 6) + '···' + tx.txid.slice(-6)
    : tx.txid

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <View style={tx2.row}>
        <View style={[tx2.icon, { backgroundColor: received ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)' }]}>
          <Text style={[tx2.arrow, { color: received ? C.green : C.red }]}>
            {received ? '↓' : '↑'}
          </Text>
        </View>
        <View style={tx2.left}>
          <Text style={tx2.type}>{received ? 'Received' : 'Sent'}</Text>
          <Text style={tx2.addr}>{short}</Text>
        </View>
        <View style={tx2.right}>
          <Text style={[tx2.amount, { color: received ? C.green : C.red }]}>
            {received ? '+' : '−'}{zec}
          </Text>
          <Text style={tx2.status}>{tx.confirmed ? 'Confirmed' : 'Pending'}</Text>
        </View>
      </View>
      {!isLast && <View style={tx2.divider} />}
    </Animated.View>
  )
}
const tx2 = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18 },
  icon:    { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  arrow:   { fontSize: 18, fontWeight: '700' as const },
  left:    { flex: 1, gap: 3 },
  type:    { fontSize: 14, fontWeight: '600' as const, color: '#FFFFFF' },
  addr:    { fontSize: 12, color: C.sec, fontVariant: ['tabular-nums'] as any },
  right:   { alignItems: 'flex-end', gap: 3 },
  amount:  { fontSize: 13, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as any },
  status:  { fontSize: 11, color: C.sec },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 18 },
})

// ── Main ─────────────────────────────────────────────────────────────────────
export default function HomeScreen({ onSend, onReceive, onScan, onBalanceChange }: Props) {
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [balance,      setBalance]      = useState<Balance>({ orchard: 0, sapling: 0, transparent: 0, total: 0 })
  const [price,        setPrice]        = useState(0)
  const [sync,         setSync]         = useState<SyncStatus | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Animations
  const entranceOp  = useRef(new Animated.Value(0)).current
  const entranceTy  = useRef(new Animated.Value(20)).current
  const glowOp      = useRef(new Animated.Value(0.04)).current
  const syncDotOp   = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceOp, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(entranceTy, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start()
    Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue: 0.09, duration: 1500, useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 0.04, duration: 1500, useNativeDriver: true }),
    ])).start()
    Animated.loop(Animated.sequence([
      Animated.timing(syncDotOp, { toValue: 0.2, duration: 600, useNativeDriver: true }),
      Animated.timing(syncDotOp, { toValue: 1,   duration: 600, useNativeDriver: true }),
    ])).start()
  }, [])

  // Data
  const walletRef    = useRef<{ ufvk: string } | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevTxIdsRef = useRef<Set<string>>(new Set())

  const loadData = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setError(null)
    try {
      if (!walletRef.current) {
        const wallet = await getWalletInfo()
        if (!wallet) throw new Error('Wallet not found')
        walletRef.current = wallet
      }
      const { ufvk } = walletRef.current
      const [bal, priceUsd, syncStatus, txs] = await Promise.all([
        getBalance(ufvk),
        getCurrentPrice(),
        getSyncStatus(),
        getTransactions(ufvk).catch(() => [] as Transaction[]),
      ])
      setBalance(bal)
      onBalanceChange?.(bal)
      setPrice(priceUsd)
      setSync(syncStatus)
      setTransactions(txs)

      if (prevTxIdsRef.current.size > 0) {
        const newIncoming = txs.filter(
          tx => tx.direction === 'received' && !prevTxIdsRef.current.has(tx.txid)
        )
        if (newIncoming.length > 0) {
          const tx = newIncoming[0]
          startLiveActivity('receive', tx.amount / 1e8, '').catch(() => {})
          updateLiveActivity(tx.txid, tx.confirmed ? 'confirmed' : 'pending').catch(() => {})
        }
      }
      prevTxIdsRef.current = new Set(txs.map(tx => tx.txid))
    } catch (e: unknown) {
      if (showSpinner) setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  useEffect(() => {
    startSync().catch(() => {})
    loadData(true)
    pollTimerRef.current = setInterval(() => loadData(false), POLL_INTERVAL_MS)
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current) }
  }, [loadData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadData(false)
    setRefreshing(false)
  }, [loadData])

  const zecBalance = balance.total / 1e8
  const usdBalance = zecToUsd(balance.total, price)
  const isSyncing  = sync !== null && sync.percent > 0 && sync.percent < 100

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.yellow} />}
      >
        <Animated.View style={{ opacity: entranceOp, transform: [{ translateY: entranceTy }] }}>

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <ZecLogoSmall size={22} />
              <Text style={s.headerTitle}>ZEC Wallet</Text>
            </View>
            <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <SettingsIcon size={20} color={C.sec} />
            </TouchableOpacity>
          </View>

          {/* Balance hero — no card, flat on background */}
          <View style={s.balanceHero}>
            {/* Subtle glow behind the number */}
            <Animated.View style={[s.glow, { opacity: glowOp }]} />

            <Text style={s.balLabel}>TOTAL BALANCE</Text>

            <View style={s.balRow}>
              <Text style={s.balNum}>
                {loading ? '-.--------' : zecBalance.toFixed(8)}
              </Text>
              <Text style={s.balTicker}> ZEC</Text>
            </View>

            <Text style={s.balUsd}>
              {loading ? '≈ $--.-- USD' : `≈ $${usdBalance.toFixed(2)} USD`}
            </Text>

            {isSyncing && (
              <View style={s.syncPill}>
                <Animated.View style={[s.syncDot, { opacity: syncDotOp }]} />
                <Text style={s.syncText}>Syncing {sync!.percent.toFixed(0)}%</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={s.actions}>
            <CircleBtn
              icon={<ArrowUpIcon size={22} color={C.yellow} />}
              label="Send"
              iconColor={C.yellow}
              onPress={onSend}
            />
            <CircleBtn
              icon={<ArrowDownIcon size={22} color={C.green} />}
              label="Receive"
              iconColor={C.green}
              onPress={onReceive}
            />
            <CircleBtn
              icon={<ScanIcon size={22} color={C.sec} />}
              label="Scan"
              iconColor={C.sec}
              onPress={onScan}
            />
          </View>

          {/* Thin divider */}
          <View style={s.hr} />

          {/* Price card */}
          <View style={s.priceCard}>
            <Text style={s.pricePair}>ZEC / USD</Text>
            <Text style={s.priceVal}>
              {loading ? '--' : `$${price.toFixed(2)}`}
            </Text>
          </View>

          {/* Error */}
          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* Transactions */}
          <View style={s.txSection}>
            <View style={s.txHeader}>
              <Text style={s.txTitle}>Transactions</Text>
              {transactions.length > 0 && <Text style={s.txAll}>See all →</Text>}
            </View>

            <View style={s.txCard}>
              {loading ? (
                [0, 1, 2].map(i => (
                  <View key={i}>
                    <View style={s.skRow}>
                      <View style={s.skIcon} />
                      <View style={{ flex: 1, gap: 8 }}>
                        <View style={s.skLine} />
                        <View style={[s.skLine, { width: '55%', opacity: 0.5 }]} />
                      </View>
                    </View>
                    {i < 2 && <View style={tx2.divider} />}
                  </View>
                ))
              ) : transactions.length === 0 ? (
                <View style={s.emptyWrap}>
                  <View style={s.emptyCircle}>
                    <Text style={s.emptyIcon}>○</Text>
                  </View>
                  <Text style={s.emptyTitle}>No transactions yet</Text>
                  <Text style={s.emptyHint}>Your ZEC transactions will appear here</Text>
                </View>
              ) : (
                transactions.slice(0, 20).map((tx, i) => (
                  <TxRow
                    key={tx.txid}
                    tx={tx}
                    index={i}
                    isLast={i === Math.min(transactions.length, 20) - 1}
                  />
                ))
              )}
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 0 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 4 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '600' as const, color: C.white },

  // Balance hero
  balanceHero: { alignItems: 'center', paddingVertical: 40 },
  glow:        { position: 'absolute', top: 30, width: 280, height: 80, backgroundColor: C.yellow, borderRadius: 140 },
  balLabel:    { fontSize: 12, fontWeight: '600' as const, color: C.sec, letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 12 },
  balRow:      { flexDirection: 'row', alignItems: 'baseline' },
  balNum:      { fontSize: 40, fontWeight: '700' as const, color: C.white, fontVariant: ['tabular-nums'] as any, letterSpacing: -1 },
  balTicker:   { fontSize: 20, fontWeight: '600' as const, color: C.yellow },
  balUsd:      { fontSize: 15, color: C.sec, marginTop: 8 },

  // Sync
  syncPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  syncDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.yellow },
  syncText: { fontSize: 12, color: C.sec, fontWeight: '500' as const },

  // Action buttons
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, marginBottom: 32 },

  // Divider
  hr: { height: 1, backgroundColor: C.border, marginBottom: 20 },

  // Price card
  priceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20,
    borderWidth: 1, borderColor: C.border, marginBottom: 24,
  },
  pricePair: { fontSize: 13, fontWeight: '500' as const, color: C.sec },
  priceVal:  { fontSize: 15, fontWeight: '700' as const, color: C.white, fontVariant: ['tabular-nums'] as any },

  // Error
  errorBox:  { backgroundColor: 'rgba(246,70,93,0.1)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(246,70,93,0.3)', marginBottom: 16 },
  errorText: { fontSize: 13, color: C.red },

  // Transactions
  txSection: { gap: 12 },
  txHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txTitle:   { fontSize: 15, fontWeight: '700' as const, color: C.white },
  txAll:     { fontSize: 13, fontWeight: '500' as const, color: C.yellow },
  txCard:    { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },

  // Empty state
  emptyWrap:   { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  emptyIcon:   { fontSize: 24, color: C.muted },
  emptyTitle:  { fontSize: 15, fontWeight: '600' as const, color: C.sec, marginTop: 4 },
  emptyHint:   { fontSize: 13, color: C.muted },

  // Skeleton
  skRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18 },
  skIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.border },
  skLine: { height: 12, backgroundColor: C.border, borderRadius: 6, width: '80%' },
})
