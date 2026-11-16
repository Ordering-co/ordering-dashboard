import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { storeOnboardingTranslationsPlugin } from './scripts/storeOnboardingTranslations.mjs'
import { storefrontPreviewPlugin } from './scripts/storefrontPreviewServer.mjs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv, searchForWorkspaceRoot } from 'vite'
import { defineConfig } from 'vitest/config'
import { sourceDownloadsLocalPlugin } from './scripts/source-downloads-fixture-adapter.js'
import { buildVersionPayload } from './worker/version.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Two Tailwind builds coexist (docs/BRAND.md › Boundary). Tailwind 4 (`@tailwindcss/vite`, from main) compiles only the
// Mia buttons' sheet; the T1 pilot (`src/brand/pilot.css`, prefix `od-`) is Tailwind 3 through PostCSS (postcss.config.cjs),
// and Tailwind 4 would reject its `od-` utilities. Every other stylesheet goes past this plugin untouched.
const TAILWIND_V4_SHEET = /[\\/]styles[\\/]OrderingUi[\\/]tailwind\.css(?:\?.*)?$/
const tailwindForMiaOnly = () => tailwindcss().map(plugin => {
  const { transform } = plugin
  if (!transform) return plugin
  const handler = typeof transform === 'function' ? transform : transform.handler
  const scoped = function (code, id, ...rest) {
    return TAILWIND_V4_SHEET.test(id) ? handler.call(this, code, id, ...rest) : undefined
  }
  return { ...plugin, transform: typeof transform === 'function' ? scoped : { ...transform, handler: scoped } }
})

const createConfig = base => ({
  base,
  define: {
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(process.env.WORKERS_CI_COMMIT_SHA || '')
  },
  plugins: [
    sourceDownloadsLocalPlugin({ searchWorkspaceRoot: searchForWorkspaceRoot }),
    ...tailwindForMiaOnly(),
    storefrontPreviewPlugin(),
    storeOnboardingTranslationsPlugin(),
    {
      name: 'strip-node-protocol',
      enforce: 'pre',
      resolveId (source) {
        if (source && source.startsWith('node:')) {
          return source.slice(5)
        }
      }
    },
    react({
      include: /\.(js|jsx|ts|tsx)$/,
      babel: {
        babelrc: false,
        configFile: false,
        presets: [['@babel/preset-react', { runtime: 'automatic' }]],
        plugins: [
          [
            'babel-plugin-styled-components',
            {
              displayName: true,
              fileName: false
            }
          ]
        ]
      }
    }),
    {
      name: 'copy-config-json-to-dist',
      writeBundle () {
        const distDir = resolve(__dirname, 'dist')
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true })
        }
        copyFileSync(
          resolve(__dirname, 'src/config.json'),
          resolve(__dirname, 'dist/config.json')
        )
      }
    },
    {
      // WORKERS_CI_COMMIT_SHA exists only while Workers Builds runs this build, so it is
      // written next to the assets; worker/index.js serves it at GET /version
      // (docs/CLOUDFLARE.md › Verifying a deploy).
      name: 'write-version-json',
      writeBundle () {
        writeFileSync(resolve(__dirname, 'dist/version.json'), JSON.stringify(buildVersionPayload()))
      }
    }
  ],
  resolve: {
    alias: {
      '~': resolve(__dirname, 'src'),
      '~components': resolve(__dirname, 'src/@/components-dashboard/src'),
      '~ui': resolve(__dirname, 'src/@/components-dashboard/src/ui')
    }
  },
  publicDir: 'public',
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx'
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  server: {
    port: 3001,
    open: false,
    host: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Same zone as CI (GitHub-hosted, Mac containers and Namespace all run in UTC): tests that read the machine's zone as
    // «the browser zone» and use a fixed zone as «another one» broke on a machine set to that zone (America/Bogota).
    // Tests that need a given zone still set process.env.TZ themselves.
    env: { TZ: 'UTC' },
    setupFiles: './src/setupTests.js',
    // Git-hosted package path breaks vite-node (encoded "/" in pnpm store path).
    // Must stay test-only: in resolve.alias the no-op stub ships to dev/build and
    // silently removes every phone input in the app.
    alias: {
      'react-phone-number-input': resolve(__dirname, 'src/__tests__/stubs/react-phone-number-input.js'),
      'react-phone-number-input/min': resolve(__dirname, 'src/__tests__/stubs/react-phone-number-input.js'),
      'react-phone-number-input/input': resolve(__dirname, 'src/__tests__/stubs/react-phone-number-input.js')
    },
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}', 'worker/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      // PR CI only needs json (70% gate) and text (job logs). Skip html/lcov.
      reporter: ['text', 'json'],
      reportsDirectory: './coverage',
      // Include tested UI owners, foundations and compatible components.
      // Generated tokens and the Worker have separate checks.
      include: [
        'src/pages/**/*.{js,jsx}',
        'src/utils/**/*.{js,jsx}',
        'src/config.js',
        'src/App.js',
        'src/index.js',
        'src/brand/**/*.{js,jsx}',
        'src/components/**/*.{js,jsx}',
        'src/analytics/**/*.{js,jsx}',
        'src/@/components-dashboard/src/components/Popup/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/contexts/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/hooks/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/UI/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/Icon/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/styles/Select/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/styles/MultiSelect/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/styles/Toast/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/styles/fieldsTheme.js',
        'src/@/components-dashboard/src/ui/src/styles/selectTheme.js',
        'src/@/components-dashboard/src/utils/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/utils/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/styles/Buttons/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/styles/Checkbox/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/styles/Inputs/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/styles/Switch/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/styles/Tabs/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/styles/StandardField.js',
        'src/@/components-dashboard/src/ui/src/styles/index.js',
        'src/@/components-dashboard/src/ui/src/components/Shared/SearchBar/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/SideBar/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/Modal/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/Confirm/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/Pagination/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/PaginationButton/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/NotFoundSource/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/SpinnerLoader/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/ProtectedRoute/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/Image/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/LinkableText/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/Tabs/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Shared/SimpleSpinner/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/PageNotFound/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Banners/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/Layout/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/LogoutButton/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/NotNetworkConnectivity/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/WebsocketConnectionBanner/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/DisabledFeatureAlert/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/LanguageSelector/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/components/TrialExtension/**/*.{js,jsx}',
        'src/@/components-dashboard/src/ui/src/contexts/TrialExtensionContext/**/*.{js,jsx}'
      ],
      exclude: [
        'node_modules/',
        'dist/',
        'worker/**',
        '**/*.config.{js,ts}',
        '**/setupTests.js',
        '**/*.{test,spec}.{js,jsx,ts,tsx}',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/coverage/**',
        'src/brand/**/*.generated.js',
        '**/styles.js',
        'src/@/components-dashboard/src/sdk/**',
        'src/@/components-dashboard/src/ui/src/config/constants.js',
        'src/@/components-dashboard/src/ui/src/config/currency.js'
      ]
      // 70% average gate is enforced in CI (see .github/workflows/ci.yml).
    }
  }
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const assetBaseUrl =
    process.env.ASSET_BASE_URL ||
    process.env.VITE_ASSET_BASE_URL ||
    env.ASSET_BASE_URL ||
    env.VITE_ASSET_BASE_URL ||
    '/'

  return createConfig(
    assetBaseUrl.endsWith('/') ? assetBaseUrl : `${assetBaseUrl}/`
  )
})
