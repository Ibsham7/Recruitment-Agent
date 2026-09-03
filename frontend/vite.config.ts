import { defineConfig, type PluginOption } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Puppeteer-based prerendering requires a full Chrome install with system
// libraries (libnspr4.so, etc.) that CI environments like Vercel don't have.
// Only enable it for local production builds where Chrome is available.
const isCI = !!(process.env.CI || process.env.VERCEL || process.env.SKIP_PRERENDER)

async function getPrerenderPlugin(): Promise<PluginOption | null> {
  if (isCI) return null
  const { default: prerender } = await import('@prerenderer/rollup-plugin')
  const { default: PuppeteerRenderer } = await import('@prerenderer/renderer-puppeteer')
  return prerender({
    routes: ['/', '/privacy', '/terms'],
    renderer: new PuppeteerRenderer({
      renderAfterTime: 3000,
      headless: true,
    }),
    postProcess(renderedRoute) {
      renderedRoute.html = renderedRoute.html.trim();
    },
  })
}

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(async () => {
  const prerenderPlugin = await getPrerenderPlugin()

  return {
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    // Pre-render public routes at build time so Googlebot sees full HTML
    // instead of an empty <div id="root"></div>. Skipped on Vercel/CI where
    // Chrome system libraries are unavailable.
    ...(prerenderPlugin ? [prerenderPlugin] : []),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    target: 'es2020',
    cssCodeSplit: true,
    cssMinify: true,
    chunkSizeWarningLimit: 600,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('motion') || id.includes('gsap')) return 'vendor-animation';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-ui';
          }
        }
      }
    }
  },

  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})

