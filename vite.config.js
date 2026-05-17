import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 다양한 호스팅 플랫폼 지원:
// - Vercel/Netlify/Cloudflare Pages: 루트(/)에 배포 — 기본값
// - GitHub Pages (user.github.io/repo): BASE_PATH=/repo/ 환경변수 설정
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : 5174,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
})
