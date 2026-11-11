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
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
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
      'landingpage-dewskill/**',
      'thang-tin-hoc-mobile/**',
      'modules/**/*ModelName*',
      'uploads/**',
      'tests/**',
      'scripts/**',
      'deploy_scripts/**',
      '*.log',
    ],
  },
];
