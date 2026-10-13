module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'standard',
    'plugin:react/recommended'
  ],
  overrides: [
    {
      env: {
        browser: true,
        es2022: true,
        worker: true
      },
      files: ['worker/**/*.js'],
      globals: {
        HTMLRewriter: 'readonly'
      },
      parserOptions: {
        sourceType: 'module'
      }
    },
    {
      env: {
        node: true
      },
      files: ['.eslintrc.{js,cjs}'],
      parserOptions: {
        sourceType: 'script'
      }
    },
    {
      env: {
        node: true
      },
      files: ['vite.config.js'],
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest'
      }
    },
    {
      files: [
        '**/__tests__/**/*.{js,jsx,ts,tsx}',
        '**/*.{test,spec}.{js,jsx,ts,tsx}',
        'src/setupTests.js'
      ],
      env: {
        jest: true
      },
      globals: {
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly'
      },
      rules: {
        // Vitest requires vi.mock() before importing the module under test.
        // Do not let import/first (--fix) reorder those imports above mocks.
        'import/first': 'off'
      }
    }
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: [
    'react'
  ],
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    'react/prop-types': 'off',
    'no-useless-escape': 'off',
    'array-callback-return': 'off',
    'no-proto': 'off',
    'no-prototype-builtins': 'off',
    'no-return-assign': 'off',
    'no-sequences': 'off',
    'no-void': 'off',
    'no-unused-expressions': 'off',
    'react/display-name': 'off'
  }
}
