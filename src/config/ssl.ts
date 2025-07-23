import https from 'https';
import fs from 'fs';
import path from 'path';
import secureLogger from '../shared/logger.js';
import { env } from './environment';

export interface SSLConfig {
  enabled: boolean;
  cert?: Buffer;
  key?: Buffer;
  ca?: Buffer;
  options?: https.ServerOptions;
}

class SSLManager {
  private sslConfig: SSLConfig = { enabled: false };

  constructor() {
    this.initializeSSL();
  }

  private initializeSSL(): void {
    try {
      const certPath = process.env.SSL_CERT_PATH;
      const keyPath = process.env.SSL_KEY_PATH;
      const caPath = process.env.SSL_CA_PATH;

      if (!certPath || !keyPath) {
        secureLogger.info('SSL certificates not configured, running in HTTP mode');
        return;
      }

      // Verify certificate files exist
      if (!fs.existsSync(certPath)) {
        secureLogger.error('SSL certificate file not found', { path: certPath });
        return;
      }

      if (!fs.existsSync(keyPath)) {
        secureLogger.error('SSL private key file not found', { path: keyPath });
        return;
      }

      // Read certificate files
      const cert = fs.readFileSync(certPath);
      const key = fs.readFileSync(keyPath);
      let ca: Buffer | undefined;

      if (caPath && fs.existsSync(caPath)) {
        ca = fs.readFileSync(caPath);
      }

      // Validate certificate
      this.validateCertificate(cert, key);

      this.sslConfig = {
        enabled: true,
        cert,
        key,
        ca,
        options: {
          cert,
          key,
          ca,
          // Security options
          secureProtocol: 'TLS_method',
          ciphers: [
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES128-SHA256',
            'ECDHE-RSA-AES256-SHA384'
          ].join(':'),
          honorCipherOrder: true,
          secureOptions: require('constants').SSL_OP_NO_SSLv3 | 
                        require('constants').SSL_OP_NO_TLSv1 |
                        require('constants').SSL_OP_NO_TLSv1_1
        }
      };

      secureLogger.info('SSL certificates loaded successfully', {
        certPath: this.maskPath(certPath),
        keyPath: this.maskPath(keyPath),
        caPath: caPath ? this.maskPath(caPath) : undefined
      });

    } catch (error) {
      secureLogger.error('Failed to initialize SSL', { error });
      this.sslConfig = { enabled: false };
    }
  }

  private validateCertificate(cert: Buffer, key: Buffer): void {
    try {
      // Create temporary HTTPS server to validate cert/key pair
      const server = https.createServer({ cert, key });
      server.close();
      secureLogger.info('SSL certificate validation passed');
    } catch (error) {
      throw new Error(`Invalid SSL certificate or key: ${error}`);
    }
  }

  private maskPath(filePath: string): string {
    const parts = filePath.split('/');
    if (parts.length > 2) {
      return `.../${parts.slice(-2).join('/')}`;
    }
    return filePath;
  }

  public getSSLConfig(): SSLConfig {
    return this.sslConfig;
  }

  public isSSLEnabled(): boolean {
    return this.sslConfig.enabled;
  }

  // Generate self-signed certificate for development
  public generateSelfSignedCert(domain: string = 'localhost'): SSLConfig {
    try {
      const selfsigned = require('selfsigned');
      const attrs = [{ name: 'commonName', value: domain }];
      const pems = selfsigned.generate(attrs, { 
        days: 365,
        keySize: 2048,
        algorithm: 'sha256'
      });

      this.sslConfig = {
        enabled: true,
        cert: Buffer.from(pems.cert),
        key: Buffer.from(pems.private),
        options: {
          cert: Buffer.from(pems.cert),
          key: Buffer.from(pems.private)
        }
      };

      secureLogger.warn('Generated self-signed SSL certificate for development', { domain });
      return this.sslConfig;

    } catch (error) {
      secureLogger.error('Failed to generate self-signed certificate', { error });
      return { enabled: false };
    }
  }

  // Certificate renewal check
  public checkCertificateExpiry(): { isExpiringSoon: boolean; daysUntilExpiry: number } {
    if (!this.sslConfig.cert) {
      return { isExpiringSoon: false, daysUntilExpiry: 0 };
    }

    try {
      const crypto = require('crypto');
      const cert = crypto.X509Certificate(this.sslConfig.cert);
      const expiryDate = new Date(cert.validTo);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const isExpiringSoon = daysUntilExpiry <= 30; // Alert if expiring within 30 days

      if (isExpiringSoon) {
        secureLogger.warn('SSL certificate expiring soon', {
          expiryDate: expiryDate.toISOString(),
          daysUntilExpiry
        });
      }

      return { isExpiringSoon, daysUntilExpiry };
    } catch (error) {
      secureLogger.error('Failed to check certificate expiry', { error });
      return { isExpiringSoon: false, daysUntilExpiry: 0 };
    }
  }

  // Let's Encrypt integration helper
  public setupLetsEncrypt(domain: string, email: string): void {
    secureLogger.info('Setting up Let\'s Encrypt certificate', { domain, email });
    
    // This would integrate with ACME client like 'acme-client'
    // For now, just log the process
    secureLogger.info(`
      To set up Let's Encrypt certificates:
      1. Install certbot: sudo apt-get install certbot
      2. Generate certificate: sudo certbot certonly --standalone -d ${domain} --email ${email}
      3. Set SSL_CERT_PATH=/etc/letsencrypt/live/${domain}/fullchain.pem
      4. Set SSL_KEY_PATH=/etc/letsencrypt/live/${domain}/privkey.pem
      5. Set up auto-renewal: sudo crontab -e and add:
         0 12 * * * /usr/bin/certbot renew --quiet
    `);
  }
}

export const sslManager = new SSLManager();