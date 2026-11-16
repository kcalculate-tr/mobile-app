import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
export default defineConfig({
  root,
  envDir: import.meta.dirname, // .env OKUNMAZ
  plugins: [react()],
  resolve: { alias: [{ find: /^\.\.\/\.\.\/supabase$/, replacement: path.join(import.meta.dirname, 'mockSupabase.js') }] },
  server: { port: 5199, strictPort: true },
});
