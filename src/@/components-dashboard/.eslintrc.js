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
        node: true
      },
      files: [
        '.eslintrc.{js,cjs}'
      ],
      parserOptions: {
        sourceType: 'script'
      }
    },
    {
      files: [
        '**/__tests__/**/*.{js,jsx,ts,tsx}',
        '**/*.{test,spec}.{js,jsx,ts,tsx}'
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
    'import/no-duplicates': 'off',
    'prefer-regex-literals': 'off',
    'no-throw-literal': 'off'
  }
}
