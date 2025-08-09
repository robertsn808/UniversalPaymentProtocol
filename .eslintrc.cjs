module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
    'prettier'
  ],
  plugins: ['@typescript-eslint', 'import', 'prettier'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    // TypeScript Rules
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-return-type': 'off', 
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/restrict-template-expressions': 'error',
    '@typescript-eslint/restrict-plus-operands': 'error',
    '@typescript-eslint/unbound-method': 'error',
    
    // General JavaScript Rules
    'no-console': 'warn', // Allow console in development, warn in production
    'prefer-const': 'error',
    'no-var': 'error',
    'no-unused-expressions': 'error',
    'no-unreachable': 'error',
    'no-duplicate-imports': 'error',
    'no-self-compare': 'error',
    'array-callback-return': 'error',
    'consistent-return': 'error',
    'default-case': 'error',
    'eqeqeq': ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-return-assign': 'error',
    'no-throw-literal': 'error',
    'radix': 'error',
    
    // Import Rules  
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external', 
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'always',
      'alphabetize': {
        'order': 'asc',
        'caseInsensitive': true
      }
    }],
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'off', // Let TypeScript handle this
    
    // Security Rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    
    // Prettier integration
    'prettier/prettier': 'error'
  },
  ignorePatterns: [
    'dist/**',
    'node_modules/**',
    '*.js',
    'coverage/**',
    'src/__tests__/**',
    'vitest.config.ts',
    '.eslintrc.cjs',
    'openapi-mcp-server/**',
  ],
};