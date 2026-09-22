// Flat ESLint config (ESLint 9+), TypeScript-aware.
// Tuned to catch real defects without arguing about style.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'ios/**', 'build/**', 'node_modules/**', 'coverage/**', 'public/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tools/**/*.ts', 'tools/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // The new JSX transform is in use; React need not be in scope.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // TypeScript types the props; PropTypes would be a second, worse copy.
      'react/prop-types': 'off',

      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Playback state is mirrored from native; a stray console in that path
      // fires several times a second.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['src/**/__tests__/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly',
        beforeEach: 'readonly', afterEach: 'readonly', beforeAll: 'readonly',
        afterAll: 'readonly', vi: 'readonly',
      },
    },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['tools/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];
