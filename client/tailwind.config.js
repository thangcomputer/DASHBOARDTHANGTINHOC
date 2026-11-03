/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      xs: '376px',   /* iPhone SE và màn hình nhỏ */
      sm: '576px',   /* Mobile landscape / tablet nhỏ */
      md: '768px',
      lg: '992px',   /* Desktop / laptop */
      xl: '1200px',
      '2xl': '1400px',
    },
    fontSize: {
      xs: ['var(--font-size-xs)', { lineHeight: 'var(--line-height-normal)' }],
      sm: ['var(--font-size-sm)', { lineHeight: 'var(--line-height-normal)' }],
      base: ['var(--font-size-md)', { lineHeight: 'var(--line-height-relaxed)' }],
      lg: ['var(--font-size-lg)', { lineHeight: 'var(--line-height-normal)' }],
      xl: ['var(--font-size-xl)', { lineHeight: 'var(--line-height-normal)' }],
      '2xl': ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-compact)' }],
      '3xl': ['var(--font-size-3xl)', { lineHeight: 'var(--line-height-compact)' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      '5xl': ['3rem', { lineHeight: '1' }],
      '6xl': ['3.75rem', { lineHeight: '1' }],
      '7xl': ['4.5rem', { lineHeight: '1' }],
      '8xl': ['6rem', { lineHeight: '1' }],
      '9xl': ['8rem', { lineHeight: '1' }],
      'fluid-xs': ['var(--font-size-xs)', { lineHeight: 'var(--line-height-normal)' }],
      'fluid-sm': ['var(--font-size-sm)', { lineHeight: 'var(--line-height-normal)' }],
      'fluid-base': ['var(--font-size-md)', { lineHeight: 'var(--line-height-relaxed)' }],
      'fluid-lg': ['var(--font-size-lg)', { lineHeight: 'var(--line-height-normal)' }],
      'fluid-xl': ['var(--font-size-xl)', { lineHeight: 'var(--line-height-normal)' }],
      'fluid-2xl': ['var(--font-size-2xl)', { lineHeight: 'var(--line-height-compact)' }],
      'fluid-3xl': ['var(--font-size-3xl)', { lineHeight: 'var(--line-height-compact)' }],
    },
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        cms: '1rem',
        'cms-lg': '1.25rem',
        'cms-xl': '1.5rem',
      },
      boxShadow: {
        cms: '0 4px 20px rgba(15, 23, 42, 0.04)',
        'cms-md': '0 8px 28px rgba(15, 23, 42, 0.08)',
        'cms-lg': '0 16px 40px rgba(15, 23, 42, 0.12)',
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom, 0px)',
        'safe-r': 'env(safe-area-inset-right, 0px)',
        'safe-l': 'env(safe-area-inset-left, 0px)',
        'safe-t': 'env(safe-area-inset-top, 0px)',
      },
      colors: {
        brand: {
          red: '#d32f2f',
          darkRed: '#b71c1c',
          blue: '#1565c0',
          navy: '#203DB5',
          zalo: '#0068FF',
          shell: '#0f172a',
        }
      },
      transitionTimingFunction: {
        cms: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
