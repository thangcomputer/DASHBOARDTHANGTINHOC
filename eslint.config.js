const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/__tests__/**/*.{js,cjs,mjs}', '**/*.test.{js,cjs,mjs}'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'client/**',
      'thang-tin-hoc-mobile/dist/**',
      'thang-tin-hoc-mobile/.expo/**',
      'modules/**/*ModelName*',
      'uploads/**',
      'tests/**',
      'scripts/**',
      'deploy_scripts/**',
      '*.log',
    ],
  },
];
