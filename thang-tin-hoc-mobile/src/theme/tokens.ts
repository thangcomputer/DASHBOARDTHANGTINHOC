/**
 * Design tokens dùng chung cho app Mobile — đồng bộ với hệ CSS Variables bên Web (`client/src/index.css`).
 */
export const brandScale = {
  50: '#ECFDF5',
  100: '#D1FAE5',
  200: '#A7F3D0',
  300: '#6EE7B7',
  400: '#34D399',
  500: '#10B981',
  600: '#059669',
  700: '#047857',
  800: '#065F46',
  900: '#064E3B',
} as const;

export const surface = {
  surface0: '#FFFFFF',
  surface1: '#F8FAFC',
  surface2: '#F1F5F9',
  canvas: '#F4FBF8',
} as const;

export const ink = {
  ink900: '#0F172A',
  ink700: '#334155',
  ink600: '#475569',
  ink400: '#94A3B8',
} as const;

export const semantic = {
  brand: brandScale[600],
  brandDark: brandScale[700],
  brandSoft: brandScale[50],
  accent: '#F59E0B',
  accentSoft: '#FFFBEB',
  info: '#0EA5E9',
  infoSoft: '#F0F9FF',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
} as const;

export const colors = {
  brand: semantic.brand, // DewSkill Emerald (brand-600)
  brandDark: semantic.brandDark, // DewSkill Deep Emerald (brand-700)
  brandSoft: semantic.brandSoft, // DewSkill Soft Mint Tint (brand-50)
  ink: ink.ink900,
  muted: '#64748B',
  canvas: surface.canvas, // DewSkill Soft Mint Canvas (khớp web app #f4fbf8)
  surface: surface.surface0,
  line: '#E2F1EB', // Viền xanh mint nhẹ
  gold: semantic.accent,
  goldSoft: '#FEF3C7',
  green: brandScale[500],
  greenSoft: brandScale[100],
  red: semantic.danger,
  redSoft: '#FEE2E2',
  blue: '#3B82F6',
  blueSoft: '#EFF6FF',
  purple: '#8B5CF6',
  purpleSoft: '#F5F3FF',
  overlay: 'rgba(15, 23, 42, 0.32)',
} as const;

export type Palette = { [K in keyof typeof colors]: string };
export const brandColors: Palette = {
  ...colors,
  brand: brandScale[600],
  brandDark: brandScale[700],
  brandSoft: brandScale[50],
};

/** Cờ theme hiện tại, AuthContext cập nhật mỗi lần user đổi. */
export const themeState = { brand: false };

/** Màu theo theme hiện tại (đọc lúc render). */
export const theme: Palette = new Proxy({} as Palette, {
  get: (_target, key: string) => (themeState.brand ? brandColors : colors)[key as keyof Palette],
});

/** Tạo StyleSheet dùng bảng màu thống nhất từ design tokens. */
export function createThemedStyles<T extends object>(factory: (palette: Palette) => T, _options?: { remapGreen?: boolean }): T {
  let base: T | undefined;
  return new Proxy({} as T, {
    get: (_target, key) => {
      base ??= factory(colors);
      return (base as Record<PropertyKey, unknown>)[key];
    },
  });
}

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
  navHomeBrand: '0px 5px 16px rgba(4, 120, 87, 0.32), 0px 0px 0px 3px rgba(167, 243, 208, 0.6), inset 0px 3px 5px rgba(255, 255, 255, 0.5), inset 0px -5px 8px rgba(4, 120, 87, 0.5)',
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

/** Thẻ / modal / ô nhập phẳng — nút hành động vẫn dùng DuoButton 3D. */
export const surfaces = {
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
} as const;

export const darkColors = {
  canvas: '#0B1018',
  surface: '#111827',
  surfaceElevated: '#1E293B',
  line: 'rgba(148, 163, 184, 0.22)',
  ink: '#F8FAFC',
  muted: '#94A3B8',
  brand: '#34D399',
  brandDark: '#10B981',
  brandSoft: 'rgba(16, 185, 129, 0.16)',
} as const;

export const tabularNums = {
  fontVariant: ['tabular-nums'] as const,
};
