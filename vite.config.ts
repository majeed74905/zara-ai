
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // Fix: Use '.' instead of process.cwd() to resolve type error
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // This is critical: It replaces process.env.API_KEY in your code with the actual string during build
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Fallback for other process.env calls
      'process.env': {}
    },
    server: {
      port: 3000,
      open: true
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});
