import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, RefreshControl, Animated,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, Radius } from '../theme'
import { Skeleton } from '../components/Skeleton'
import { ArrowUpIcon, ArrowDownIcon, ScanIcon } from '../components/Icons'
import { getWalletInfo } from '../services/zcash'
import { getBalance, getSyncStatus, getTransactions, Balance, SyncStatus, Transaction } from '../services/zingo'
import { getCurrentPrice, zecToUsd } from '../services/price'
import { TxRow } from '../components/ui'

interface Props {
  onSend:            () => void
  onReceive:         () => void
  onScan:            () => void
  onBalanceChange?:  (balance: Balance) => void
}

export default function HomeScreen({ onSend, onReceive, onScan, onBalanceChange }: Props) {
  const { t } = useTranslation()
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const [balance,      setBalance]      = useState<Balance>({ orchard: 0, sapling: 0, transparent: 0, total: 0 })
  const [price,        setPrice]        = useState(0)
  const [sync,         setSync]         = useState<SyncStatus | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const entranceOpacity   = useRef(new Animated.Value(0)).current
  const entranceTranslate = useRef(new Animated.Value(20)).current
  const pulseScale        = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1, duration: 400,
        easing: (x) => x * (2 - x),
        useNativeDriver: true,
      }),
      Animated.timing(entranceTranslate, {
        toValue: 0, duration: 400,
        easing: (x) => x * (2 - x),
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const wallet = await getWalletInfo()
      if (!wallet) throw new Error('Carteira não encontrada')

      const [bal, priceUsd, syncStatus, txs] = await Promise.all([
        getBalance(wallet.ufvk),
        getCurrentPrice(),
        getSyncStatus(),
        getTransactions(wallet.ufvk).catch(() => [] as Transaction[]),
      ])

      setBalance(bal)
      onBalanceChange?.(bal)
      setPrice(priceUsd)
      setSync(syncStatus)
      setTransactions(txs)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const zecBalance = balance.total / 1e8
  const usdBalance = zecToUsd(balance.total, price)
  const isSyncing  = sync !== null && sync.percent > 0 && sync.percent < 100

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.zec}
          />
        }
      >
        <Animated.View style={{ opacity: entranceOpacity, transform: [{ translateY: entranceTranslate }] }}>

          {isSyncing && (
            <View style={styles.syncBadge}>
              <Animated.View style={[styles.syncDot, { transform: [{ scale: pulseScale }] }]} />
              <Text style={styles.syncText}>{t('home.syncing', { percent: sync!.percent.toFixed(0) })}</Text>
            </View>
          )}

          {error !== null && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorHint}>{t('home.errorLoading')}</Text>
            </View>
          )}

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{t('home.totalBalance')}</Text>

            {loading ? (
              <>
                <Skeleton width="70%" height={48} borderRadius={10} style={styles.skeletonBalance} />
                <Skeleton width="45%" height={22} borderRadius={8} style={styles.skeletonUsd} />
              </>
            ) : (
              <>
                <Text style={styles.balanceZec}>
                  {zecBalance.toFixed(8)} <Text style={styles.balanceTicker}>ZEC</Text>
                </Text>
                <Text style={styles.balanceUsd}>
                  ≈ ${usdBalance.toFixed(2)} USD
                </Text>
              </>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionSend}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSend() }}
              activeOpacity={0.85}
            >
              <ArrowUpIcon size={22} color="#000" />
              <Text style={styles.actionLabelDark}>{t('home.send')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionReceive}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onReceive() }}
              activeOpacity={0.85}
            >
              <ArrowDownIcon size={22} color={Colors.success} />
              <Text style={styles.actionLabel}>{t('home.receive')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionScan}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onScan() }}
              activeOpacity={0.85}
            >
              <ScanIcon size={22} color={Colors.blue} />
              <Text style={styles.actionLabel}>{t('home.scan')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>{t('home.zecPrice')}</Text>
            {loading ? (
              <Skeleton width={80} height={18} borderRadius={6} />
            ) : (
              <Text style={styles.priceValue}>${price.toFixed(2)}</Text>
            )}
          </View>

          {/* ── Recent Transactions ── */}
          <View style={styles.txSection}>
            <Text style={styles.txSectionTitle}>{t('home.transactions')}</Text>
            {loading ? (
              <>
                <Skeleton width="100%" height={64} borderRadius={12} style={{ marginBottom: 8 }} />
                <Skeleton width="100%" height={64} borderRadius={12} />
              </>
            ) : transactions.length === 0 ? (
              <View style={styles.txEmpty}>
                <Text style={styles.txEmptyText}>{t('home.noTransactions')}</Text>
              </View>
            ) : (
              transactions.map(tx => (
                <TxRow
                  key={tx.txid}
                  amount={tx.amount}
                  timestamp={tx.timestamp ?? 0}
                  confirmed={tx.confirmed ?? true}
                  txid={tx.txid}
                />
              ))
            )}
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },

  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
  },
  syncText: { fontSize: 12, fontWeight: '700' as const, color: Colors.warning },

  errorBox: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.error + '40',
    marginBottom: Spacing.sm,
  },
  errorText: { fontSize: 14, fontWeight: '600' as const, color: Colors.error },
  errorHint: { fontSize: 12, color: Colors.textMuted },

  balanceCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  balanceLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  balanceZec: {
    ...Typography.balance,
    color: Colors.textPrimary,
  },
  balanceTicker: {
    fontSize: 20,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
  },
  balanceUsd: { fontSize: 16, color: Colors.textSecondary },

  skeletonBalance: { marginTop: 4 },
  skeletonUsd:     { marginTop: 8 },

  actions:       { flexDirection: 'row', gap: Spacing.sm },
  actionSend: {
    flex: 1,
    backgroundColor: Colors.zec,
    borderRadius: Radius.xl,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: 4,
    shadowColor: Colors.zec,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionReceive: {
    flex: 1,
    backgroundColor: Colors.successBg,
    borderRadius: Radius.xl,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.success + '40',
  },
  actionScan: {
    flex: 1,
    backgroundColor: Colors.blueBg,
    borderRadius: Radius.xl,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.blue + '40',
  },
  actionLabelDark: { fontSize: 13, fontWeight: '700' as const, color: '#000' },
  actionLabel:     { fontSize: 13, fontWeight: '700' as const, color: Colors.textPrimary },

  priceCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
  priceValue: { fontSize: 15, fontWeight: '700' as const, color: Colors.textGold },

  txSection: { gap: Spacing.xs },
  txSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  txEmpty: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  txEmptyText: { fontSize: 14, color: Colors.textMuted },
})
