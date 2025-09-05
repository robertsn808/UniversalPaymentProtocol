// @ts-nocheck
import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import { URL } from 'url';
import secureLogger from '../shared/logger.js';
import { env } from '../config/environment.js';

// Enhanced Visa Direct Types
export interface VisaDirectTransaction {
  transactionIdentifier: string;
  actionCode: string;
  approvalCode?: string;
  responseCode: string;
  transmissionDateTime: string;
  retrievalReferenceNumber: string;
  systemsTraceAuditNumber: string | number;
  networkId?: string;
  settlementFlag?: string;
  feesProgramIndicator?: string;
  acquiringBin?: string | number;
  amount?: string;
  localTransactionDateTime?: string;
  businessApplicationId?: string;
  [key: string]: any; // Allow additional properties from Visa API
}

export interface PAIIResponse {
  primaryAccountNumber: string;
  cardAcceptor?: {
    name: string;
    terminalId: string;
    idCode: string;
    address: {
      state: string;
      county: string;
      country: string;
      zipCode: string;
    };
  };
  fastFundsIndicator?: string;
  pushFundsBlockIndicator?: string;
  onlineGamblingBlockIndicator?: string;
  octEligibility?: string;
  aftEligibility?: string;
  accountFundSource?: string;
  cardType?: string;
  cardSubType?: string;
  issuerName?: string;
  issuerCountryCode?: string;
  fastFundsMoneyTransferMaxAmount?: string;
  crossBorderEligibility?: string;
  domesticEligibility?: string;
}

export interface VisaDirectError {
  errorCode: string;
  errorMessage: string;
  details?: any;
}

// Accept UTF-8, base64 ("b64:..."), or hex ("hex:...") secrets
function parseSecret(secretEnv: string): Buffer {
  if (!secretEnv) throw new Error("VISA_SHARED_SECRET missing");
  if (secretEnv.startsWith("b64:")) return Buffer.from(secretEnv.slice(4), "base64");
  if (secretEnv.startsWith("hex:")) return Buffer.from(secretEnv.slice(4), "hex");
  return Buffer.from(secretEnv, "utf8"); // default
}

/**
 * x-pay-token = "xv2:" + apiKey + ":" + HMAC_SHA256(sharedSecret, resourcePath + queryString + body)
 */
function buildXPayToken(opts: {
  apiKey: string;
  sharedSecretEnv: string;  // from process.env.VISA_SHARED_SECRET
  resourcePath: string;     // e.g. /vdp/helloworld
  queryString?: string;     // e.g. apikey=XXXX (no leading '?')
  body?: string;            // raw JSON string or "" for GET
}) {
  const key = parseSecret(opts.sharedSecretEnv);
  const prehash = (opts.resourcePath ?? "") + (opts.queryString ?? "") + (opts.body ?? "");
  const hmac = crypto.createHmac("sha256", key).update(prehash).digest("hex");
  return `xv2:${opts.apiKey}:${hmac}`;
}

// Legacy wrapper function for backward compatibility
function xPayToken(resourcePath: string, query: string, body: string, apiKey: string, shared: string) {
  return buildXPayToken({
    apiKey,
    sharedSecretEnv: shared,
    resourcePath,
    queryString: query,
    body
  });
}

function buildAgent() {
  const opts: https.AgentOptions = { keepAlive: true };
  
  // Use provided Visa key path or fallback to environment
  const keyPath = env.VISA_KEY_PATH || '/home/i0vvny0u/Documents/GNUPG/key_ade7d4c9-15c4-4683-806a-a74c2f13d14b.pem';
  
  if (env.VISA_CERT_PATH && fs.existsSync(env.VISA_CERT_PATH)) {
    opts.cert = fs.readFileSync(env.VISA_CERT_PATH);
  }
  if (keyPath && fs.existsSync(keyPath)) {
    opts.key = fs.readFileSync(keyPath);
    secureLogger.info('Visa mTLS key loaded', { keyPath: keyPath.substring(0, 50) + '...' });
  }
  if (env.VISA_CA_PATH && fs.existsSync(env.VISA_CA_PATH)) {
    opts.ca = fs.readFileSync(env.VISA_CA_PATH);
  }
  
  // Enhanced TLS options for Visa sandbox
  opts.rejectUnauthorized = env.NODE_ENV === 'production';
  opts.secureProtocol = 'TLSv1_2_method';
  
  return new https.Agent(opts);
}

async function httpsJson<T = any>(
  baseUrl: string,
  path: string,
  method: 'GET'|'POST',
  body?: any,
  headers: Record<string,string> = {}
): Promise<T> {
  const url = new URL(path, baseUrl);
  const payload = body ? JSON.stringify(body) : '';
  const agent = buildAgent();

  const reqHeaders: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...headers,
  };

  // Optional basic auth (some Visa endpoints accept user/password + mTLS)
  if (env.VISA_USER_ID && env.VISA_PASSWORD) {
    const auth = Buffer.from(`${env.VISA_USER_ID}:${env.VISA_PASSWORD}`).toString('base64');
    reqHeaders['Authorization'] = `Basic ${auth}`;
  }

  // Optional x-pay-token for API key mode
  if (env.VISA_API_KEY && env.VISA_SHARED_SECRET) {
    reqHeaders['x-pay-token'] = buildXPayToken({
      apiKey: env.VISA_API_KEY,
      sharedSecretEnv: env.VISA_SHARED_SECRET,
      resourcePath: url.pathname,
      queryString: url.searchParams.toString(),
      body: payload
    });
    reqHeaders['x-api-key'] = env.VISA_API_KEY;
  }

  return new Promise<T>((resolve, reject) => {
    const options: https.RequestOptions = {
      method,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + (url.search || ''),
      headers: reqHeaders,
      agent,
      timeout: 20000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            const err = new Error(`Visa API ${res.statusCode}: ${JSON.stringify(json)}`);
            // @ts-ignore
            err.code = res.statusCode;
            reject(err);
          }
        } catch (e: any) {
          reject(new Error(`Visa API invalid JSON: ${e?.message || e}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export class VisaDirectClient {
  private transactionCache = new Map<string, VisaDirectTransaction>();
  
  constructor(private cfg = {
    baseUrl: env.VISA_API_BASE_URL,
  }) {}

  // Enhanced PAAI lookup with detailed response typing
  async paaiLookup(pan: string): Promise<PAIIResponse> {
    const path = '/vdp/paai/cardattributes/inquiry';
    const body = { primaryAccountNumber: pan };
    
    try {
      const response = await httpsJson<PAIIResponse>(this.cfg.baseUrl, path, 'POST', body);
      secureLogger.info('PAAI lookup successful', { 
        pan: pan.substring(0, 6) + '****' + pan.slice(-4),
        octEligibility: response.octEligibility,
        aftEligibility: response.aftEligibility 
      });
      return response;
    } catch (error) {
      secureLogger.error('PAAI lookup failed', { 
        pan: pan.substring(0, 6) + '****' + pan.slice(-4),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw this.enhanceError(error, 'PAAI_LOOKUP_FAILED');
    }
  }

  // Enhanced Pull funds (AFT) with better validation
  async pullFundsAFT(input: {
    amount: string; currency: string;
    senderCardNumber: string; senderExpiryYYMM: string; senderCvv2?: string;
    acquiringBin: string; stan: string; rrn: string; bai: string;
    merchantCategoryCode?: string; sourceOfFundsCode?: string;
  }): Promise<VisaDirectTransaction> {
    this.validateAFTInput(input);
    
    const path = '/vdp/visadirect/fundstransfer/v1/pullfundstransactions';
    const body: Record<string, any> = {
      systemsTraceAuditNumber: input.stan,
      retrievalReferenceNumber: input.rrn,
      businessApplicationId: input.bai,
      amount: input.amount,
      localTransactionDateTime: new Date().toISOString().slice(0,19).replace('T',' '),
      acquiringBin: input.acquiringBin,
      senderCardNumber: input.senderCardNumber,
      senderCardExpiryDate: input.senderExpiryYYMM,
      cvv2: input.senderCvv2,
      sourceOfFundsCode: input.sourceOfFundsCode || '01',
      merchantCategoryCode: input.merchantCategoryCode || '4829',
      transactionCurrencyCode: input.currency,
    };
    
    try {
      const response = await httpsJson<any>(this.cfg.baseUrl, path, 'POST', body);
      
      // Cache transaction for later reference
      if (response.transactionIdentifier) {
        this.transactionCache.set(response.transactionIdentifier, response);
      }
      
      secureLogger.info('AFT transaction successful', {
        transactionId: response.transactionIdentifier,
        amount: input.amount,
        currency: input.currency,
        stan: input.stan,
        rrn: input.rrn
      });
      
      return response as VisaDirectTransaction;
    } catch (error) {
      secureLogger.error('AFT transaction failed', {
        amount: input.amount,
        currency: input.currency,
        stan: input.stan,
        rrn: input.rrn,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw this.enhanceError(error, 'AFT_TRANSACTION_FAILED');
    }
  }

  // Enhanced Push funds (OCT) with better validation
  async pushFundsOCT(input: {
    amount: string; currency: string;
    recipientCardNumber: string; acquiringBin: string; stan: string; rrn: string; bai: string;
    linkAftTransactionIdentifier?: string; senderName?: string;
    merchantCategoryCode?: string; purposeOfPayment?: string;
  }): Promise<VisaDirectTransaction> {
    this.validateOCTInput(input);
    
    const path = '/vdp/visadirect/mvisa/v1/merchantpushpayments';
    const body: any = {
      systemsTraceAuditNumber: input.stan,
      retrievalReferenceNumber: input.rrn,
      businessApplicationId: input.bai,
      amount: input.amount,
      localTransactionDateTime: new Date().toISOString().slice(0,19).replace('T',' '),
      acquiringBin: input.acquiringBin,
      recipientPrimaryAccountNumber: input.recipientCardNumber,
      transactionCurrencyCode: input.currency,
      senderName: input.senderName || env.VISA_SENDER_NAME || 'UPP',
      settlementServiceIndicator: input.linkAftTransactionIdentifier ? '9' : '1',
      merchantCategoryCode: input.merchantCategoryCode || '4829',
      purposeOfPayment: input.purposeOfPayment || 'MP', // Money transfer - Personal
    };
    
    // Add linking information if provided
    if (input.linkAftTransactionIdentifier) {
      body.originalDataElements = {
        acquiringBin: input.acquiringBin,
        systemsTraceAuditNumber: input.stan,
        transmissionDateTime: new Date().toISOString().slice(0,19).replace('T',' '),
        retrievalReferenceNumber: input.rrn
      };
    }
    
    try {
      const response = await httpsJson<any>(this.cfg.baseUrl, path, 'POST', body);
      
      // Cache transaction for later reference
      if (response.transactionIdentifier) {
        this.transactionCache.set(response.transactionIdentifier, response);
      }
      
      secureLogger.info('OCT transaction successful', {
        transactionId: response.transactionIdentifier,
        amount: input.amount,
        currency: input.currency,
        stan: input.stan,
        rrn: input.rrn,
        linkedAft: input.linkAftTransactionIdentifier
      });
      
      return response as VisaDirectTransaction;
    } catch (error) {
      secureLogger.error('OCT transaction failed', {
        amount: input.amount,
        currency: input.currency,
        stan: input.stan,
        rrn: input.rrn,
        linkedAft: input.linkAftTransactionIdentifier,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw this.enhanceError(error, 'OCT_TRANSACTION_FAILED');
    }
  }

  // Enhanced return funds with better error handling
  async returnFunds(transactionIdentifier: string, acquiringBin: string, reason?: string): Promise<VisaDirectTransaction> {
    if (!transactionIdentifier || !acquiringBin) {
      throw new Error('Transaction identifier and acquiring BIN are required for return funds');
    }
    
    const path = '/vdp/visadirect/fundstransfer/v1/returnfundstransactions';
    const body: Record<string, any> = { 
      acquiringBin, 
      transactionIdentifier,
      reasonCode: reason || '01' // Default: Customer dispute
    };
    
    try {
      const response = await httpsJson<any>(this.cfg.baseUrl, path, 'POST', body);
      
      secureLogger.info('Return funds successful', {
        originalTransactionId: transactionIdentifier,
        returnTransactionId: response.transactionIdentifier,
        reason: reason || '01'
      });
      
      return response as VisaDirectTransaction;
    } catch (error) {
      secureLogger.error('Return funds failed', {
        originalTransactionId: transactionIdentifier,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw this.enhanceError(error, 'RETURN_FUNDS_FAILED');
    }
  }

  // New: Transaction status inquiry
  async getTransactionStatus(transactionIdentifier: string): Promise<VisaDirectTransaction | null> {
    // Check cache first
    const cached = this.transactionCache.get(transactionIdentifier);
    if (cached) {
      return cached;
    }
    
    // In a real implementation, you would call Visa's transaction inquiry API
    // For now, return null as this endpoint may not be available in sandbox
    secureLogger.warn('Transaction status inquiry not implemented', { transactionIdentifier });
    return null;
  }

  // New: Batch transaction processing
  async processBatchTransactions(transactions: Array<{
    type: 'AFT' | 'OCT';
    data: any;
  }>): Promise<Array<{ success: boolean; result?: VisaDirectTransaction; error?: string }>> {
    const results = [];
    
    for (const transaction of transactions) {
      try {
        let result: VisaDirectTransaction;
        
        if (transaction.type === 'AFT') {
          result = await this.pullFundsAFT(transaction.data);
        } else {
          result = await this.pushFundsOCT(transaction.data);
        }
        
        results.push({ success: true, result });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    return results;
  }

  // New: Health check for Visa Direct connectivity
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Use a minimal PAAI call as health check
      await this.paaiLookup('4111111111111111'); // Test card number
      const latency = Date.now() - startTime;
      
      return { healthy: true, latency };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Private validation methods
  private validateAFTInput(input: any): void {
    if (!input.amount || parseFloat(input.amount) <= 0) {
      throw new Error('Invalid amount for AFT transaction');
    }
    if (!input.senderCardNumber || String(input.senderCardNumber).length < 13) {
      throw new Error('Invalid sender card number');
    }
    if (!input.senderExpiryYYMM || !/^\d{4}$/.test(String(input.senderExpiryYYMM))) {
      throw new Error('Invalid expiry date format (YYMM required)');
    }
    if (!input.acquiringBin || String(input.acquiringBin).length !== 6) {
      throw new Error('Invalid acquiring BIN (6 digits required)');
    }
  }

  private validateOCTInput(input: any): void {
    if (!input.amount || parseFloat(input.amount) <= 0) {
      throw new Error('Invalid amount for OCT transaction');
    }
    if (!input.recipientCardNumber || String(input.recipientCardNumber).length < 13) {
      throw new Error('Invalid recipient card number');
    }
    if (!input.acquiringBin || String(input.acquiringBin).length !== 6) {
      throw new Error('Invalid acquiring BIN (6 digits required)');
    }
  }

  private enhanceError(error: any, context: string): VisaDirectError {
    const enhanced: VisaDirectError = {
      errorCode: context,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      details: error
    };
    
    // Parse Visa-specific error codes if available
    if (error && typeof error === 'object' && error.message) {
      const visaErrorMatch = error.message.match(/Visa API (\d+): (.+)/);
      if (visaErrorMatch) {
        enhanced.errorCode = `VISA_${visaErrorMatch[1]}`;
        enhanced.errorMessage = visaErrorMatch[2];
      }
    }
    
    return enhanced;
  }

  // Utility methods
  getCachedTransaction(transactionIdentifier: string): VisaDirectTransaction | undefined {
    return this.transactionCache.get(transactionIdentifier);
  }

  clearTransactionCache(): void {
    this.transactionCache.clear();
  }

  getTransactionCacheSize(): number {
    return this.transactionCache.size;
  }
}

export const visaDirectClient = new VisaDirectClient();

