import React from 'react'
import { View, Image, StyleSheet, ViewStyle } from 'react-native'
import { Colors } from '../theme'

interface Props { size?: number; style?: ViewStyle }

export function ZecLogo({ size = 90, style }: Props) {
  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: size * 0.22 }, style]}>
      <Image
        source={require('../../assets/zec-logo.png')}
        style={{ width: size * 0.85, height: size * 0.85 }}
        resizeMode="contain"
      />
    </View>
  )
}

export function ZecLogoSmall({ size = 28, style }: Props) {
  return (
    <Image
      source={require('../../assets/zec-logo.png')}
      style={[{ width: size, height: size }, style as any]}
      resizeMode="contain"
    />
  )
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.zec,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
})
