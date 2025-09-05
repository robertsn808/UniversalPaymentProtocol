// @ts-nocheck
import { Router } from 'express';
import { visaDirectClient } from '../integrations/visaDirect.js';
import { env } from '../config/environment.js';
import secureLogger from '../shared/logger.js';
import { genStan, genRrn } from '../lib/visa/ids.js';

const r = Router();

// Enhanced health check with more details
r.get('/health', async (req, res) => {
  try {
    const healthCheck = await visaDirectClient.healthCheck();
    
    res.json({
      visaDirectEnabled: !!env.VISA_DIRECT_ENABLED,
      baseUrl: env.VISA_API_BASE_URL,
      acquirerBin: env.VISA_ACQUIRER_BIN || null,
      bai: env.VISA_BAI,
      senderName: env.VISA_SENDER_NAME,
      connectivity: healthCheck,
      cacheSize: visaDirectClient.getTransactionCacheSize(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      visaDirectEnabled: !!env.VISA_DIRECT_ENABLED,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PAAI (Payment Account Attributes Inquiry) endpoint
r.post('/paai', async (req, res) => {
  if (!env.VISA_DIRECT_ENABLED) {
    return res.status(503).json({ error: 'Visa Direct disabled. Enable VISA_DIRECT_ENABLED in env.' });
  }

  const { cardNumber } = req.body || {};
  if (!cardNumber) {
    return res.status(400).json({ error: 'Missing required field: cardNumber' });
  }

  try {
    const paai = await visaDirectClient.paaiLookup(String(cardNumber));
    
    secureLogger.info('PAAI lookup completed', {
      pan: String(cardNumber).substring(0, 6) + '****' + String(cardNumber).slice(-4),
      octEligible: paai.octEligibility === 'Y',
      aftEligible: paai.aftEligibility === 'Y'
    });

    return res.json({
      success: true,
      data: paai,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    secureLogger.error('PAAI lookup failed', { 
      error: error?.message || error,
      pan: String(cardNumber).substring(0, 6) + '****' + String(cardNumber).slice(-4)
    });
    return res.status(500).json({ 
      success: false,
      error: error?.message || 'PAAI lookup failed' 
    });
  }
});

// Enhanced P2P send with better error handling and logging
r.post('/send', async (req, res) => {
  if (!env.VISA_DIRECT_ENABLED) {
    return res.status(503).json({ error: 'Visa Direct disabled. Enable VISA_DIRECT_ENABLED in env.' });
  }
  
  const { amount, currency = 'USD', sender, recipient, description } = req.body || {};
  
  // Enhanced validation
  if (!amount || !sender?.cardNumber || !sender?.expYYMM || !recipient?.cardNumber) {
    return res.status(400).json({ 
      error: 'Missing required fields: amount, sender.cardNumber, sender.expYYMM, recipient.cardNumber' 
    });
  }
  
  if (!env.VISA_ACQUIRER_BIN) {
    return res.status(400).json({ error: 'VISA_ACQUIRER_BIN not set' });
  }

  // Amount validation
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0 || amt > 10000) {
    return res.status(400).json({ error: 'Invalid amount. Must be between 0.01 and 10000.00' });
  }

  const acquiringBin = env.VISA_ACQUIRER_BIN;
  const bai = env.VISA_BAI || 'PP';
  const amtStr = amt.toFixed(2);
  const transactionId = `p2p_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  try {
    secureLogger.info('P2P transaction started', {
      transactionId,
      amount: amtStr,
      currency,
      senderPan: String(sender.cardNumber).substring(0, 6) + '****' + String(sender.cardNumber).slice(-4),
      recipientPan: String(recipient.cardNumber).substring(0, 6) + '****' + String(recipient.cardNumber).slice(-4)
    });

    // 1) PAAI eligibility check
    const paai = await visaDirectClient.paaiLookup(String(recipient.cardNumber));
    if (paai?.octEligibility && String(paai.octEligibility).toUpperCase() === 'N') {
      return res.status(400).json({ 
        error: 'Recipient card not eligible for receiving funds (OCT)',
        paaiData: paai
      });
    }

    // 2) Pull funds (AFT)
    const stan1 = genStan();
    const rrn1 = genRrn();
    const aft = await visaDirectClient.pullFundsAFT({
      amount: amtStr,
      currency,
      senderCardNumber: String(sender.cardNumber),
      senderExpiryYYMM: String(sender.expYYMM),
      senderCvv2: sender.cvv2 ? String(sender.cvv2) : undefined,
      acquiringBin,
      stan: stan1,
      rrn: rrn1,
      bai,
      merchantCategoryCode: '4829', // Money transfer
      sourceOfFundsCode: '01' // Credit to account
    });

    secureLogger.info('AFT transaction successful', {
      transactionId,
      aftTransactionId: aft.transactionIdentifier,
      amount: amtStr
    });

    // 3) Push funds (OCT)
    const stan2 = genStan();
    const rrn2 = genRrn();
    let oct: any;
    
    try {
      oct = await visaDirectClient.pushFundsOCT({
        amount: amtStr,
        currency,
        recipientCardNumber: String(recipient.cardNumber),
        acquiringBin,
        stan: stan2,
        rrn: rrn2,
        bai,
        linkAftTransactionIdentifier: aft?.transactionIdentifier,
        senderName: env.VISA_SENDER_NAME || 'UPP',
        merchantCategoryCode: '4829',
        purposeOfPayment: 'MP' // Money transfer - Personal
      });

      secureLogger.info('OCT transaction successful', {
        transactionId,
        octTransactionId: oct.transactionIdentifier,
        linkedAft: aft.transactionIdentifier,
        amount: amtStr
      });

    } catch (octErr: any) {
      secureLogger.error('OCT transaction failed, initiating return', {
        transactionId,
        aftTransactionId: aft.transactionIdentifier,
        octError: octErr?.message || octErr
      });

      // Compensating transaction: return funds if OCT fails
      try {
        if (aft?.transactionIdentifier) {
          const returnResult = await visaDirectClient.returnFunds(
            aft.transactionIdentifier, 
            acquiringBin,
            '01' // Customer dispute
          );
          
          secureLogger.info('Return funds successful', {
            transactionId,
            originalAft: aft.transactionIdentifier,
            returnTransactionId: returnResult.transactionIdentifier
          });
        }
      } catch (retErr) {
        secureLogger.error('Return funds failed - CRITICAL', {
          transactionId,
          aftTransactionId: aft.transactionIdentifier,
          returnError: (retErr as any)?.message || retErr
        });
      }
      
      throw octErr;
    }

    const response = {
      success: true,
      transactionId,
      status: 'completed',
      amount: amt,
      currency,
      aft: {
        transactionIdentifier: aft.transactionIdentifier,
        responseCode: aft.responseCode,
        approvalCode: aft.approvalCode
      },
      oct: {
        transactionIdentifier: oct.transactionIdentifier,
        responseCode: oct.responseCode,
        approvalCode: oct.approvalCode
      },
      timestamp: new Date().toISOString(),
      description: description || 'P2P Money Transfer'
    };

    secureLogger.info('P2P transaction completed successfully', {
      transactionId,
      aftId: aft.transactionIdentifier,
      octId: oct.transactionIdentifier,
      amount: amtStr
    });

    return res.json(response);

  } catch (error: any) {
    secureLogger.error('P2P transaction failed', {
      transactionId,
      error: error?.message || error,
      amount: amtStr
    });

    return res.status(500).json({
      success: false,
      transactionId,
      error: error?.message || 'P2P transaction failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Pull funds only (AFT)
r.post('/aft', async (req, res) => {
  if (!env.VISA_DIRECT_ENABLED) {
    return res.status(503).json({ error: 'Visa Direct disabled' });
  }

  const { amount, currency = 'USD', cardNumber, expYYMM, cvv2, description } = req.body || {};
  
  if (!amount || !cardNumber || !expYYMM || !env.VISA_ACQUIRER_BIN) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const transactionId = `aft_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  try {
    const aft = await visaDirectClient.pullFundsAFT({
      amount: Number(amount).toFixed(2),
      currency,
      senderCardNumber: String(cardNumber),
      senderExpiryYYMM: String(expYYMM),
      senderCvv2: cvv2 ? String(cvv2) : undefined,
      acquiringBin: env.VISA_ACQUIRER_BIN,
      stan: genStan(),
      rrn: genRrn(),
      bai: env.VISA_BAI || 'PP'
    });

    return res.json({
      success: true,
      transactionId,
      aft,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      transactionId,
      error: error?.message || 'AFT transaction failed'
    });
  }
});

// Push funds only (OCT)
r.post('/oct', async (req, res) => {
  if (!env.VISA_DIRECT_ENABLED) {
    return res.status(503).json({ error: 'Visa Direct disabled' });
  }

  const { amount, currency = 'USD', cardNumber, linkAftTransactionIdentifier } = req.body || {};
  
  if (!amount || !cardNumber || !env.VISA_ACQUIRER_BIN) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const transactionId = `oct_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  try {
    const oct = await visaDirectClient.pushFundsOCT({
      amount: Number(amount).toFixed(2),
      currency,
      recipientCardNumber: String(cardNumber),
      acquiringBin: env.VISA_ACQUIRER_BIN,
      stan: genStan(),
      rrn: genRrn(),
      bai: env.VISA_BAI || 'PP',
      linkAftTransactionIdentifier
    });

    return res.json({
      success: true,
      transactionId,
      oct,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      transactionId,
      error: error?.message || 'OCT transaction failed'
    });
  }
});

// Return funds
r.post('/return', async (req, res) => {
  if (!env.VISA_DIRECT_ENABLED) {
    return res.status(503).json({ error: 'Visa Direct disabled' });
  }

  const { transactionIdentifier, reason } = req.body || {};
  
  if (!transactionIdentifier || !env.VISA_ACQUIRER_BIN) {
    return res.status(400).json({ error: 'Missing required fields: transactionIdentifier' });
  }

  const returnTransactionId = `ret_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  try {
    const returnResult = await visaDirectClient.returnFunds(
      String(transactionIdentifier),
      env.VISA_ACQUIRER_BIN,
      reason || '01'
    );

    return res.json({
      success: true,
      returnTransactionId,
      originalTransactionId: transactionIdentifier,
      returnResult,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      returnTransactionId,
      originalTransactionId: transactionIdentifier,
      error: error?.message || 'Return funds failed'
    });
  }
});

// Batch processing endpoint
r.post('/batch', async (req, res) => {
  if (!env.VISA_DIRECT_ENABLED) {
    return res.status(503).json({ error: 'Visa Direct disabled' });
  }

  const { transactions } = req.body || {};
  
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: 'Invalid transactions array' });
  }

  if (transactions.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 transactions per batch' });
  }

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  try {
    const results = await visaDirectClient.processBatchTransactions(transactions);
    
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

    secureLogger.info('Batch processing completed', {
      batchId,
      summary
    });

    return res.json({
      success: true,
      batchId,
      summary,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      batchId,
      error: error?.message || 'Batch processing failed'
    });
  }
});

// Transaction status lookup
r.get('/transaction/:transactionId', async (req, res) => {
  const { transactionId } = req.params;
  
  try {
    const transaction = visaDirectClient.getCachedTransaction(transactionId);
    
    if (transaction) {
      return res.json({
        success: true,
        transaction,
        cached: true,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found in cache',
        transactionId
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Transaction lookup failed',
      transactionId
    });
  }
});

// Clear transaction cache (admin endpoint)
r.delete('/cache', async (req, res) => {
  try {
    const sizeBefore = visaDirectClient.getTransactionCacheSize();
    visaDirectClient.clearTransactionCache();
    const sizeAfter = visaDirectClient.getTransactionCacheSize();
    
    return res.json({
      success: true,
      message: 'Transaction cache cleared',
      sizeBefore,
      sizeAfter,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Cache clear failed'
    });
  }
});

export default r;

