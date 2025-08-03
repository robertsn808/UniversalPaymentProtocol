#!/usr/bin/env tsx
/**
 * Universal Payment Protocol - Payment Standards Compliance Assertion Script
 * 
 * This script validates that our payment processing implementation adheres to
 * the UPP Payment Processing Standards & Rules defined in our standards document.
 * 
 * Run: npm run assert-compliance
 * Exit codes: 0 = compliant, 1 = violations found
 */

import fs from 'fs/promises';
import path from 'path';

interface ComplianceRule {
  id: string;
  category: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  check: () => Promise<ComplianceResult>;
}

interface ComplianceResult {
  passed: boolean;
  message: string;
  details?: string[];
  remediation?: string;
}

interface ComplianceReport {
  timestamp: string;
  total_rules: number;
  passed: number;
  failed: number;
  violations: Array<{
    rule_id: string;
    category: string;
    severity: string;
    message: string;
    details?: string[];
    remediation?: string;
  }>;
  overall_status: 'COMPLIANT' | 'NON_COMPLIANT';
}

class PaymentComplianceAssertion {
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  async runAllChecks(): Promise<ComplianceReport> {
    console.log('🔍 Running Universal Payment Protocol Compliance Checks...\n');

    const rules: ComplianceRule[] = [
      // Security Standards
      {
        id: 'SEC-001',
        category: 'Security Standards',
        description: 'Enforce PCI-DSS Level 1 compliance with AES-256 encryption',
        severity: 'critical',
        check: () => this.checkEncryptionStandards()
      },
      {
        id: 'SEC-002',
        category: 'Security Standards',
        description: 'Tokenize all stored card references and mask PANs',
        severity: 'critical',
        check: () => this.checkTokenizationAndMasking()
      },
      {
        id: 'SEC-003',
        category: 'Security Standards',
        description: 'Maintain detailed logs with PII masking and fraud detection',
        severity: 'high',
        check: () => this.checkLoggingCompliance()
      },
      {
        id: 'BIZ-001',
        category: 'Business Logic & Transaction Rules',
        description: 'API endpoints support idempotency via Idempotency-Key',
        severity: 'high',
        check: () => this.checkIdempotencySupport()
      },
      {
        id: 'DEV-001',
        category: 'Developer/Architecture Standards',
        description: 'Rate limiting and card testing attack detection',
        severity: 'high',
        check: () => this.checkRateLimitingAndProtection()
      },
      {
        id: 'CON-001',
        category: 'Non-Negotiable Constraints',
        description: 'Never log or expose unencrypted PII or PANs',
        severity: 'critical',
        check: () => this.checkPIIProtection()
      }
    ];

    const results: ComplianceReport = {
      timestamp: new Date().toISOString(),
      total_rules: rules.length,
      passed: 0,
      failed: 0,
      violations: [],
      overall_status: 'COMPLIANT'
    };

    console.log(`📋 Checking ${rules.length} compliance rules...\n`);

    for (const rule of rules) {
      process.stdout.write(`  ${rule.id}: ${rule.description}... `);
      
      try {
        const result = await rule.check();
        
        if (result.passed) {
          console.log('✅ PASS');
          results.passed++;
        } else {
          console.log('❌ FAIL');
          results.failed++;
          results.violations.push({
            rule_id: rule.id,
            category: rule.category,
            severity: rule.severity,
            message: result.message,
            details: result.details,
            remediation: result.remediation
          });
        }
      } catch (error: any) {
        console.log('🚨 ERROR');
        results.failed++;
        results.violations.push({
          rule_id: rule.id,
          category: rule.category,
          severity: 'critical',
          message: `Check failed with error: ${error.message}`,
          remediation: 'Fix the compliance check implementation'
        });
      }
    }

    results.overall_status = results.failed === 0 ? 'COMPLIANT' : 'NON_COMPLIANT';
    return results;
  }

  // Security Standards Checks
  private async checkEncryptionStandards(): Promise<ComplianceResult> {
    const securityConfig = await this.readFileIfExists('config/security.json');
    
    if (!securityConfig) {
      return {
        passed: false,
        message: 'Security configuration file not found',
        remediation: 'Create config/security.json with encryption standards'
      };
    }

    const config = JSON.parse(securityConfig);
    const encryption = config.pci_compliance?.encryption;

    if (!encryption) {
      return {
        passed: false,
        message: 'Encryption configuration missing from security config'
      };
    }

    const issues = [];
    if (encryption.data_at_rest !== 'AES-256') {
      issues.push('Data at rest encryption must be AES-256');
    }
    if (!encryption.data_in_transit?.includes('TLS 1.2')) {
      issues.push('Data in transit must use TLS 1.2+');
    }

    return {
      passed: issues.length === 0,
      message: issues.length === 0 ? 'Encryption standards compliant' : 'Encryption standards violations found',
      details: issues
    };
  }

  private async checkTokenizationAndMasking(): Promise<ComplianceResult> {
    const codeFiles = await this.findTypeScriptFiles();
    const violations = [];

    for (const file of codeFiles) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Check for prohibited storage
      const prohibitedPatterns = [
        /\.cvv\s*[=:]/i,
        /\.cvc\s*[=:]/i,
        /track.*data/i,
        /full.*pan/i
      ];

      for (const pattern of prohibitedPatterns) {
        if (pattern.test(content)) {
          violations.push(`${file}: Potential prohibited data storage detected`);
        }
      }

      // Check for PAN masking implementation
      if (content.includes('card_number') || content.includes('pan')) {
        if (!content.includes('mask') && !content.includes('****')) {
          violations.push(`${file}: PAN data found without masking implementation`);
        }
      }
    }

    return {
      passed: violations.length === 0,
      message: violations.length === 0 ? 'Tokenization and masking compliant' : 'Tokenization violations found',
      details: violations
    };
  }

  private async checkLoggingCompliance(): Promise<ComplianceResult> {
    const loggingFile = await this.readFileIfExists('services/payments/logging.ts');
    
    if (!loggingFile) {
      return {
        passed: false,
        message: 'Payment logging service not found',
        remediation: 'Implement services/payments/logging.ts'
      };
    }

    const issues = [];
    
    // Check for PII masking functions
    if (!loggingFile.includes('maskPII') && !loggingFile.includes('sanitize')) {
      issues.push('PII masking functions not implemented');
    }

    // Check for audit logging methods
    const requiredMethods = ['logPaymentActivity', 'logSecurityEvent', 'logDataAccess'];
    for (const method of requiredMethods) {
      if (!loggingFile.includes(method)) {
        issues.push(`Required logging method ${method} not found`);
      }
    }

    return {
      passed: issues.length === 0,
      message: issues.length === 0 ? 'Logging compliance implemented' : 'Logging violations found',
      details: issues
    };
  }

  private async checkIdempotencySupport(): Promise<ComplianceResult> {
    const routesFile = await this.readFileIfExists('routes/payments.ts');
    
    if (!routesFile) {
      return { passed: false, message: 'Payment routes not found' };
    }

    if (!routesFile.includes('idempotency') && !routesFile.includes('Idempotency-Key')) {
      return {
        passed: false,
        message: 'Idempotency support not implemented',
        remediation: 'Add Idempotency-Key header support to payment endpoints'
      };
    }

    return {
      passed: true,
      message: 'Idempotency support implemented'
    };
  }

  private async checkRateLimitingAndProtection(): Promise<ComplianceResult> {
    const routesFile = await this.readFileIfExists('routes/payments.ts');
    
    if (!routesFile) {
      return { passed: false, message: 'Payment routes not found' };
    }

    const hasRateLimit = routesFile.includes('rateLimit') || routesFile.includes('rate-limit');
    const hasCardTesting = routesFile.includes('cardTesting') || routesFile.includes('card-testing');

    const issues = [];
    if (!hasRateLimit) {
      issues.push('Rate limiting not implemented');
    }
    if (!hasCardTesting) {
      issues.push('Card testing protection not implemented');
    }

    return {
      passed: issues.length === 0,
      message: issues.length === 0 ? 'Rate limiting and protection implemented' : 'Protection violations found',
      details: issues
    };
  }

  private async checkPIIProtection(): Promise<ComplianceResult> {
    const codeFiles = await this.findTypeScriptFiles();
    const violations = [];

    for (const file of codeFiles) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Look for potential PII logging violations
      const piiPatterns = [
        /console\.log.*email/i,
        /console\.log.*phone/i,
        /console\.log.*ssn/i,
        /console\.log.*card/i,
        /console\.log.*pan/i
      ];

      for (const pattern of piiPatterns) {
        if (pattern.test(content)) {
          violations.push(`${file}: Potential PII logging detected`);
        }
      }
    }

    return {
      passed: violations.length === 0,
      message: violations.length === 0 ? 'PII protection implemented' : 'PII protection violations found',
      details: violations
    };
  }

  // Utility methods
  private async readFileIfExists(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(path.join(this.projectRoot, filePath), 'utf-8');
    } catch {
      return null;
    }
  }

  private async findTypeScriptFiles(): Promise<string[]> {
    const files: string[] = [];
    
    const searchDirs = ['src', 'routes', 'services', 'server'];
    
    for (const dir of searchDirs) {
      try {
        const dirPath = path.join(this.projectRoot, dir);
        const dirFiles = await this.getAllFiles(dirPath, '.ts');
        files.push(...dirFiles);
      } catch {
        // Directory doesn't exist, skip
      }
    }

    return files;
  }

  private async getAllFiles(dir: string, extension: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath, extension);
          files.push(...subFiles);
        } else if (entry.name.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory access error, skip
    }

    return files;
  }

  async generateReport(results: ComplianceReport): Promise<void> {
    console.log('\n📊 COMPLIANCE REPORT');
    console.log('=====================');
    console.log(`Timestamp: ${results.timestamp}`);
    console.log(`Total Rules: ${results.total_rules}`);
    console.log(`Passed: ${results.passed} ✅`);
    console.log(`Failed: ${results.failed} ❌`);
    console.log(`Overall Status: ${results.overall_status}`);

    if (results.violations.length > 0) {
      console.log('\n🚨 VIOLATIONS FOUND:');
      console.log('===================');

      for (const violation of results.violations) {
        console.log(`\n❌ ${violation.rule_id} (${violation.severity.toUpperCase()})`);
        console.log(`   Category: ${violation.category}`);
        console.log(`   Issue: ${violation.message}`);
        
        if (violation.details) {
          console.log(`   Details:`);
          violation.details.forEach(detail => console.log(`     - ${detail}`));
        }
        
        if (violation.remediation) {
          console.log(`   Remediation: ${violation.remediation}`);
        }
      }
    }

    // Write detailed report to file
    const reportPath = path.join(this.projectRoot, 'compliance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed report written to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  const assertion = new PaymentComplianceAssertion();
  
  try {
    const results = await assertion.runAllChecks();
    await assertion.generateReport(results);
    
    if (results.overall_status === 'NON_COMPLIANT') {
      console.log('\n❌ COMPLIANCE CHECK FAILED');
      console.log('Please address the violations above before proceeding.');
      process.exit(1);
    } else {
      console.log('\n✅ ALL COMPLIANCE CHECKS PASSED');
      console.log('Universal Payment Protocol is compliant with payment standards!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n🚨 COMPLIANCE CHECK ERROR:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { PaymentComplianceAssertion, ComplianceReport, ComplianceResult };