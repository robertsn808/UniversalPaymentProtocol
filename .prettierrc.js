module.exports = {
  // Basic formatting
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  doubleQuote: false,
  tabWidth: 2,
  useTabs: false,
  
  // Line length
  printWidth: 100,
  
  // Bracket formatting
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  
  // Object and array formatting
  endOfLine: 'lf',
  insertPragma: false,
  requirePragma: false,
  
  // TypeScript specific
  parser: 'typescript',
  
  // Override for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        parser: 'json',
        printWidth: 120
      }
    },
    {
      files: '*.md',
      options: {
        parser: 'markdown',
        printWidth: 80,
        proseWrap: 'always'
      }
    },
    {
      files: '*.html',
      options: {
        parser: 'html',
        printWidth: 120
      }
    }
  ]
};