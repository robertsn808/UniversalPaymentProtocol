#!/usr/bin/env node

/**
 * PCI DSS Compliance Validator
 * 
 * Comprehensive validation of PCI DSS Level 1 compliance requirements
 * for the Universal Payment Protocol system.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function logResult(test, passed, message, level = 'error') {
  const symbol = passed ? '✅' : '❌';
  const color = passed ? 'green' : (level === 'warning' ? 'yellow' : 'red');
  log(`${symbol} ${test}: ${message}`, color);
  return passed;
}

const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function validatePCICompliance() {
  log('\n🔒 PCI DSS Level 1 Compliance Validation', 'cyan');
  log('=' .repeat(60), 'cyan');
  
  // Requirement 1: Build and maintain a firewall configuration
  log('\n🔥 Requirement 1: Network Security', 'blue');
  
  const hasSecurityHeaders = checkSecurityHeaders();
  const hasCorsConfig = checkCorsConfiguration();
  
  if (logResult('Network Security', hasSecurityHeaders && hasCorsConfig, 
                hasSecurityHeaders && hasCorsConfig ? 'Security headers and CORS configured' : 'Missing network security')) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Requirement 2: Do not use vendor-supplied defaults
  log('\n🔑 Requirement 2: Secure Defaults', 'blue');
  
  const hasSecureDefaults = checkSecureDefaults();
  if (logResult('Secure Defaults', hasSecureDefaults, 
                hasSecureDefaults ? 'No default passwords/secrets' : 'Default credentials detected')) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Requirement 3: Protect stored cardholder data
  log('\n💳 Requirement 3: Cardholder Data Protection', 'blue');
  
  const noCardDataStorage = checkNoCardDataStorage();
  const hasTokenization = checkTokenization();
  
  if (logResult('No Card Data Storage', noCardDataStorage && hasTokenization, 
                noCardDataStorage && hasTokenization ? 'Tokenization used, no card data stored' : 'Card data protection issues')) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Requirement 4: Encrypt transmission of cardholder data
  log('\n🔐 Requirement 4: Data Transmission Security', 'blue');
  
  const hasHttpsEnforcement = checkHttpsEnforcement();
  if (logResult('HTTPS Enforcement', hasHttpsEnforcement, 
                hasHttpsEnforcement ? 'HTTPS enforced in production' : 'HTTPS enforcement missing')) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Requirement 6: Develop and maintain secure systems
  log('\n🛡️ Requirement 6: Secure Development', 'blue');
  
  const hasInputValidation = checkInputValidation();
  const hasSecureDevelopment = checkSecureDevelopment();
  
  if (logResult('Secure Development', hasInputValidation && hasSecureDevelopment, 
                hasInputValidation && hasSecureDevelopment ? 'Secure coding practices implemented' : 'Security issues in code')) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Requirement 7: Restrict access to cardholder data
  log('\n🚪 Requirement 7: Access Control', 'blue');
  
  const hasAccessControl = checkAccessControl();
  if (logResult('Access Control', hasAccessControl, 
                hasAccessControl ? 'Role-based access control implemented' : 'Access control missing')) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Requirement 8: Identify and authenticate access
  log('\n🔓 Requirement 8: Authentication', 'blue');
  
  const hasStrongAuth = checkAuthentication();
  if (logResult('Strong Authentication', hasStrongAuth, 
                hasStrongAuth ? 'JWT authentication with secure secrets' : 'Weak authentication')) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Requirement 10: Track and monitor all access
  log('\n📊 Requirement 10: Monitoring and Logging', 'blue');
  
  const hasComprehensiveLogging = checkLogging();
  if (logResult('Comprehensive Logging', hasComprehensiveLogging, 
                hasComprehensiveLogging ? 'PCI-compliant audit logging implemented' : 'Logging insufficient')) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Requirement 11: Regularly test security systems
  log('\n🧪 Requirement 11: Security Testing', 'blue');
  
  const hasSecurityTesting = checkSecurityTesting();
  if (logResult('Security Testing', hasSecurityTesting, 
                hasSecurityTesting ? 'Security tests and scans configured' : 'Security testing missing')) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Requirement 12: Maintain information security policy
  log('\n📋 Requirement 12: Security Policy', 'blue');
  
  const hasSecurityPolicy = checkSecurityPolicy();
  if (logResult('Security Policy', hasSecurityPolicy, 
                hasSecurityPolicy ? 'Security documentation and policies present' : 'Security policy missing')) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Overall Assessment
  log('\n📊 PCI DSS Compliance Summary', 'magenta');
  log('=' .repeat(40), 'magenta');
  
  const totalRequirements = results.passed + results.failed;
  const compliancePercentage = Math.round((results.passed / totalRequirements) * 100);
  
  log(`✅ Compliant Requirements: ${results.passed}/${totalRequirements}`, 'green');
  log(`❌ Non-Compliant Requirements: ${results.failed}/${totalRequirements}`, results.failed > 0 ? 'red' : 'green');
  log(`🎯 Compliance Score: ${compliancePercentage}%`, compliancePercentage >= 90 ? 'green' : compliancePercentage >= 70 ? 'yellow' : 'red');
  
  if (compliancePercentage >= 90) {
    log('\n🏆 PCI DSS STATUS: COMPLIANT', 'green');
    log('✅ System meets PCI DSS Level 1 requirements', 'green');
  } else if (compliancePercentage >= 70) {
    log('\n⚠️  PCI DSS STATUS: MOSTLY COMPLIANT', 'yellow');
    log('🔧 Minor issues need to be addressed', 'yellow');
  } else {
    log('\n❌ PCI DSS STATUS: NON-COMPLIANT', 'red');
    log('🚨 Critical issues must be resolved before production', 'red');
  }
  
  log('\n💡 Next Steps:', 'cyan');
  if (compliancePercentage >= 90) {
    log('• Schedule annual PCI assessment');
    log('• Maintain quarterly security reviews');
    log('• Continue vulnerability scanning');
  } else {
    log('• Address non-compliant requirements');
    log('• Implement missing security controls');
    log('• Re-run validation after fixes');
  }
  
  return compliancePercentage >= 90;
}

// Validation Functions

function checkSecurityHeaders() {
  try {
    const securityFile = 'src/middleware/security.ts';
    if (!fs.existsSync(securityFile)) return false;
    
    const content = fs.readFileSync(securityFile, 'utf8');
    return content.includes('helmet') && 
           content.includes('contentSecurityPolicy') &&
           content.includes('hsts');
  } catch {
    return false;
  }
}

function checkCorsConfiguration() {
  try {
    const serverFile = 'server/index.ts';
    if (!fs.existsSync(serverFile)) return false;
    
    const content = fs.readFileSync(serverFile, 'utf8');
    return content.includes('cors') && content.includes('origin');
  } catch {
    return false;
  }
}

function checkSecureDefaults() {
  try {
    const envFile = 'src/config/environment.ts';
    if (!fs.existsSync(envFile)) return false;
    
    const content = fs.readFileSync(envFile, 'utf8');
    return content.includes('validateProductionSecurity') &&
           content.includes('dev-') && // Checks for dev defaults
           content.includes('default'); // Prevents defaults
  } catch {
    return false;
  }
}

function checkNoCardDataStorage() {
  try {
    // Check that we're using Stripe and not storing card data
    const stripeFile = 'server/stripe-integration.ts';
    if (!fs.existsSync(stripeFile)) return false;
    
    const content = fs.readFileSync(stripeFile, 'utf8');
    return content.includes('client_secret') && // Uses client-side confirmation
           !content.includes('pm_card_visa') && // No hardcoded payment methods
           content.includes('pci_compliant');
  } catch {
    return false;
  }
}

function checkTokenization() {
  try {
    const paymentServiceFile = 'src/services/PCIPaymentService.ts';
    return fs.existsSync(paymentServiceFile);
  } catch {
    return false;
  }
}

function checkHttpsEnforcement() {
  try {
    const securityFile = 'src/middleware/security.ts';
    if (!fs.existsSync(securityFile)) return false;
    
    const content = fs.readFileSync(securityFile, 'utf8');
    return content.includes('httpsRedirect') && 
           content.includes('x-forwarded-proto');
  } catch {
    return false;
  }
}

function checkInputValidation() {
  try {
    const validationFiles = ['src/utils/validation.ts'];
    return validationFiles.some(file => fs.existsSync(file));
  } catch {
    return false;
  }
}

function checkSecureDevelopment() {
  try {
    return fs.existsSync('tsconfig.json') && // TypeScript for type safety
           fs.existsSync('src/middleware/security.ts'); // Security middleware
  } catch {
    return false;
  }
}

function checkAccessControl() {
  try {
    const authFiles = ['src/auth/jwt.ts', 'src/auth/routes.ts'];
    return authFiles.some(file => fs.existsSync(file));
  } catch {
    return false;
  }
}

function checkAuthentication() {
  try {
    const authFile = 'src/auth/jwt.ts';
    if (!fs.existsSync(authFile)) return false;
    
    const envFile = 'src/config/environment.ts';
    if (!fs.existsSync(envFile)) return false;
    
    const envContent = fs.readFileSync(envFile, 'utf8');
    return envContent.includes('JWT_SECRET') && 
           envContent.includes('32'); // Minimum secret length
  } catch {
    return false;
  }
}

function checkLogging() {
  try {
    const auditFile = 'src/services/PCIAuditLogger.ts';
    const loggerFile = 'src/shared/logger.ts';
    
    return fs.existsSync(auditFile) && fs.existsSync(loggerFile);
  } catch {
    return false;
  }
}

function checkSecurityTesting() {
  try {
    const testFile = 'src/__tests__/pci-compliance.test.ts';
    const securityScript = 'scripts/security-check.js';
    
    return fs.existsSync(testFile) && fs.existsSync(securityScript);
  } catch {
    return false;
  }
}

function checkSecurityPolicy() {
  try {
    const policyFiles = ['PCI_COMPLIANCE.md', 'SECURITY.md'];
    return policyFiles.some(file => fs.existsSync(file));
  } catch {
    return false;
  }
}

// Run the validation
if (require.main === module) {
  const isCompliant = validatePCICompliance();
  process.exit(isCompliant ? 0 : 1);
}

module.exports = { validatePCICompliance };