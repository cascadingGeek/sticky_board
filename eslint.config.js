import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

const SURFACES = ['board', 'page-notes', 'site-access'];

export default tseslint.config(
  { ignores: ['dist', '.output', '.wxt', 'public'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // The drag handlers and WebAudio fallbacks use `any` deliberately
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  // Layer boundaries: imports point one way (entrypoints -> surfaces -> features -> lib/utils).
  ...layer('src/**', [], 'Import across folders with @/, relative paths only within a folder.'),
  ...layer('src/features/**', ['@/surfaces/*', '@/components/*', '@/hooks/*', '@/entrypoints/*'], 'Features hold data and rules, not UI.'),
  ...layer('src/{components,hooks,lib,utils}/**', ['@/features/*', '@/surfaces/*', '@/entrypoints/*'], 'Shared building blocks stay domain free.'),
  ...SURFACES.flatMap(s =>
    layer(`src/surfaces/${s}/**`, [...SURFACES.filter(o => o !== s).map(o => `@/surfaces/${o}/*`), '@/entrypoints/*'], 'A surface never imports another surface.'),
  ),
);

/** One no-restricted-imports block. Later blocks for the same file replace earlier ones, so each repeats the parent rule. */
function layer(files, group, message) {
  return [
    {
      files: [files],
      rules: {
        'no-restricted-imports': ['error', { patterns: [{ group: [...group, '../*'], message }] }],
      },
    },
  ];
}
