import https from 'https';
import http from 'http';
import { Express } from 'express';
import { sslManager } from '../config/ssl';
import secureLogger from '../utils/logger';
import { env } from '../config/environment';

export class HTTPSServer {
  private app: Express;
  private httpServer?: http.Server;
  private httpsServer?: https.Server;

  constructor(app: Express) {
    this.app = app;
  }

  private createHTTPRedirectServer(): http.Server {
    // Create HTTP server that redirects to HTTPS
    const httpApp = require('express')();
    
    httpApp.get('*', (req: any, res: any) => {
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      secureLogger.info('Redirecting HTTP to HTTPS', { 
        from: `http://${req.headers.host}${req.url}`,
        to: httpsUrl
      });
      res.redirect(301, httpsUrl);
    });

    return http.createServer(httpApp);
  }

  public async start(): Promise<void> {
    const sslConfig = sslManager.getSSLConfig();
    const port = env.PORT || 443;
    const httpPort = 80;

    if (sslConfig.enabled && sslConfig.options) {
      // Start HTTPS server
      this.httpsServer = https.createServer(sslConfig.options, this.app);
      
      await new Promise<void>((resolve, reject) => {
        this.httpsServer!.listen(port, () => {
          secureLogger.info('🔒 HTTPS Server started', { 
            port,
            ssl: true,
            environment: env.NODE_ENV
          });
          resolve();
        });

        this.httpsServer!.on('error', (error) => {
          secureLogger.error('HTTPS server error', { error });
          reject(error);
        });
      });

      // Start HTTP redirect server if in production
      if (env.NODE_ENV === 'production' && process.env.ENABLE_HTTP_REDIRECT === 'true') {
        this.httpServer = this.createHTTPRedirectServer();
        
        this.httpServer.listen(httpPort, () => {
          secureLogger.info('🔄 HTTP Redirect Server started', { 
            port: httpPort,
            redirectsTo: `https://localhost:${port}`
          });
        });
      }

      // Setup certificate expiry monitoring
      this.setupCertificateMonitoring();

    } else {
      // Fallback to HTTP server
      secureLogger.warn('⚠️ SSL not configured, starting HTTP server');
      
      this.httpServer = http.createServer(this.app);
      
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(port, () => {
          secureLogger.info('🌐 HTTP Server started', { 
            port,
            ssl: false,
            environment: env.NODE_ENV,
            warning: 'Running without SSL - not recommended for production'
          });
          resolve();
        });

        this.httpServer!.on('error', (error) => {
          secureLogger.error('HTTP server error', { error });
          reject(error);
        });
      });
    }

    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  private setupCertificateMonitoring(): void {
    // Check certificate expiry daily
    const checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    setInterval(() => {
      const { isExpiringSoon, daysUntilExpiry } = sslManager.checkCertificateExpiry();
      
      if (isExpiringSoon) {
        secureLogger.warn('🚨 SSL Certificate Alert', {
          message: 'Certificate expiring soon',
          daysUntilExpiry,
          action: 'Please renew SSL certificate'
        });
        
        // You could send email alerts here
        // this.sendCertificateExpiryAlert(daysUntilExpiry);
      }
    }, checkInterval);

    // Initial check
    setTimeout(() => {
      sslManager.checkCertificateExpiry();
    }, 5000);
  }

  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      secureLogger.info(`Received ${signal}, shutting down gracefully`);
      
      const shutdownTimeout = 30000; // 30 seconds
      const timer = setTimeout(() => {
        secureLogger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, shutdownTimeout);

      const closeServer = (server: http.Server | https.Server | undefined, name: string) => {
        return new Promise<void>((resolve) => {
          if (!server) {
            resolve();
            return;
          }

          server.close((err) => {
            if (err) {
              secureLogger.error(`Error closing ${name} server`, { error: err });
            } else {
              secureLogger.info(`${name} server closed successfully`);
            }
            resolve();
          });
        });
      };

      Promise.all([
        closeServer(this.httpsServer, 'HTTPS'),
        closeServer(this.httpServer, 'HTTP')
      ]).then(() => {
        clearTimeout(timer);
        secureLogger.info('All servers closed, exiting process');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      let closedCount = 0;
      const totalServers = (this.httpsServer ? 1 : 0) + (this.httpServer ? 1 : 0);

      if (totalServers === 0) {
        resolve();
        return;
      }

      const onClose = () => {
        closedCount++;
        if (closedCount === totalServers) {
          resolve();
        }
      };

      if (this.httpsServer) {
        this.httpsServer.close(onClose);
      }

      if (this.httpServer) {
        this.httpServer.close(onClose);
      }
    });
  }

  // Health check specifically for SSL
  public getSSLHealthStatus(): {
    enabled: boolean;
    certificateValid: boolean;
    expiryInfo?: { daysUntilExpiry: number; isExpiringSoon: boolean };
  } {
    const sslConfig = sslManager.getSSLConfig();
    
    if (!sslConfig.enabled) {
      return { enabled: false, certificateValid: false };
    }

    const expiryInfo = sslManager.checkCertificateExpiry();
    
    return {
      enabled: true,
      certificateValid: true,
      expiryInfo
    };
  }
}

// Export factory function
export const createHTTPSServer = (app: Express): HTTPSServer => {
  return new HTTPSServer(app);
};