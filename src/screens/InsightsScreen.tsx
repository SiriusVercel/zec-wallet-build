// InsightsScreen.tsx — real tx stats, bar chart via react-native-svg
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import Svg, { Rect, Text as SvgText } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { Colors, Spacing, Radius } from '../theme'
import { BottomTabs, Tab } from '../components/BottomTabs'
import { ArrowDownIcon, ArrowUpIcon, TrendUpIcon, TrendDownIcon } from '../components/Icons'
import { getTransactions, Transaction } from '../services/zingo'
import { getCurrentPrice, zecToUsd } from '../services/price'
import { getWalletInfo } from '../services/zcash'

interface Props { onTab: (t: Tab) => void }

type Currency = 'ZEC' | 'USD'

function fmt(zat: number, price: number, currency: Currency): string {
  const zec = zat / 1e8
  if (currency === 'ZEC') return `${zec.toFixed(4)} ZEC`
  return `$${zecToUsd(zat, price).toFixed(2)}`
}

function fmtSub(zat: number, price: number, currency: Currency): string {
  if (currency === 'ZEC') return `≈ $${zecToUsd(zat, price).toFixed(2)}`
  return `${(zat / 1e8).toFixed(4)} ZEC`
}

const BAR_W = 22
const BAR_GAP = 8
const CHART_H = 120

export default function InsightsScreen({ onTab }: Props) {
  const { t } = useTranslation()
  const [currency, setCurrency] = useState<Currency>('ZEC')
  const [loading,  setLoading]  = useState(true)
  const [txs,      setTxs]      = useState<Transaction[]>([])
  const [price,    setPrice]    = useState(0)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const wallet = await getWalletInfo()
      if (!wallet) { setLoading(false); return }
      const [transactions, currentPrice] = await Promise.all([
        getTransactions(wallet.ufvk),
        getCurrentPrice(),
      ])
      setTxs(transactions)
      setPrice(currentPrice)
    } catch { /* leave empty */ }
    setLoading(false)
  }

  const received = txs
    .filter(t => t.direction === 'received')
    .reduce((s, t) => s + Math.abs(t.amount), 0)

  const sent = txs
    .filter(t => t.direction === 'sent')
    .reduce((s, t) => s + Math.abs(t.amount), 0)

  const net = received - sent
  const netPositive = net >= 0

  // Bar chart: group by month (last 6 months)
  const now = Date.now()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - (5 - i))
    return { label: d.toLocaleString('default', { month: 'short' }), recv: 0, sent: 0 }
  })

  txs.forEach(tx => {
    const txTime = tx.timestamp ? tx.timestamp * 1000 : now
    const txDate = new Date(txTime)
    const txMonth = txDate.getMonth()
    const txYear  = txDate.getFullYear()
    const idx = months.findIndex((_, i) => {
      const d = new Date(now)
      d.setMonth(d.getMonth() - (5 - i))
      return d.getMonth() === txMonth && d.getFullYear() === txYear
    })
    const bucket = idx >= 0 ? idx : months.length - 1
    if (tx.direction === 'received') months[bucket].recv += Math.abs(tx.amount) / 1e8
    else months[bucket].sent += Math.abs(tx.amount) / 1e8
  })

  const maxVal = Math.max(...months.flatMap(m => [m.recv, m.sent]), 0.0001)

  const chartWidth = months.length * (BAR_W * 2 + BAR_GAP + 8)

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('insights.title')}</Text>

        {/* ZEC / USD toggle */}
        <View style={styles.currencyToggle}>
          {(['ZEC', 'USD'] as Currency[]).map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.currencyBtn, currency === c && styles.currencyBtnActive]}
              onPress={() => setCurrency(c)}
            >
              <Text style={[styles.currencyLabel, currency === c && styles.currencyLabelActive]}>
                {c === 'ZEC' ? t('insights.toggleZec') : t('insights.toggleUsd')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.zec} />
          </View>
        ) : txs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{t('insights.noTransactions')}</Text>
            <Text style={styles.emptyHint}>Send or receive ZEC to see your spending insights here.</Text>
          </View>
        ) : (
          <>
            {/* Received / Sent cards */}
            <View style={styles.statRow}>
              <View style={[styles.statCard, styles.statCardReceive]}>
                <View style={styles.statHeader}>
                  <View style={styles.statIconReceive}>
                    <ArrowDownIcon size={12} color="#fff" />
                  </View>
                  <Text style={styles.statLabelReceive}>{t('insights.received')}</Text>
                </View>
                <Text style={styles.statAmount}>{fmt(received, price, currency)}</Text>
                <Text style={styles.statSub}>{fmtSub(received, price, currency)}</Text>
              </View>

              <View style={[styles.statCard, styles.statCardSend]}>
                <View style={styles.statHeader}>
                  <View style={styles.statIconSend}>
                    <ArrowUpIcon size={12} color="#fff" />
                  </View>
                  <Text style={styles.statLabelSend}>{t('insights.sent')}</Text>
                </View>
                <Text style={styles.statAmount}>{fmt(sent, price, currency)}</Text>
                <Text style={styles.statSub}>{fmtSub(sent, price, currency)}</Text>
              </View>
            </View>

            {/* Net Flow */}
            <View style={styles.netFlowCard}>
              <View style={styles.netFlowLeft}>
                {netPositive
                  ? <TrendUpIcon size={20} color={Colors.success} />
                  : <TrendDownIcon size={20} color={Colors.error} />}
                <Text style={styles.netFlowLabel}>{t('insights.netFlow')}</Text>
              </View>
              <View style={styles.netFlowRight}>
                <Text style={[styles.netFlowAmount, { color: netPositive ? Colors.success : Colors.error }]}>
                  {netPositive ? '+' : ''}{(net / 1e8).toFixed(4)} ZEC
                </Text>
                <Text style={styles.netFlowSub}>
                  {netPositive ? '+' : ''}${zecToUsd(Math.abs(net), price).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Bar chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Activity</Text>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.zec }]} />
                  <Text style={styles.legendText}>{t('insights.received')}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
                  <Text style={styles.legendText}>{t('insights.sent')}</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Svg width={chartWidth} height={CHART_H + 24}>
                  {months.map((m, i) => {
                    const x = i * (BAR_W * 2 + BAR_GAP + 8) + 4
                    const recvH = maxVal > 0 ? (m.recv / maxVal) * CHART_H : 0
                    const sentH = maxVal > 0 ? (m.sent / maxVal) * CHART_H : 0
                    return (
                      <React.Fragment key={i}>
                        <Rect
                          x={x}
                          y={CHART_H - recvH}
                          width={BAR_W}
                          height={recvH || 2}
                          rx={4}
                          fill={Colors.zec}
                          opacity={0.85}
                        />
                        <Rect
                          x={x + BAR_W + 2}
                          y={CHART_H - sentH}
                          width={BAR_W}
                          height={sentH || 2}
                          rx={4}
                          fill={Colors.error}
                          opacity={0.85}
                        />
                        <SvgText
                          x={x + BAR_W}
                          y={CHART_H + 16}
                          fontSize={10}
                          fill={Colors.textMuted}
                          textAnchor="middle"
                        >
                          {m.label}
                        </SvgText>
                      </React.Fragment>
                    )
                  })}
                </Svg>
              </ScrollView>
            </View>

            {/* Tx count */}
            <View style={styles.countCard}>
              <Text style={styles.countLabel}>{t('insights.transactions', { count: txs.length })}</Text>
              <Text style={styles.countValue}>{txs.length}</Text>
            </View>
          </>
        )}
      </ScrollView>

      <BottomTabs active="insights" onChange={onTab} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.sm },
  title:   { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },

  currencyToggle: {
    flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.full,
    padding: 4, borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start',
  },
  currencyBtn:         { paddingHorizontal: 20, paddingVertical: 7, borderRadius: Radius.full },
  currencyBtnActive:   { backgroundColor: Colors.zec },
  currencyLabel:       { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  currencyLabelActive: { color: '#000', fontWeight: '800' },

  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap:   { paddingVertical: 60, alignItems: 'center', gap: Spacing.sm },
  emptyTitle:  { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  emptyHint:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  statRow:         { flexDirection: 'row', gap: Spacing.md },
  statCard:        { flex: 1, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  statCardReceive: { backgroundColor: Colors.successBg, borderColor: Colors.success + '30' },
  statCardSend:    { backgroundColor: Colors.errorBg,   borderColor: Colors.error   + '30' },
  statHeader:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  statIconReceive: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  statIconSend:    { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.error,   alignItems: 'center', justifyContent: 'center' },
  statIconText:    { fontSize: 12, color: '#fff', fontWeight: '700' },
  statLabelReceive:{ fontSize: 13, fontWeight: '600', color: Colors.success },
  statLabelSend:   { fontSize: 13, fontWeight: '600', color: Colors.error },
  statAmount:      { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  statSub:         { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  netFlowCard:  { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  netFlowLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  netFlowLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  netFlowRight: { alignItems: 'flex-end' },
  netFlowAmount:{ fontSize: 16, fontWeight: '700' },
  netFlowSub:   { fontSize: 12, color: Colors.textSecondary },

  chartCard:    { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  chartTitle:   { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  chartLegend:  { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot:    { width: 10, height: 10, borderRadius: 5 },
  legendText:   { fontSize: 12, color: Colors.textSecondary },

  countCard:    { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  countLabel:   { fontSize: 14, color: Colors.textSecondary },
  countValue:   { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
})
