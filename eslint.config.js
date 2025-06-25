import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default compat.config({
  env: { browser: true, es2021: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier', 'plugin:prettier/recommended'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-this-alias': 'off',
  },
  ignorePatterns: ['cypress', 'examples', 'tutorial', 'src/plugins/spectrogram*', 'scripts'],
  overrides: [
    {
      files: ['src/__tests__/**/*.ts'],
      env: { jest: true, node: true },
      rules: {
        '@typescript-eslint/ban-ts-comment': 'off',
      },
    },
  ],
})
