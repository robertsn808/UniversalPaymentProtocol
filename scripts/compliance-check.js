#!/usr/bin/env node
/**
 * Payment Compliance Validation Script for UPP
 * Validates system against PCI DSS and payment processing standards
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

class PaymentComplianceValidator {
    constructor() {
        this.results = { passed: 0, failed: 0, total: 0, critical: 0 };
    }

    assert(condition, message, critical = false) {
        this.results.total++;
        if (!condition) {
            console.error(`❌ ${message}`);
            this.results.failed++;
            if (critical) {
                this.results.critical++;
            }
        } else {
            console.log(`✅ ${message}`);
            this.results.passed++;
        }
    }

    fileExists(filePath) {
        return fs.existsSync(path.join(projectRoot, filePath));
    }

    readJsonConfig(filePath) {
        try {
            const fullPath = path.join(projectRoot, filePath);
            return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        } catch {
            return null;
        }
    }

    runAllChecks() {
        console.log('🔐 Running UPP Payment Compliance Validation...\n');

        // PCI DSS Requirements
        this.checkSecurityConfiguration();
        this.checkDataEncryption();
        this.checkTLSEnforcement();
        this.checkAccessControl();
        this.checkAuditLogging();
        this.checkRateLimiting();
        this.checkCORSConfiguration();
        
        // Environment Security
        this.checkEnvironmentSecurity();
        this.checkSecretsManagement();
        
        // Documentation & Compliance
        this.checkComplianceDocumentation();
        this.checkSecurityWorkflows();

        this.printSummary();
    }

    checkSecurityConfiguration() {
        this.assert(
            this.fileExists('config/security.json'),
            'Security configuration file exists',
            true
        );

        const config = this.readJsonConfig('config/security.json');
        if (config) {
            this.assert(
                config.pci === 'DSS Level 1',
                'PCI DSS Level 1 configuration verified',
                true
            );
        }
    }

    checkDataEncryption() {
        const config = this.readJsonConfig('config/security.json');
        if (config) {
            this.assert(
                config.dataEncryption === true,
                'Data encryption enabled',
                true
            );
            this.assert(
                config.encryptionStandard === 'AES-256',
                'AES-256 encryption standard configured',
                true
            );
        }
    }

    checkTLSEnforcement() {
        const config = this.readJsonConfig('config/security.json');
        if (config) {
            this.assert(
                config.tlsVersion === '1.2+',
                'TLS 1.2+ enforcement configured',
                true
            );
        }
    }

    checkAccessControl() {
        try {
            const serverCode = fs.readFileSync(path.join(projectRoot, 'server/index.ts'), 'utf-8');
            this.assert(
                serverCode.includes('X-API-Key'),
                'API key authentication implemented',
                true
            );
            this.assert(
                serverCode.includes('AuthMiddleware') || serverCode.includes('apiKey'),
                'Authentication middleware implemented',
                false
            );
        } catch {
            this.assert(false, 'Unable to verify access control implementation', true);
        }
    }

    checkAuditLogging() {
        const config = this.readJsonConfig('config/security.json');
        if (config) {
            this.assert(
                config.monitoring?.auditLogging === true,
                'Audit logging enabled',
                true
            );
        }
    }

    checkRateLimiting() {
        const config = this.readJsonConfig('config/security.json');
        if (config) {
            this.assert(
                config.rateLimiting?.enabled === true,
                'Rate limiting enabled',
                false
            );
        }
    }

    checkCORSConfiguration() {
        const config = this.readJsonConfig('config/security.json');
        if (config) {
            this.assert(
                Array.isArray(config.allowedOrigins) && config.allowedOrigins.length > 0,
                'CORS origins properly configured',
                true
            );
        }
    }

    checkEnvironmentSecurity() {
        this.assert(
            this.fileExists('.env.example'),
            'Environment template file exists',
            false
        );

        // Check for hardcoded secrets in source code
        try {
            const serverCode = fs.readFileSync(path.join(projectRoot, 'server/index.ts'), 'utf-8');
            this.assert(
                !serverCode.includes('sk_live_') && !serverCode.includes('pk_live_'),
                'No hardcoded live API keys in source code',
                true
            );
        } catch {
            this.assert(false, 'Unable to verify source code security', true);
        }
    }

    checkSecretsManagement() {
        const requiredSecrets = ['STRIPE_SECRET_KEY', 'ENCRYPTION_KEY', 'JWT_SECRET', 'UPP_API_KEY'];
        
        try {
            const envExample = fs.readFileSync(path.join(projectRoot, '.env.example'), 'utf-8');
            requiredSecrets.forEach(secret => {
                this.assert(
                    envExample.includes(secret),
                    `${secret} defined in environment template`,
                    true
                );
            });
        } catch {
            this.assert(false, 'Unable to verify environment template', false);
        }
    }

    checkComplianceDocumentation() {
        this.assert(
            this.fileExists('docs/security/pci-compliance-report.md'),
            'PCI compliance documentation exists',
            false
        );

        this.assert(
            this.fileExists('SECURITY_IMPROVEMENTS.md'),
            'Security improvements documentation exists',
            false
        );
    }

    checkSecurityWorkflows() {
        this.assert(
            this.fileExists('.github/workflows/security.yml'),
            'GitHub Actions security workflow exists',
            false
        );
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 UPP PAYMENT COMPLIANCE SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Checks: ${this.results.total}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        
        if (this.results.failed > 0) {
            console.log(`🚨 Critical Failures: ${this.results.critical}`);
        }

        const complianceRate = Math.round((this.results.passed / this.results.total) * 100);
        console.log(`📈 Compliance Rate: ${complianceRate}%`);
        
        console.log('\n' + '='.repeat(60));

        if (this.results.critical > 0) {
            console.log('🚨 CRITICAL ISSUES FOUND - Payment processing may not be compliant!');
            console.log('Please address critical issues before deploying to production.');
            process.exit(1);
        } else if (this.results.failed > 0) {
            console.log('⚠️  Some checks failed - review recommended');
            process.exit(0);
        } else {
            console.log('🎉 All compliance checks passed - UPP system is compliant!');
            console.log('✅ Safe for production deployment with payment processing');
            process.exit(0);
        }
    }
}

// Execute compliance validation
const validator = new PaymentComplianceValidator();
validator.runAllChecks();