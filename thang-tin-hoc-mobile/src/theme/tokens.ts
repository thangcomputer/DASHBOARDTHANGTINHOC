export const colors = {
  brand: '#DC2626',
  brandDark: '#B91C1C',
  brandSoft: '#FEF2F2',
  ink: '#172033',
  muted: '#64748B',
  canvas: '#F8FAFC',
  surface: '#FFFFFF',
  line: '#E6ECEE',
  gold: '#F4B942',
  goldSoft: '#FFF5DE',
  green: '#18845B',
  greenSoft: '#E7F5EE',
  red: '#C64C4C',
  redSoft: '#FCECEC',
  blue: '#4675C2',
  blueSoft: '#EAF0FC',
  purple: '#7456B8',
  purpleSoft: '#F1EDFB',
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
  navItemActive: 'inset 2px 2px 6px rgba(220, 38, 38, 0.12), inset -2px -2px 5px rgba(255, 255, 255, 0.96)',
  navTile: 'inset 2px 2px 5px rgba(71, 85, 105, 0.14), inset -2px -2px 5px rgba(255, 255, 255, 0.96)',
  navTileActive: 'inset 2px 2px 5px rgba(127, 29, 29, 0.32), inset -2px -2px 5px rgba(255, 255, 255, 0.18)',
  logo: '0px 4px 12px rgba(15, 23, 42, 0.12), 0px 1px 2px rgba(15, 23, 42, 0.08), inset 0px 2px 3px rgba(255, 255, 255, 1), inset 0px -3px 6px rgba(148, 163, 184, 0.22)',
  navHome: '0px 5px 16px rgba(185, 28, 28, 0.32), 0px 0px 0px 3px rgba(254, 202, 202, 0.6), inset 0px 3px 5px rgba(255, 255, 255, 0.5), inset 0px -5px 8px rgba(127, 29, 29, 0.5)',
} as const;

export const typography = {
  micro: 14,
  hero: 34,
  display: 30,
  title: 24,
  subheading: 21,
  heading: 19,
  body: 16,
  small: 15,
  caption: 14,
} as const;
