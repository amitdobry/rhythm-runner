import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Anything the browser asks for at /api goes to our Express server.
    // Same origin for the browser, so the session cookie just works.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
