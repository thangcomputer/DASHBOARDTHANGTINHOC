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
        /* Fluid tokens — dùng thay text-[9px]/text-[10px] */
        'fluid-xs': ['clamp(0.75rem, 0.7rem + 0.25vw, 0.8125rem)', { lineHeight: '1.25' }],
        'fluid-sm': ['clamp(0.8125rem, 0.78rem + 0.3vw, 0.875rem)', { lineHeight: '1.4' }],
        'fluid-base': ['clamp(0.875rem, 0.84rem + 0.35vw, 1rem)', { lineHeight: '1.5' }],
        'fluid-lg': ['clamp(1rem, 0.92rem + 0.5vw, 1.125rem)', { lineHeight: '1.4' }],
        'fluid-xl': ['clamp(1.125rem, 1rem + 0.75vw, 1.25rem)', { lineHeight: '1.3' }],
        'fluid-2xl': ['clamp(1.25rem, 1.1rem + 1vw, 1.5rem)', { lineHeight: '1.25' }],
        'fluid-3xl': ['clamp(1.5rem, 1.2rem + 1.5vw, 1.875rem)', { lineHeight: '1.2' }],
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom, 0px)',
        'safe-r': 'env(safe-area-inset-right, 0px)',
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
      }
    },
  },
  plugins: [],
}
