import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { ArrowLeftIcon } from '../components/Icons'
import { Colors, Typography, Spacing } from '../theme'

interface Props {
  onScan:  (address: string) => void
  onClose: () => void
}

export default function QRScannerScreen({ onScan, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)

  function handleBarcode({ data }: { data: string }) {
    if (scanned) return
    setScanned(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    // Strip "zcash:" URI prefix if present
    const addr = data.replace(/^zcash:/i, '').split('?')[0].trim()
    onScan(addr)
  }

  if (!permission) {
    return <View style={styles.center} />
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.permissionText}>Camera access is required to scan QR codes.</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <ArrowLeftIcon size={16} color={Colors.zec} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Scan QR Code</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcode}
        />
        <View style={styles.overlay}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.hint}>Point camera at a Zcash address QR code</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const FRAME = 220
const CORNER = 24
const THICK = 3

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: Spacing.md,
    backgroundColor: Colors.bg,
  },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
  backText: { ...Typography.body, color: Colors.zec },
  title:    { ...Typography.heading3, color: Colors.textPrimary },

  cameraWrap: { flex: 1, position: 'relative' },
  camera:     { flex: 1 },

  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  frame: {
    width: FRAME, height: FRAME,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  tl: { top: 0, left: 0, borderTopWidth: THICK, borderLeftWidth: THICK, borderColor: '#F0B90B', borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderTopWidth: THICK, borderRightWidth: THICK, borderColor: '#F0B90B', borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderBottomWidth: THICK, borderLeftWidth: THICK, borderColor: '#F0B90B', borderBottomLeftRadius: 6 },
  br: { bottom: 0, right: 0, borderBottomWidth: THICK, borderRightWidth: THICK, borderColor: '#F0B90B', borderBottomRightRadius: 6 },

  hint: { marginTop: 24, color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },

  permissionText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  btn:            { backgroundColor: Colors.zec, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 32 },
  btnText:        { color: Colors.bg, fontWeight: '700' as const, fontSize: 16 },
  cancelBtn:      { paddingVertical: 12 },
  cancelText:     { ...Typography.body, color: Colors.textSecondary },
})
