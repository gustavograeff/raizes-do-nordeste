import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base relativa: o mesmo build serve em domínio raiz e em subpasta de GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
