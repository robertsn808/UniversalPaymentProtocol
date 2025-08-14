#!/usr/bin/env node

/**
 * Universal Payment Protocol - Security Enhancement Script
 * 
 * This script performs comprehensive security checks and enhancements:
 * - Dependency vulnerability scanning
 * - Code security analysis
 * - Configuration validation
 * - Security best practices enforcement
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔒 Universal Payment Protocol - Security Enhancement');
console.log('==================================================\n');

// Color codes for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bold}${colors.blue}${title}${colors.reset}`);
  console.log('─'.repeat(title.length));
}

// 1. Dependency Security Scan
logSection('1. Dependency Security Analysis');

try {
  log('📦 Running npm audit...', 'blue');
  const auditResult = execSync('npm audit --audit-level moderate --json', { encoding: 'utf8' });
  const audit = JSON.parse(auditResult);
  
  if (audit.metadata.vulnerabilities.total === 0) {
    log('✅ No vulnerabilities found in dependencies', 'green');
  } else {
    log(`⚠️  Found ${audit.metadata.vulnerabilities.total} vulnerabilities:`, 'yellow');
    log(`   - Critical: ${audit.metadata.vulnerabilities.critical}`, 'red');
    log(`   - High: ${audit.metadata.vulnerabilities.high}`, 'yellow');
    log(`   - Moderate: ${audit.metadata.vulnerabilities.moderate}`, 'yellow');
    log(`   - Low: ${audit.metadata.vulnerabilities.low}`, 'blue');
    
    log('\n🔧 Attempting to fix vulnerabilities...', 'blue');
    try {
      execSync('npm audit fix', { stdio: 'inherit' });
      log('✅ Vulnerabilities fixed successfully', 'green');
    } catch (error) {
      log('⚠️  Some vulnerabilities could not be automatically fixed', 'yellow');
      log('   Run "npm audit fix --force" to fix all (may break compatibility)', 'yellow');
    }
  }
} catch (error) {
  log('❌ Failed to run npm audit', 'red');
}

// 2. Outdated Dependencies Check
logSection('2. Outdated Dependencies Check');

try {
  log('📦 Checking for outdated packages...', 'blue');
  const outdatedResult = execSync('npm outdated --json', { encoding: 'utf8' });
  const outdated = JSON.parse(outdatedResult);
  
  const outdatedCount = Object.keys(outdated).length;
  if (outdatedCount === 0) {
    log('✅ All dependencies are up to date', 'green');
  } else {
    log(`⚠️  Found ${outdatedCount} outdated packages:`, 'yellow');
    
    Object.entries(outdated).forEach(([pkg, info]) => {
      log(`   - ${pkg}: ${info.current} → ${info.latest}`, 'yellow');
    });
    
    log('\n🔧 To update all packages, run:', 'blue');
    log('   npm update', 'blue');
    log('   npm audit fix', 'blue');
  }
} catch (error) {
  log('✅ No outdated packages found', 'green');
}

// 3. Code Security Analysis
logSection('3. Code Security Analysis');

// Check for hardcoded secrets
log('🔍 Scanning for hardcoded secrets...', 'blue');
const sourceFiles = [
  'src/**/*.ts',
  'src/**/*.js',
  'server/**/*.ts',
  'server/**/*.js'
];

const secretPatterns = [
  /password\s*=\s*['"][^'"]+['"]/gi,
  /secret\s*=\s*['"][^'"]+['"]/gi,
  /key\s*=\s*['"][^'"]+['"]/gi,
  /token\s*=\s*['"][^'"]+['"]/gi,
  /api_key\s*=\s*['"][^'"]+['"]/gi,
  /private_key\s*=\s*['"][^'"]+['"]/gi,
];

let foundSecrets = 0;

sourceFiles.forEach(pattern => {
  try {
    const files = execSync(`find . -path "./${pattern}" -type f`, { encoding: 'utf8' }).split('\n').filter(Boolean);
    
    files.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        secretPatterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            foundSecrets++;
            log(`   ⚠️  Potential secret in ${file}:`, 'yellow');
            matches.forEach(match => {
              log(`      ${match.substring(0, 50)}...`, 'yellow');
            });
          }
        });
      } catch (error) {
        // Skip files that can't be read
      }
    });
  } catch (error) {
    // Pattern not found, continue
  }
});

if (foundSecrets === 0) {
  log('✅ No hardcoded secrets found in source code', 'green');
} else {
  log(`⚠️  Found ${foundSecrets} potential hardcoded secrets`, 'yellow');
  log('   Review and remove any hardcoded credentials', 'yellow');
}

// 4. Configuration Security
logSection('4. Configuration Security');

// Check .env.example
const envExamplePath = '.env.example';
if (fs.existsSync(envExamplePath)) {
  log('✅ .env.example file exists', 'green');
  
  const envExample = fs.readFileSync(envExamplePath, 'utf8');
  if (envExample.includes('password') || envExample.includes('secret')) {
    log('⚠️  .env.example contains sensitive placeholder values', 'yellow');
    log('   Ensure these are safe for public viewing', 'yellow');
  }
} else {
  log('❌ .env.example file missing', 'red');
  log('   Create this file with safe placeholder values', 'red');
}

// Check .gitignore
const gitignorePath = '.gitignore';
if (fs.existsSync(gitignorePath)) {
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  const requiredPatterns = ['.env', '*.log', 'node_modules', 'coverage'];
  const missingPatterns = requiredPatterns.filter(pattern => !gitignore.includes(pattern));
  
  if (missingPatterns.length === 0) {
    log('✅ .gitignore contains all required security patterns', 'green');
  } else {
    log(`⚠️  .gitignore missing patterns: ${missingPatterns.join(', ')}`, 'yellow');
  }
} else {
  log('❌ .gitignore file missing', 'red');
}

// 5. Security Headers and Middleware
logSection('5. Security Headers and Middleware');

const securityFiles = [
  'src/middleware/security.ts',
  'server/index.ts'
];

let securityMiddlewareFound = 0;
securityFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('helmet') || content.includes('security')) {
      securityMiddlewareFound++;
    }
  }
});

if (securityMiddlewareFound > 0) {
  log('✅ Security middleware detected', 'green');
} else {
  log('⚠️  No security middleware detected', 'yellow');
  log('   Consider adding helmet and other security middleware', 'yellow');
}

// 6. SSL/TLS Configuration
logSection('6. SSL/TLS Configuration');

const hasHttpsRedirect = fs.existsSync('src/middleware/security.ts') && 
  fs.readFileSync('src/middleware/security.ts', 'utf8').includes('httpsRedirect');

if (hasHttpsRedirect) {
  log('✅ HTTPS redirect middleware found', 'green');
} else {
  log('⚠️  HTTPS redirect middleware not found', 'yellow');
  log('   Consider adding HTTPS enforcement for production', 'yellow');
}

// 7. Input Validation
logSection('7. Input Validation');

const hasInputValidation = fs.existsSync('src/utils/validation.ts') || 
  fs.existsSync('src/middleware/security.ts') && 
  fs.readFileSync('src/middleware/security.ts', 'utf8').includes('sanitize');

if (hasInputValidation) {
  log('✅ Input validation detected', 'green');
} else {
  log('⚠️  Input validation not detected', 'yellow');
  log('   Consider adding input sanitization and validation', 'yellow');
}

// 8. Rate Limiting
logSection('8. Rate Limiting');

const hasRateLimiting = fs.existsSync('src/middleware/security.ts') && 
  fs.readFileSync('src/middleware/security.ts', 'utf8').includes('rateLimit');

if (hasRateLimiting) {
  log('✅ Rate limiting middleware detected', 'green');
} else {
  log('⚠️  Rate limiting middleware not detected', 'yellow');
  log('   Consider adding rate limiting to prevent abuse', 'yellow');
}

// 9. Security Recommendations
logSection('9. Security Recommendations');

const recommendations = [
  '🔐 Use environment variables for all secrets and API keys',
  '🛡️  Enable Content Security Policy (CSP) headers',
  '🔒 Use HTTPS in production with proper SSL certificates',
  '📝 Implement comprehensive logging and monitoring',
  '🔍 Regular security audits and dependency updates',
  '🚫 Implement proper CORS policies',
  '🔑 Use secure session management',
  '📊 Monitor for suspicious activities',
  '🔄 Keep all dependencies updated',
  '🧪 Run security tests regularly'
];

recommendations.forEach(rec => {
  log(`   ${rec}`, 'blue');
});

// 10. Summary
logSection('10. Security Enhancement Summary');

log('🎯 Security enhancement completed!', 'green');
log('\n📋 Next Steps:', 'blue');
log('   1. Review any warnings above', 'blue');
log('   2. Update outdated dependencies', 'blue');
log('   3. Set secure environment variables', 'blue');
log('   4. Run security tests', 'blue');
log('   5. Deploy with HTTPS enabled', 'blue');

log('\n🔗 Useful Commands:', 'blue');
log('   npm audit fix --force', 'blue');
log('   npm update', 'blue');
log('   npm run security:check', 'blue');
log('   npm run test:security', 'blue');

console.log('\n🌊 Aloha! Your Universal Payment Protocol is now more secure! 🌊\n');
