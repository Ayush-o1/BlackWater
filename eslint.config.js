import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'coverage/', 'playwright-report/', 'test-results/', 'prisma/migrations/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js', 'prisma/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // The browser code, and the e2e tests whose callbacks run inside the page.
    files: ['public/js/**/*.js', 'e2e/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
];
