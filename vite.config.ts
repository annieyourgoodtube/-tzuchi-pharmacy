import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 確保 process.env.API_KEY 在前端環境中可用
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  resolve: {
    // 協助 Rollup 解析無副檔名的模組引用
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});