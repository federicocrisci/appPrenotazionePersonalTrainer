import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['node_modules/**', 'www/**', '.angular/**', 'android/**', 'ios/**', 'src/environments/environment.ts', 'test-results/**', 'playwright-report/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly', fetch: 'readonly', Buffer: 'readonly', AbortSignal:'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } } },
  { files: ['**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } }
);
