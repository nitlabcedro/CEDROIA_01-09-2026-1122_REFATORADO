import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const raizProjeto = path.resolve(__dirname, '..');
  const env = loadEnv(mode, raizProjeto, '');

  // ⚠️  SEGURANÇA: Apenas variáveis seguras para o cliente são expostas aqui.
  // NUNCA adicione SUPABASE_SERVICE_ROLE_KEY ou qualquer chave secreta neste bloco.
  // A service role key é exclusiva do servidor (app.ts / Netlify Functions).
  const clientSafeEnv = {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      env.VITE_SUPABASE_URL || ''
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      env.VITE_SUPABASE_ANON_KEY || ''
    ),
  };

  return {
    root: __dirname,
    envDir: raizProjeto,
    publicDir: path.resolve(__dirname, 'public'),
    plugins: [react()],
    define: clientSafeEnv,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: path.resolve(raizProjeto, 'dist'),
      emptyOutDir: true,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
