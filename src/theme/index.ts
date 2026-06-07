// ZEC Wallet — Design System
// Baseado no app real Zcash Wallet (screenshots 2026-06-03)
// Background: marrom escuro quente (#1A1714), não preto puro
// ZCash gold oficial: #F4C42A

export const Colors = {
  // ZCash brand
  zec:        '#F4C42A',   // ZCash gold oficial
  zecDark:    '#D4A420',
  zecLight:   '#FFD84A',
  zecGlow:    'rgba(244, 196, 42, 0.15)',

  // Background — marrom escuro quente (NÃO preto puro)
  bg:         '#131110',   // fundo principal
  bgWarm:     '#1A1714',   // ligeiramente mais claro
  bgCard:     '#201D1B',   // cards
  bgCardAlt:  '#252220',   // cards alternativos
  bgElevated: '#2A2724',   // elementos elevados
  bgInput:    '#1E1B19',
  border:     '#2E2B28',
  borderLight:'#3A3733',

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#9A9490',
  textMuted:     '#5A5550',
  textGold:      '#F4C42A',

  // Status
  success:     '#00C896',   // verde shielded/received
  successBg:   'rgba(0,200,150,0.15)',
  error:       '#FF4B4B',
  errorBg:     'rgba(255,75,75,0.15)',
  warning:     '#FFB347',
  blue:        '#4A9EFF',   // transparent/scan
  blueBg:      'rgba(74,158,255,0.15)',
  purple:      '#9B59B6',   // export/misc

  // Overlays
  overlay: 'rgba(10,8,6,0.9)',
}

export const Typography = {
  heading1: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading2: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading3: { fontSize: 18, fontWeight: '600' as const },
  body:     { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  caption:  { fontSize: 12, fontWeight: '400' as const },
  mono:     { fontSize: 13, fontWeight: '400' as const, fontFamily: 'monospace' },
  balance:  { fontSize: 42, fontWeight: '700' as const, letterSpacing: -1 },
  balanceSub: { fontSize: 20, fontWeight: '400' as const },
}

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
}

export const Radius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 999,
}

export const Shadows = {
  gold: {
    shadowColor: '#F4B728',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
}
