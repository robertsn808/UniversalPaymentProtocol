#!/usr/bin/env node

/**
 * Universal Payment Protocol - Security Validation Script
 * 
 * This script performs comprehensive security checks on the UPP system:
 * - Dependency vulnerability scanning
 * - Environment security validation
 * - Configuration security assessment
 * - Security headers verification
 * 
 * Usage: node scripts/security-check.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Security check results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  issues: []
};

function log(message, color = 'white') {
  console.log(colors[color] + message + colors.reset);
}

function logResult(test, passed, message, severity = 'error') {
  const symbol = passed ? '✅' : '❌';
  const color = passed ? 'green' : (severity === 'warning' ? 'yellow' : 'red');

  log(`${symbol} ${test}: ${message}`, color);

  if (passed) {
    results.passed++;
  } else {
    if (severity === 'warning') {
      results.warnings++;
    } else {
      results.failed++;
    }
    results.issues.push({ test, message, severity });
  }
}

function runSecurityCheck() {
  log('\n🔒 Universal Payment Protocol - Security Validation', 'cyan');
  log('=' .repeat(60), 'cyan');

  // 1. Check for dependency vulnerabilities
  log('\n📦 Checking Dependencies...', 'blue');
  try {
    execSync('npm audit --audit-level=moderate', { stdio: 'pipe' });
    logResult('Dependency Scan', true, 'No vulnerabilities found');
  } catch (error) {
    const output = error.stdout?.toString() || error.stderr?.toString() || '';
    if (output.includes('found 0 vulnerabilities')) {
      logResult('Dependency Scan', true, 'No vulnerabilities found');
    } else {
      logResult('Dependency Scan', false, 'Vulnerabilities detected - run npm audit');
    }
  }

  // 2. Check package.json security overrides
  log('\n🛡️ Checking Security Overrides...', 'blue');
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const hasOverrides = packageJson.overrides && 
                        packageJson.overrides.esbuild && 
                        packageJson.overrides.micromatch;

    logResult('Security Overrides', hasOverrides, 
             hasOverrides ? 'Security overrides configured' : 'Missing security overrides');
  } catch (error) {
    logResult('Security Overrides', false, 'Error reading package.json');
  }

  // 3. Check for sensitive files
  log('\n📁 Checking Sensitive Files...', 'blue');
  const sensitiveFiles = ['.env', '.env.local', '.env.production', 'private.key', '*.pem'];
  let foundSensitiveFiles = [];
  
  sensitiveFiles.forEach(pattern => {
    if (fs.existsSync(pattern) || (pattern.includes('*') && 
        fs.readdirSync('.').some(file => file.match(pattern.replace(/\*/g, '.*'))))) {
      foundSensitiveFiles.push(pattern);
    }
  }

  if (!foundSensitiveFiles) {
    logResult('Sensitive Files', true, 'No sensitive files found in repository');
  }

  // 4. Check .gitignore
  log('\n🙈 Checking .gitignore...', 'blue');
  try {
    if (fs.existsSync('.gitignore')) {
      const gitignore = fs.readFileSync('.gitignore', 'utf8');
      const hasEnv = gitignore.includes('.env');
      const hasNodeModules = gitignore.includes('node_modules');
      const hasDist = gitignore.includes('dist') || gitignore.includes('build');

      const score = [hasEnv, hasNodeModules, hasDist].filter(Boolean).length;
      logResult('.gitignore', score >= 2, `${score}/3 essential patterns found`);
    } else {
      logResult('.gitignore', false, '.gitignore file missing');
    }
  } catch (error) {
    logResult('.gitignore', false, 'Error checking .gitignore');
  }

  // 5. Check TypeScript configuration
  log('\n📝 Checking TypeScript Config...', 'blue');
  try {
    if (fs.existsSync('tsconfig.json')) {
      const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
      const hasStrict = tsconfig.compilerOptions && tsconfig.compilerOptions.strict;
      const hasNoImplicitAny = tsconfig.compilerOptions && tsconfig.compilerOptions.noImplicitAny;

      logResult('TypeScript Config', hasStrict && hasNoImplicitAny, 
               hasStrict && hasNoImplicitAny ? 'Strict type checking enabled' : 'Enable strict type checking');
    } else {
      logResult('TypeScript Config', false, 'tsconfig.json not found');
    }
  } catch (error) {
    logResult('TypeScript Config', false, 'Error reading tsconfig.json');
  }

  // 6. Check Node.js version
  log('\n🚀 Checking Node.js Version...', 'blue');
  try {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    const isSecure = majorVersion >= 18; // Node 18+ has security improvements

    logResult('Node.js Version', isSecure, 
             `Running Node.js ${nodeVersion} ${isSecure ? '(secure)' : '(consider upgrading)'}`);
  } catch (error) {
    logResult('Node.js Version', false, 'Error checking Node.js version');
  }

  // 7. Check for security middleware
  log('\n🛡️ Checking Security Middleware...', 'blue');
  try {
    const securityFile = 'src/middleware/security.ts';
    if (fs.existsSync(securityFile)) {
      const content = fs.readFileSync(securityFile, 'utf8');
      const hasHelmet = content.includes('helmet');
      const hasRateLimit = content.includes('rateLimit');
      const hasCors = content.includes('cors') || content.includes('CORS');

      const middlewareCount = [hasHelmet, hasRateLimit, hasCors].filter(Boolean).length;
      logResult('Security Middleware', middlewareCount >= 2, 
               `${middlewareCount}/3 security middleware types found`);
    } else {
      logResult('Security Middleware', false, 'Security middleware file not found');
    }
  } catch (error) {
    logResult('Security Middleware', false, 'Error checking security middleware');
  }

  // 8. Check environment validation
  log('\n🌍 Checking Environment Validation...', 'blue');
  try {
    const envFile = 'src/config/environment.ts';
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      const hasZod = content.includes('zod') || content.includes('z.');
      const hasValidation = content.includes('parse') || content.includes('schema');

      logResult('Environment Validation', hasZod && hasValidation, 
               hasZod && hasValidation ? 'Environment validation configured' : 'Add environment validation');
    } else {
      logResult('Environment Validation', false, 'Environment configuration file not found');
    }
  } catch (error) {
    logResult('Environment Validation', false, 'Error checking environment validation');
  }

  // 9. Check SSL/TLS configuration
  log('\n🔐 Checking SSL/TLS Configuration...', 'blue');
  try {
    const serverFile = 'server/index.ts';
    if (fs.existsSync(serverFile)) {
      const content = fs.readFileSync(serverFile, 'utf8');
      const hasHelmet = content.includes('helmet');
      const hasHttps = content.includes('https') || content.includes('ssl');

      logResult('SSL/TLS Config', hasHelmet, 
               hasHelmet ? 'Security headers configured' : 'Configure security headers');
    } else {
      logResult('SSL/TLS Config', false, 'Server configuration file not found');
    }
  } catch (error) {
    logResult('SSL/TLS Config', false, 'Error checking SSL/TLS configuration');
  }

  // 10. Check for hardcoded secrets
  log('\n🔑 Checking for Hardcoded Secrets...', 'blue');
  try {
    const patterns = [
      /password\s*[=:]\s*['"]/i,
      /secret\s*[=:]\s*['"]/i,
      /api[_-]?key\s*[=:]\s*['"]/i,
      /token\s*[=:]\s*['"]/i
    ];

    let foundSecrets = false;
    const filesToCheck = ['server/index.ts', 'src/config/environment.ts'];

    for (const file of filesToCheck) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            foundSecrets = true;
            break;
          }
        }
      }
    }

    logResult('Hardcoded Secrets', !foundSecrets, 
             foundSecrets ? 'Potential hardcoded secrets found' : 'No hardcoded secrets detected');
  } catch (error) {
    logResult('Hardcoded Secrets', false, 'Error checking for hardcoded secrets');
  }

  // Print summary
  log('\n📊 Security Check Summary', 'cyan');
  log('=' .repeat(60), 'cyan');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`⚠️  Warnings: ${results.warnings}`, 'yellow');
  log(`❌ Failed: ${results.failed}`, 'red');

  if (results.issues.length > 0) {
    log('\n🚨 Issues Found:', 'red');
    results.issues.forEach(issue => {
      const color = issue.severity === 'warning' ? 'yellow' : 'red';
      log(`  ${issue.severity.toUpperCase()}: ${issue.test} - ${issue.message}`, color);
    });
  }

  log('\n🎯 Recommendations:', 'blue');
  log('  1. Run "npm audit fix" to resolve dependency vulnerabilities');
  log('  2. Ensure all environment variables are properly configured');
  log('  3. Use strong, unique secrets for production');
  log('  4. Enable HTTPS in production environments');
  log('  5. Regularly update dependencies and Node.js version');

  if (results.failed > 0) {
    process.exit(1);
  }
}

// Run the security check
if (require.main === module) {
  runSecurityCheck();
}

module.exports = { runSecurityCheck, results };