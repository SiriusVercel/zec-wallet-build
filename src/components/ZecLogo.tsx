// Logo oficial ZCash — o Z com a seta diagonal
// Reproduz fielmente o design do app real
import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Colors } from '../theme'

interface Props {
  size?: number
  style?: ViewStyle
}

export function ZecLogo({ size = 64, style }: Props) {
  const pad    = size * 0.18
  const radius = size * 0.22
  return (
    <View style={[
      styles.outer,
      {
        width: size, height: size, borderRadius: radius,
        shadowRadius: size * 0.4,
      },
      style,
    ]}>
      {/* Z com seta — usando texto estilizado que aproxima o logo real */}
      <Text style={[styles.z, { fontSize: size * 0.52 }]}>Ƶ</Text>
    </View>
  )
}

// Versão pequena para tab bar e header
export function ZecLogoSmall({ size = 28, style }: Props) {
  return (
    <View style={[
      styles.outerSmall,
      { width: size, height: size, borderRadius: size * 0.22 },
      style,
    ]}>
      <Text style={[styles.zSmall, { fontSize: size * 0.55 }]}>Ƶ</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: Colors.zec,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.zec, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, elevation: 16,
  },
  z: {
    color: '#000000', fontWeight: '900', lineHeight: undefined,
    includeFontPadding: false,
  },
  outerSmall: {
    backgroundColor: Colors.zec,
    alignItems: 'center', justifyContent: 'center',
  },
  zSmall: {
    color: '#000000', fontWeight: '900',
    includeFontPadding: false,
  },
})
