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

/** Bảng màu tone đỏ cho học viên đăng ký theo khóa (đồng bộ web app). Học viên miễn phí / giảng viên giữ tone xanh. */
export type Palette = { [K in keyof typeof colors]: string };
export const brandColors: Palette = {
  ...colors,
  brand: '#059669',
  brandDark: '#047857',
  brandSoft: '#ECFDF5',
};

/** Cờ theme hiện tại, AuthContext cập nhật mỗi lần user đổi. */
export const themeState = { brand: false };

/** Màu theo theme hiện tại (đọc lúc render). */
export const theme: Palette = new Proxy({} as Palette, {
  get: (_target, key: string) => (themeState.brand ? brandColors : colors)[key as keyof Palette],
});

const GREEN_TO_RED: Record<string, string> = {
  '#059669': '#DC2626',
  '#10b981': '#EF4444',
  '#047857': '#B91C1C',
  '#34d399': '#F87171',
  '#ecfdf5': '#FEF2F2',
  '#d1fae5': '#FEE2E2',
  '#a7f3d0': '#FECACA',
  '#065f46': '#991B1B',
};

function remapGreenToRed(value: unknown): unknown {
  if (typeof value === 'string') {
    const direct = GREEN_TO_RED[value.toLowerCase()];
    if (direct) return direct;
    return value
      .replace(/rgba\(5,\s*150,\s*105/g, 'rgba(220, 38, 38')
      .replace(/rgba\(16,\s*185,\s*129/g, 'rgba(239, 68, 68')
      .replace(/rgba\(4,\s*120,\s*87/g, 'rgba(185, 28, 28');
  }
  if (Array.isArray(value)) return value.map(remapGreenToRed);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, remapGreenToRed(v)]));
  }
  return value;
}

/**
 * StyleSheet có hai phiên bản (xanh/đỏ), chọn theo 	hemeState mỗi lần đọc style.
 * emapGreen: với bản đỏ, đổi luôn các mã màu xanh viết cứng sang đỏ (chỉ dùng cho màn hình mà xanh là màu trang trí, không phải màu đúng/sai).
 */
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
  navHomeBrand: '0px 5px 16px rgba(185, 28, 28, 0.35), 0px 0px 0px 3px rgba(254, 202, 202, 0.75), inset 0px 3px 5px rgba(255, 255, 255, 0.5), inset 0px -5px 8px rgba(153, 27, 27, 0.5)',
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
