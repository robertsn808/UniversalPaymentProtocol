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
        fs.readdirSync('.').some(file => file.match(pattern.replace('*', '.*'))))) {
      foundSensitiveFiles.push(pattern);
    }
  });
  
  if (foundSensitiveFiles.length > 0) {
    logResult('Sensitive Files', false, 
             `Found sensitive files: ${foundSensitiveFiles.join(', ')} - ensure they're in .gitignore`);
  } else {
    logResult('Sensitive Files', true, 'No sensitive files found in repository');
  }
  
  // 4. Check .gitignore for security patterns
  log('\n🙈 Checking .gitignore Security...', 'blue');
  try {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    const requiredPatterns = ['.env', '*.key', '*.pem', 'node_modules/', 'logs/'];
    const missingPatterns = requiredPatterns.filter(pattern => 
      !gitignore.includes(pattern) && !gitignore.includes(pattern.replace('*', ''))
    );
    
    if (missingPatterns.length === 0) {
      logResult('GitIgnore Security', true, 'All security patterns present');
    } else {
      logResult('GitIgnore Security', false, 
               `Missing patterns: ${missingPatterns.join(', ')}`, 'warning');
    }
  } catch (error) {
    logResult('GitIgnore Security', false, '.gitignore file not found');
  }
  
  // 5. Check for hardcoded secrets
  log('\n🔑 Checking for Hardcoded Secrets...', 'blue');
  try {
    const suspiciousPatterns = [
      /sk_live_[a-zA-Z0-9]{24,}/g,  // Stripe live keys
      /pk_live_[a-zA-Z0-9]{24,}/g,  // Stripe live publishable keys
      /password\s*=\s*["'][^"']+["']/gi,
      /secret\s*=\s*["'][^"']+["']/gi,
      /api[_-]?key\s*=\s*["'][^"']+["']/gi
    ];
    
    const sourceFiles = ['src/**/*.ts', 'src/**/*.js', 'server/**/*.ts', 'server/**/*.js'];
    let foundSecrets = false;
    
    // Simple check - in production you'd use a more sophisticated tool
    sourceFiles.forEach(pattern => {
      try {
        const files = execSync(`find . -name "${pattern.split('**/')[1]}" 2>/dev/null || true`, 
                              { encoding: 'utf8' }).split('\n').filter(Boolean);
        
        files.forEach(file => {
          if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            suspiciousPatterns.forEach(pattern => {
              if (pattern.test(content)) {
                foundSecrets = true;
              }
            });
          }
        });
      } catch (error) {
        // Ignore errors from find command
      }
    });
    
    logResult('Hardcoded Secrets', !foundSecrets, 
             foundSecrets ? 'Potential secrets found in code' : 'No hardcoded secrets detected');
  } catch (error) {
    logResult('Hardcoded Secrets', false, 'Error scanning for secrets');
  }
  
  // 6. Check Node.js version
  log('\n🟢 Checking Node.js Version...', 'blue');
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
      const hasZodValidation = content.includes('zod') || content.includes('z.');
      const hasProductionCheck = content.includes('production');
      
      logResult('Environment Validation', hasZodValidation && hasProductionCheck, 
               hasZodValidation ? 'Environment validation configured' : 'Missing environment validation');
    } else {
      logResult('Environment Validation', false, 'Environment config file not found');
    }
  } catch (error) {
    logResult('Environment Validation', false, 'Error checking environment validation');
  }
  
  // Summary
  log('\n📊 Security Check Summary', 'magenta');
  log('=' .repeat(40), 'magenta');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`⚠️  Warnings: ${results.warnings}`, 'yellow');
  log(`❌ Failed: ${results.failed}`, 'red');
  
  if (results.issues.length > 0) {
    log('\n🚨 Issues to Address:', 'red');
    results.issues.forEach((issue, index) => {
      const severity = issue.severity === 'warning' ? '⚠️ ' : '❌';
      log(`${index + 1}. ${severity} ${issue.test}: ${issue.message}`);
    });
  }
  
  // Security score
  const totalChecks = results.passed + results.failed + results.warnings;
  const score = Math.round((results.passed / totalChecks) * 100);
  
  log(`\n🎯 Security Score: ${score}/100`, score >= 90 ? 'green' : score >= 70 ? 'yellow' : 'red');
  
  if (score >= 90) {
    log('🛡️  Security Status: EXCELLENT', 'green');
  } else if (score >= 70) {
    log('🛡️  Security Status: GOOD - Minor improvements needed', 'yellow');
  } else {
    log('🛡️  Security Status: NEEDS ATTENTION - Address critical issues', 'red');
  }
  
  log('\n💡 Recommendations:', 'cyan');
  log('• Run this check regularly (weekly recommended)');
  log('• Keep dependencies updated with npm update');
  log('• Monitor security advisories for your dependencies');
  log('• Use environment-specific configurations');
  log('• Enable security monitoring in production');
  
  // Exit with error code if critical issues found
  if (results.failed > 0) {
    process.exit(1);
  }
}

// Run the security check
if (require.main === module) {
  runSecurityCheck();
}

module.exports = { runSecurityCheck };
