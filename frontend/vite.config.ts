import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    // Allow ngrok hosts (needed for the Slack OAuth HTTPS redirect)
    allowedHosts: ['.ngrok-free.app', '.ngrok.app'],
    // Same-origin API calls => auth cookie just works, no CORS cookie headaches
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } },
  },
});
