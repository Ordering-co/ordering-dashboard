import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { storeOnboardingTranslationsPlugin } from './scripts/storeOnboardingTranslations.mjs'
import { storefrontPreviewPlugin } from './scripts/storefrontPreviewServer.mjs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv, searchForWorkspaceRoot } from 'vite'
import { defineConfig } from 'vitest/config'
import { sourceDownloadsLocalPlugin } from './scripts/source-downloads-fixture-adapter.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const createConfig = base => ({
  base,
  plugins: [
    sourceDownloadsLocalPlugin({ searchWorkspaceRoot: searchForWorkspaceRoot }),
    tailwindcss(),
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
      // Scoped coverage gate; the full component library has ~237k statements.
      // pages + utils + shell UI + tested Shared primitives.
      // Expand coverage when additional components have tests.
      include: [
        'src/pages/**/*.{js,jsx}',
        'src/utils/**/*.{js,jsx}',
        'src/config.js',
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
        'src/@/components-dashboard/src/ui/src/components/Shared/MoreSidebarLayout/**/*.{js,jsx}',
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
        '**/styles.js',
        'src/@/components-dashboard/src/ui/src/themes/**',
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
