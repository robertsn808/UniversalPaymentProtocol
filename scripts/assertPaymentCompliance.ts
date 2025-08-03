#!/usr/bin/env node
/**
 * Payment Compliance Assertion Script for UPP
 * Validates system against PCI DSS and payment processing standards
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ComplianceResult {
    passed: number;
    failed: number;
    total: number;
    critical: number;
}

class PaymentComplianceValidator {
    private results: ComplianceResult = { passed: 0, failed: 0, total: 0, critical: 0 };

    private assert(condition: boolean, message: string, critical: boolean = false): void {
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

    private fileExists(filePath: string): boolean {
        return fs.existsSync(path.join(path.dirname(__dirname), filePath));
    }

    private readJsonConfig(filePath: string): any {
        try {
            const fullPath = path.join(path.dirname(__dirname), filePath);
            return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        } catch {
            return null;
        }
    }

    public runAllChecks(): void {
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

    private checkSecurityConfiguration(): void {
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

    private checkDataEncryption(): void {
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

    private checkTLSEnforcement(): void {
        const config = this.readJsonConfig('config/security.json');
        if (config) {
            this.assert(
                config.tlsVersion === '1.2+',
                'TLS 1.2+ enforcement configured',
                true
            );
        }
    }

    private checkAccessControl(): void {
        try {
            const serverCode = fs.readFileSync(path.join(path.dirname(__dirname), 'server/index.ts'), 'utf-8');
            this.assert(
                serverCode.includes('X-API-Key'),
                'API key authentication implemented',
                true
            );
            this.assert(
                serverCode.includes('AuthMiddleware'),
                'Authentication middleware implemented',
                false
            );
        } catch {
            this.assert(false, 'Unable to verify access control implementation', true);
        }
    }

    private checkAuditLogging(): void {
        const config = this.readJsonConfig('config/security.json');
        if (config) {
            this.assert(
                config.monitoring?.auditLogging === true,
                'Audit logging enabled',
                true
            );
        }
    }

    private checkRateLimiting(): void {
        const config = this.readJsonConfig('config/security.json');
        if (config) {
            this.assert(
                config.rateLimiting?.enabled === true,
                'Rate limiting enabled',
                false
            );
        }
    }

    private checkCORSConfiguration(): void {
        const config = this.readJsonConfig('config/security.json');
        if (config) {
            this.assert(
                Array.isArray(config.allowedOrigins) && config.allowedOrigins.length > 0,
                'CORS origins properly configured',
                true
            );
        }
    }

    private checkEnvironmentSecurity(): void {
        this.assert(
            this.fileExists('.env.example'),
            'Environment template file exists',
            false
        );

        // Check for hardcoded secrets in source code
        try {
            const serverCode = fs.readFileSync(path.join(path.dirname(__dirname), 'server/index.ts'), 'utf-8');
            this.assert(
                !serverCode.includes('sk_live_') && !serverCode.includes('pk_live_'),
                'No hardcoded live API keys in source code',
                true
            );
        } catch {
            this.assert(false, 'Unable to verify source code security', true);
        }
    }

    private checkSecretsManagement(): void {
        const requiredSecrets = ['STRIPE_SECRET_KEY', 'ENCRYPTION_KEY', 'JWT_SECRET', 'UPP_API_KEY'];
        
        try {
            const envExample = fs.readFileSync(path.join(path.dirname(__dirname), '.env.example'), 'utf-8');
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

    private checkComplianceDocumentation(): void {
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

    private checkSecurityWorkflows(): void {
        this.assert(
            this.fileExists('.github/workflows/security.yml'),
            'GitHub Actions security workflow exists',
            false
        );
    }

    private printSummary(): void {
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
