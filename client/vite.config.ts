import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Le navigateur contacte le client local ; Vite transmet uniquement l'API Matrix.
    proxy: { '/_matrix': { target: 'http://127.0.0.1:8008' } },
  },
});
