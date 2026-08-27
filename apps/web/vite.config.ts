import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5183, strictPort: true },
  build: { target: 'es2022' },
  plugins: [react()],
});
