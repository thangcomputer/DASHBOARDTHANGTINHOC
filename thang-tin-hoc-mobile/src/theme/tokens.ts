export const colors = {
  brand: '#059669', // DewSkill Emerald (dew-600)
  brandDark: '#047857', // DewSkill Deep Emerald (dew-700)
  brandSoft: '#ECFDF5', // DewSkill Soft Mint Tint (dew-50)
  ink: '#0F172A',
  muted: '#64748B',
  canvas: '#F4FBF8', // DewSkill Soft Mint Canvas (khớp web app #f4fbf8)
  surface: '#FFFFFF',
  line: '#E2F1EB', // Viền xanh mint nhẹ
  gold: '#F59E0B',
  goldSoft: '#FEF3C7',
  green: '#10B981',
  greenSoft: '#D1FAE5',
  red: '#EF4444',
  redSoft: '#FEE2E2',
  blue: '#3B82F6',
  blueSoft: '#EFF6FF',
  purple: '#8B5CF6',
  purpleSoft: '#F5F3FF',
  overlay: 'rgba(15, 23, 42, 0.32)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

/** Bóng "giọt nước" khớp client/src/index.css và thanh điều hướng dưới của web. */
export const droplet = {
  button: 'inset 1px 1px 2px rgba(15, 23, 42, 0.16), inset -1px -1px 2px rgba(255, 255, 255, 0.32), 0px 1px 2px rgba(15, 23, 42, 0.08)',
  buttonPressed: 'inset 2px 2px 5px rgba(15, 23, 42, 0.2), inset -1px -1px 3px rgba(255, 255, 255, 0.2)',
  navBar: '0px -8px 32px rgba(15, 23, 42, 0.12), inset 0px 1px 0px rgba(255, 255, 255, 0.95)',
  navItemActive: 'inset 2px 2px 6px rgba(5, 150, 105, 0.16), inset -2px -2px 5px rgba(255, 255, 255, 0.96)',
  navTile: 'inset 2px 2px 5px rgba(71, 85, 105, 0.14), inset -2px -2px 5px rgba(255, 255, 255, 0.96)',
  navTileActive: 'inset 2px 2px 5px rgba(4, 120, 87, 0.32), inset -2px -2px 5px rgba(255, 255, 255, 0.18)',
  logo: '0px 4px 12px rgba(15, 23, 42, 0.12), 0px 1px 2px rgba(15, 23, 42, 0.08), inset 0px 2px 3px rgba(255, 255, 255, 1), inset 0px -3px 6px rgba(148, 163, 184, 0.22)',
  navHome: '0px 5px 16px rgba(4, 120, 87, 0.32), 0px 0px 0px 3px rgba(167, 243, 208, 0.6), inset 0px 3px 5px rgba(255, 255, 255, 0.5), inset 0px -5px 8px rgba(4, 120, 87, 0.5)',
} as const;

export const typography = {
  hero: 28,
  display: 24,
  title: 20,
  heading: 17,
  subheading: 16,
  body: 15,
  small: 14,
  secondary: 13,
  caption: 12,
  micro: 11,
} as const;

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;
