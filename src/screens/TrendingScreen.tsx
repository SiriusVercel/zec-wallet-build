// TrendingScreen — preço ZEC ao vivo (Kraken), gráfico SVG de linha, seletor de período
import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import Svg, { Polyline, Line as SvgLine, Text as SvgText } from 'react-native-svg'
import { Colors, Spacing, Radius, Typography } from '../theme'
import { BottomTabs, Tab } from '../components/BottomTabs'
import { getCurrentPrice, getPriceHistory, zecToUsd, PricePoint, Period } from '../services/price'
import { getWalletInfo } from '../services/zcash'
import { getBalance } from '../services/zingo'

const { width } = Dimensions.get('window')
const CHART_WIDTH  = width - 32
const CHART_HEIGHT = 220
const PAD_LEFT     = 48
const PAD_RIGHT    = 8
const PAD_TOP      = 12
const PAD_BOTTOM   = 28

const PERIODS: Period[] = ['24H', '7D', '30D', '1Y']

interface Props {
  onTab: (t: Tab) => void
}

// ─── Gráfico de linha SVG puro ────────────────────────────────────────────────
function PriceLineChart({ data }: { data: PricePoint[] }) {
  if (data.length < 2) {
    return (
      <View style={chartStyles.empty}>
        <Text style={chartStyles.emptyText}>Sem dados para exibir</Text>
      </View>
    )
  }

  const plotW = CHART_WIDTH - PAD_LEFT - PAD_RIGHT
  const plotH = CHART_HEIGHT - PAD_TOP  - PAD_BOTTOM

  const times  = data.map(d => d.time)
  const prices = data.map(d => d.close)
  const minT   = Math.min(...times)
  const maxT   = Math.max(...times)
  const minP   = Math.min(...prices)
  const maxP   = Math.max(...prices)
  const rangeT = maxT - minT || 1
  const rangeP = maxP - minP || 1

  const toX = (t: number) => PAD_LEFT + ((t - minT) / rangeT) * plotW
  const toY = (p: number) => PAD_TOP  + (1 - (p - minP) / rangeP) * plotH

  const points = data.map(d => `${toX(d.time).toFixed(1)},${toY(d.close).toFixed(1)}`).join(' ')

  // 4 labels eixo Y
  const yLabels = [0, 0.33, 0.66, 1].map(frac => {
    const price = minP + frac * rangeP
    const y     = toY(price)
    return { label: `$${price.toFixed(2)}`, y }
  })

  // 3 labels eixo X (início, meio, fim)
  const xLabels = [0, 0.5, 1].map(frac => {
    const t    = minT + frac * rangeT
    const x    = toX(t)
    const date = new Date(t)
    const label = date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
    return { label, x }
  })

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      {/* Grid lines horizontais */}
      {yLabels.map((item, i) => (
        <SvgLine
          key={`gy-${i}`}
          x1={PAD_LEFT}
          y1={item.y}
          x2={CHART_WIDTH - PAD_RIGHT}
          y2={item.y}
          stroke={Colors.border}
          strokeWidth={1}
          strokeDasharray="4,4"
        />
      ))}

      {/* Linha do gráfico */}
      <Polyline
        points={points}
        fill="none"
        stroke={Colors.zec}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Labels eixo Y */}
      {yLabels.map((item, i) => (
        <SvgText
          key={`ly-${i}`}
          x={PAD_LEFT - 4}
          y={item.y + 4}
          fontSize={9}
          fill={Colors.textMuted}
          textAnchor="end"
        >
          {item.label}
        </SvgText>
      ))}

      {/* Labels eixo X */}
      {xLabels.map((item, i) => (
        <SvgText
          key={`lx-${i}`}
          x={item.x}
          y={CHART_HEIGHT - 4}
          fontSize={9}
          fill={Colors.textMuted}
          textAnchor="middle"
        >
          {item.label}
        </SvgText>
      ))}
    </Svg>
  )
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function TrendingScreen({ onTab }: Props) {
  const [period,        setPeriod]        = useState<Period>('24H')
  const [price,         setPrice]         = useState<number | null>(null)
  const [history,       setHistory]       = useState<PricePoint[]>([])
  const [balanceZat,    setBalanceZat]    = useState<number | null>(null)
  const [loadingPrice,  setLoadingPrice]  = useState(true)
  const [loadingChart,  setLoadingChart]  = useState(true)

  // Busca preço atual
  useEffect(() => {
    let cancelled = false
    setLoadingPrice(true)
    getCurrentPrice()
      .then(p => { if (!cancelled) setPrice(p) })
      .catch(() => { /* falha silenciosa — mantém último valor */ })
      .finally(() => { if (!cancelled) setLoadingPrice(false) })
    return () => { cancelled = true }
  }, [])

  // Busca saldo se carteira existir
  useEffect(() => {
    let cancelled = false
    getWalletInfo()
      .then(info => {
        if (!info || cancelled) return
        return getBalance(info.ufvk).then(bal => {
          if (!cancelled) setBalanceZat(bal.total)
        })
      })
      .catch(() => { /* sem carteira ou offline — silencioso */ })
    return () => { cancelled = true }
  }, [])

  // Busca histórico de preços ao trocar período
  const fetchHistory = useCallback((p: Period) => {
    setLoadingChart(true)
    getPriceHistory(p)
      .then(pts => setHistory(pts))
      .catch(() => { /* mantém dados anteriores */ })
      .finally(() => setLoadingChart(false))
  }, [])

  useEffect(() => {
    fetchHistory(period)
  }, [period, fetchHistory])

  const priceUsd    = price ?? 0
  const balanceUsd  = balanceZat !== null && price !== null
    ? zecToUsd(balanceZat, price)
    : null
  const balanceZec  = balanceZat !== null ? (balanceZat / 1e8).toFixed(4) : null

  const latestPrice = history.length > 0 ? history[history.length - 1].close : priceUsd
  const firstPrice  = history.length > 0 ? history[0].close                  : priceUsd
  const changePct   = firstPrice > 0
    ? ((latestPrice - firstPrice) / firstPrice) * 100
    : 0
  const changePositive = changePct >= 0

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Trending</Text>

        {/* ── Preço atual ──────────────────────────────────────────── */}
        <View style={styles.priceHero}>
          <View style={styles.priceRow}>
            {loadingPrice ? (
              <ActivityIndicator color={Colors.zec} size="large" />
            ) : (
              <Text style={styles.priceUsd}>
                ${priceUsd.toFixed(2)}
              </Text>
            )}
            {!loadingPrice && (
              <View style={[
                styles.changeBadge,
                { backgroundColor: changePositive ? Colors.successBg : Colors.errorBg },
              ]}>
                <Text style={[
                  styles.changeText,
                  { color: changePositive ? Colors.success : Colors.error },
                ]}>
                  {changePositive ? '↗' : '↘'} {Math.abs(changePct).toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.priceSub}>ZEC / USD · {period}</Text>
        </View>

        {/* ── Saldo da carteira ────────────────────────────────────── */}
        {balanceZec !== null && (
          <View style={styles.balanceCard}>
            <View style={styles.balanceLeft}>
              <View style={styles.walletIcon}>
                <Text style={{ fontSize: 16 }}>📋</Text>
              </View>
              <Text style={styles.balanceLabel}>Seu saldo</Text>
            </View>
            <View style={styles.balanceRight}>
              <Text style={styles.balanceZec}>{balanceZec} ZEC</Text>
              <Text style={styles.balanceUsd}>
                Valor{' '}
                <Text style={styles.balanceUsdGold}>
                  {balanceUsd !== null ? `$${balanceUsd.toFixed(2)}` : '—'}
                </Text>
              </Text>
            </View>
          </View>
        )}

        {/* ── Gráfico ──────────────────────────────────────────────── */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Gráfico de preço</Text>

          {/* Seletor de período */}
          <View style={styles.periodRow}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.periodLabel, period === p && styles.periodLabelActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Preço no ponto mais recente */}
          <Text style={styles.chartPrice}>${latestPrice.toFixed(2)}</Text>

          {/* Área do gráfico */}
          <View style={styles.chartBox}>
            {loadingChart ? (
              <ActivityIndicator color={Colors.zec} size="large" />
            ) : (
              <PriceLineChart data={history} />
            )}
          </View>
        </View>
      </ScrollView>

      <BottomTabs active="trending" onChange={onTab} />
    </SafeAreaView>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const chartStyles = StyleSheet.create({
  empty: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
})

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, gap: Spacing.lg, paddingBottom: Spacing.sm },
  title:   { ...Typography.heading2, color: Colors.textPrimary },

  // Preço hero
  priceHero:    { gap: 4 },
  priceRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  priceUsd:     { fontSize: 40, fontWeight: '900', color: Colors.zec, letterSpacing: -1 },
  changeBadge:  { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  changeText:   { fontSize: 14, fontWeight: '700' },
  priceSub:     { fontSize: 13, color: Colors.textMuted },

  // Saldo
  balanceCard:    { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  balanceLeft:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  walletIcon:     { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  balanceLabel:   { fontSize: 14, color: Colors.textSecondary },
  balanceRight:   { alignItems: 'flex-end' },
  balanceZec:     { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  balanceUsd:     { fontSize: 13, color: Colors.textSecondary },
  balanceUsdGold: { color: Colors.zec, fontWeight: '700' },

  // Gráfico
  chartSection:     { gap: Spacing.md },
  chartTitle:       { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  periodRow:        { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: 4, borderWidth: 1, borderColor: Colors.border },
  periodBtn:        { flex: 1, paddingVertical: 8, borderRadius: Radius.md, alignItems: 'center' },
  periodBtnActive:  { backgroundColor: Colors.zec },
  periodLabel:      { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  periodLabelActive:{ color: '#000', fontWeight: '800' },
  chartPrice:       { fontSize: 22, fontWeight: '700', color: Colors.zec },
  chartBox:         { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, minHeight: CHART_HEIGHT + PAD_TOP + PAD_BOTTOM, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
})
