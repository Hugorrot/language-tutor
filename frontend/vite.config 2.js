import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export default defineConfig(({ command }) => ({
  define: command === 'build' ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {},
  optimizeDeps: { include: ['react', 'react-dom/client', 'gsap', 'gsap/ScrollTrigger', 'gsap/SplitText', '@gsap/react', 'motion/react'] },
  plugins: [react(), {
    name: 'frontend-source-in-development',
    closeBundle() {
      if (command !== 'build') return;
      const index = fileURLToPath(new URL('./index.html', import.meta.url));
      let html = readFileSync(index, 'utf8');
      for (const ext of ['js', 'css']) {
        const bundle = readFileSync(fileURLToPath(new URL(`./generated/app.${ext}`, import.meta.url)));
        const hash = createHash('sha256').update(bundle).digest('hex').slice(0, 12);
        html = html.replace(new RegExp(`generated/app\\.${ext}(?:\\?v=[^" ]*)?`, 'g'), `generated/app.${ext}?v=${hash}`);
      }
      writeFileSync(index, html);
    },
    handleHotUpdate({ server, file }) {
      // Legacy controllers own DOM listeners; reload them as a unit instead of remounting roots.
      if (/\.(jsx?|html)$/.test(file)) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
    transformIndexHtml: { order: 'pre', handler(html) {
      return html.replace(/src="generated\/app\.js(?:\?[^" ]*)?"/, 'src="/src/main.jsx"')
        .replace(/<link rel="stylesheet" href="generated\/app\.css(?:\?[^" ]*)?">/, '');
    } },
  }],
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: {
    outDir: 'generated',
    lib: { entry: fileURLToPath(new URL('./src/main.jsx', import.meta.url)), formats: ['es'], fileName: () => 'app.js', cssFileName: 'app' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
}));
