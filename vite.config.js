import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000, // Aumenta o limite para 1MB
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.html'),
        background: resolve(__dirname, 'src/background.js'),
        content: resolve(__dirname, 'src/content.js')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Mantém os nomes dos arquivos para a extensão
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'content') return 'content.js';
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Mantém CSS e HTML com nomes corretos
          if (assetInfo.name?.endsWith('.css')) return '[name].css';
          if (assetInfo.name?.endsWith('.html')) return 'popup.html'; // Força o nome popup.html
          return 'assets/[name]-[hash][extname]';
        },
        // Otimização: Separar dependências grandes em chunks menores
        manualChunks: (id) => {
          // Separar node_modules em vendor
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    },
    emptyOutDir: true,
    copyPublicDir: false // Desabilita cópia automática do public
  },
  publicDir: false // Desabilita o diretório public padrão do Vite
});
