const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'node_modules 2/**',
      '.expo/**',
      '.expo 2/**',
      'assets 2/**',
      '**/* 2.*',
      '**/* 2/**',
    ],
  },
]);
