import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy MUST use IPv6 loopback on Windows when another process
// (e.g. Challenge.exe) steals 127.0.0.1:5000 — Node often listens on [::]:5000 only.
const DEV_API = process.env.VITE_DEV_API_PROXY || 'http://[::1]:5000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Không cần VITE_API_URL khi dev: /api → backend (tránh lỗi fetch HTML 404)
      '/api': {
        target: DEV_API,
        changeOrigin: true,
      },
      '/uploads': {
        target: DEV_API,
        changeOrigin: true,
      },
      '/socket.io': {
        target: DEV_API,
        ws: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@tensorflow-models/face-detection', '@mediapipe/face_detection']
  },
  build: {
    // Tăng giới hạn chunk cảnh báo
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            if (id.includes('socket.io-client')) {
              return 'vendor-socket';
            }
            if (id.includes('recharts')) {
              return 'vendor-chart';
            }
            // Heavy libs — chỉ tải khi user xuất Excel/PDF
            if (id.includes('node_modules/xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
              return 'vendor-pdf';
            }
            return 'vendor';
          }
        }
      },
    },
  },
})

