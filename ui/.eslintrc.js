/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'react-app/jest',
    'plugin:react/recommended',
    'airbnb',
    'airbnb-typescript',
    'plugin:import/typescript',
    'plugin:prettier/recommended',
  ],
  overrides: [
    {
      files: ['src/pages/Chat/ImageGeneration/**/*'],
      rules: {
        'prettier/prettier': 'off',
        'import/order': 'off',
        'import/no-duplicates': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-void': 'off',
        'react/no-array-index-key': 'off',
        'no-restricted-syntax': 'off',
        'no-continue': 'off',
        'consistent-return': 'off',
        'prefer-destructuring': 'off',
        'prefer-template': 'off',
        'jsx-a11y/no-autofocus': 'off',
        'react/jsx-no-useless-fragment': 'off',
        'react/jsx-boolean-value': 'off',
        'jsx-a11y/no-noninteractive-element-interactions': 'off',
        '@typescript-eslint/no-loop-func': 'off',
        'no-await-in-loop': 'off',
        'no-plusplus': 'off',
        '@typescript-eslint/no-use-before-define': 'off',
        'no-promise-executor-return': 'off',
        'no-bitwise': 'off',
        'react/destructuring-assignment': 'off',
        '@typescript-eslint/no-shadow': 'off',
        'no-shadow': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',
        '@typescript-eslint/return-await': 'off',
        '@typescript-eslint/no-throw-literal': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'react/self-closing-comp': 'off',
        'import/no-cycle': 'off',
        'no-control-regex': 'off',
        'no-useless-return': 'off',
        'no-lonely-if': 'off',
        'react/no-unused-prop-types': 'off',
        'prefer-regex-literals': 'off',
        'no-new': 'off',
        'no-constant-condition': 'off',
      },
    },
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  plugins: ['react', '@typescript-eslint', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
    'no-unused-vars': 'off',
    'no-console': 'off',
    'import/prefer-default-export': 'off',
    'no-param-reassign': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/function-component-definition': 'off',
    'react/button-has-type': 'off',
    'react/no-unescaped-entities': 'off',
    'react/require-default-props': 'off',
    'arrow-body-style': 'off',
    "global-require": "off",
    'react/prop-types': 0,
    'react/no-danger': 'off',
    'jsx-a11y/no-static-element-interactions': 'off',
    'jsx-a11y/label-has-associated-control': 'off',
    'jsx-a11y/tabindex-no-positive': 'off',
    'jsx-a11y/control-has-associated-label': 'off',
    'func-names': 'off',
    'no-alert': 'off',
    'prefer-promise-reject-errors': 'off',
    '@typescript-eslint/naming-convention': 'off',
    'no-debugger': 'off',
    'max-len': 'off',
    'import/extensions': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react/jsx-props-no-spreading': 'off',
    '@typescript-eslint/default-param-last': 'off',
    'no-nested-ternary': 'off',
    'class-methods-use-this': 'off',
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          ['internal', 'parent', 'sibling', 'index'],
          'unknown',
        ],
        pathGroups: [
          {
            pattern: 'react*',
            group: 'external',
            position: 'before',
          },
          {
            pattern: '@/**',
            group: 'internal',
          },
          {
            pattern: './**',
            group: 'internal',
            position: 'after',
          },
          {
            pattern: '*.scss',
            patternOptions: { matchBase: true },
            group: 'unknown',
            position: 'after',
          },
        ],
        pathGroupsExcludedImportTypes: ['react'],
        'newlines-between': 'always',
      },
    ],
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/no-noninteractive-tabindex': 'off',
  },
};
