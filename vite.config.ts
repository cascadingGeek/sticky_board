import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // TODO(backend): once the Node/Express API exists, proxy API calls to it:
  // server: { proxy: { '/api': 'http://localhost:3000' } }
});