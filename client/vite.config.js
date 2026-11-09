import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const MASCOT_DIR = fileURLToPath(new URL('../cam-xuc-animation', import.meta.url))
const MASCOT_URL = '/cam-xuc-animation'

function mascotContentType(file) {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  return 'application/octet-stream'
}

/** Phục vụ đúng thư mục cam-xuc-animation tại /cam-xuc-animation, kể cả bản build. */
function camXucAnimationStatic() {
  const root = path.resolve(MASCOT_DIR)
  return {
    name: 'cam-xuc-animation-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith(`${MASCOT_URL}/`)) return next()
        const rel = decodeURIComponent(url.slice(MASCOT_URL.length + 1).split('?')[0])
        const file = path.resolve(root, rel)
        if (file !== root && !file.startsWith(root + path.sep)) return next()
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
        res.setHeader('Content-Type', mascotContentType(file))
        res.setHeader('Cache-Control', 'public, max-age=86400')
        fs.createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      const out = path.resolve(process.cwd(), 'dist', 'cam-xuc-animation')
      fs.cpSync(root, out, { recursive: true })
    },
  }
}

// Dev proxy MUST use IPv6 loopback on Windows when another process
// (e.g. Challenge.exe) steals 127.0.0.1:5000 - Node often listens on [::]:5000 only.
const DEV_API = process.env.VITE_DEV_API_PROXY || 'http://[::1]:5000'
const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), camXucAnimationStatic()],
  server: {
    fs: {
      allow: [PROJECT_ROOT],
    },
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
            // Heavy libs - chỉ tải khi user xuất Excel/PDF
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
