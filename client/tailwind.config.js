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
    extend: {
      fontFamily: {
        sans: ['Roboto', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      fontSize: {
        /* Fluid tokens — scale lên rõ hơn trên laptop/desktop */
        'fluid-xs': ['clamp(0.75rem, 0.7rem + 0.35vw, 0.875rem)', { lineHeight: '1.3' }],
        'fluid-sm': ['clamp(0.8125rem, 0.76rem + 0.4vw, 0.9375rem)', { lineHeight: '1.4' }],
        'fluid-base': ['clamp(0.9375rem, 0.88rem + 0.4vw, 1.0625rem)', { lineHeight: '1.5' }],
        'fluid-lg': ['clamp(1.0625rem, 0.95rem + 0.55vw, 1.1875rem)', { lineHeight: '1.4' }],
        'fluid-xl': ['clamp(1.1875rem, 1.05rem + 0.7vw, 1.375rem)', { lineHeight: '1.3' }],
        'fluid-2xl': ['clamp(1.375rem, 1.15rem + 1vw, 1.625rem)', { lineHeight: '1.25' }],
        'fluid-3xl': ['clamp(1.625rem, 1.3rem + 1.4vw, 2rem)', { lineHeight: '1.2' }],
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
