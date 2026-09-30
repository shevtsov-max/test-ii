import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv } from 'vite'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd()), ...process.env }
  return {
    // Относительный base: сайт работает и в корне домена, и в подпапке GitHub Pages (/test-ii/)
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    plugins: [
      vue({ template: { transformAssetUrls } }),
      quasar({
        sassVariables: fileURLToPath(new URL('./src/styles/quasar-variables.sass', import.meta.url)),
      }),
      VitePWA({
        // Новая версия не включается сама: приложение показывает «Доступно обновление»
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons/*.png', 'photos/*.svg'],
        manifest: {
          id: './',
          name: 'Прапра — семейное древо',
          short_name: 'Прапра',
          description: 'Составляйте родословную: древо, персоны, события, документы и росписи. Работает без интернета.',
          lang: 'ru',
          dir: 'ltr',
          start_url: './#/app',
          scope: './',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone'],
          orientation: 'any',
          background_color: '#F6F4F0',
          theme_color: '#D24E26',
          categories: ['lifestyle', 'productivity', 'education'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
          shortcuts: [
            { name: 'Мои древа', url: './#/app', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
          // Нужен только для «чистых» адресов (VITE_ROUTER_MODE=history). В режиме hash все страницы — это index.html,
          // а без fallback работник не перехватывает соседние сайты в подпапках (эксперименты /путь/ на Pages).
          navigateFallback: env.VITE_ROUTER_MODE === 'history' ? 'index.html' : null,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    build: { chunkSizeWarningLimit: 900 },
    // Разработка с бэкендом (docker/compose.dev.yml): API на том же адресе, что и фронтенд — без CORS
    server: env.VITE_PROXY_TARGET
      ? {
          proxy: Object.fromEntries(
            ['/graphql', '/api', '/files', '/telegram', '/up'].map((p) => [p, { target: env.VITE_PROXY_TARGET, changeOrigin: false }]),
          ),
        }
      : undefined,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.js'],
    },
  }
})
