// ESLint flat config for the standalone CLI / pre-commit hook.
//
// CRA + Craco already lints during `yarn start` / `yarn build` with these
// same rules (see craco.config.js eslint section). This file just makes the
// standalone `eslint` command pick up the same rules so pre-commit hooks and
// editor integrations see exactly what the dev server sees.

import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
    {
        ignores: [
            'build/**',
            'node_modules/**',
            'android/**',
            'ios/**',
            'public/**',
            'coverage/**',
            'plugins/**',
        ],
    },
    js.configs.recommended,
    {
        files: ['src/**/*.{js,jsx,mjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                process: 'readonly',
            },
        },
        plugins: {
            react,
            'react-hooks': reactHooks,
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {
            // React JSX awareness — fixes false-positive "X is defined but never used"
            // for components used as <X /> in JSX.
            ...react.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            'react/no-unknown-property': ['error', { ignore: ['css', 'cmdk-input-wrapper'] }],
            'react/display-name': 'off',
            // Apostrophes and quotes inside JSX text are fine — React renders them.
            'react/no-unescaped-entities': 'off',

            // Mirror the craco-configured rules so dev server and pre-commit agree
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',

            // Real bugs only — keep noise low
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_|^e$|^err$',
                ignoreRestSiblings: true,
            }],
            'no-undef': 'error',
            'no-dupe-keys': 'error',
            'no-unreachable': 'error',

            // The codebase intentionally swallows non-critical errors with
            // explanatory comments — don't fight that pattern.
            'no-empty': ['warn', { allowEmptyCatch: true }],
        },
    },
];
