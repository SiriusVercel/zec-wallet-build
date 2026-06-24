import React, { useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { Colors, Spacing, Radius } from '../theme'
import { WalletIcon, TrendingUpIcon, InsightsIcon, SettingsIcon } from './Icons'

export type Tab = 'wallet' | 'trending' | 'insights' | 'settings'
interface Props { active: Tab; onChange: (tab: Tab) => void }

type TabDef = { id: Tab; label: string }
const TABS: TabDef[] = [
  { id: 'wallet',   label: 'Wallet'   },
  { id: 'trending', label: 'Trending' },
  { id: 'insights', label: 'Insights' },
  { id: 'settings', label: 'Settings' },
]

function TabIcon({ id, active }: { id: Tab; active: boolean }) {
  const color = active ? Colors.zec : Colors.textMuted
  const sw = active ? 2.5 : 1.8
  switch (id) {
    case 'wallet':   return <WalletIcon      size={22} color={color} strokeWidth={sw} />
    case 'trending': return <TrendingUpIcon  size={22} color={color} strokeWidth={sw} />
    case 'insights': return <InsightsIcon    size={22} color={color} strokeWidth={sw} />
    case 'settings': return <SettingsIcon    size={22} color={color} strokeWidth={sw} />
  }
}

function TabButton({ tab, active, onChange }: { tab: TabDef; active: boolean; onChange: (t: Tab) => void }) {
  const scale = useRef(new Animated.Value(1)).current

  const onPress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start()
    onChange(tab.id)
  }

  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={1}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center', gap: 3 }}>
        <TabIcon id={tab.id} active={active} />
        <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

export function BottomTabs({ active, onChange }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.pill}>
        {TABS.map(t => (
          <TabButton key={t.id} tab={t} active={t.id === active} onChange={onChange} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.bg,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: Radius.full,
  },
  tabActive: { backgroundColor: Colors.bgElevated },
  label:       { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
  labelActive: { color: Colors.zec, fontWeight: '700' },
})
