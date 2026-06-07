// Bottom Tab Bar — igual ao app real Zcash Wallet
// Pill container escuro, 4 tabs, ativo = gold
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Spacing, Radius } from '../theme'

export type Tab = 'wallet' | 'trending' | 'insights' | 'settings'

interface Props {
  active:   Tab
  onChange: (tab: Tab) => void
}

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'wallet',   icon: '📋', label: 'Wallet'   },
  { id: 'trending', icon: '📈', label: 'Trending' },
  { id: 'insights', icon: '📊', label: 'Insights' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

export function BottomTabs({ active, onChange }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.pill}>
        {TABS.map(t => {
          const isActive = t.id === active
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onChange(t.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.icon, isActive && styles.iconActive]}>
                {t.icon}
              </Text>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          )
        })}
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
    borderRadius: Radius.full, gap: 2,
  },
  tabActive: {
    backgroundColor: Colors.bgElevated,
  },
  icon:       { fontSize: 18 },
  iconActive: { },
  label:       { fontSize: 10, color: Colors.textSecondary, fontWeight: '500' },
  labelActive: { color: Colors.zec, fontWeight: '700' },
})
