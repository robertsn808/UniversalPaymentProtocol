// Simple demo server starter
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 9001;

// Rate limiter for /nfc-test route
const nfcTestLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many requests to /nfc-test, please try again later.' }
});

// Basic middleware
app.use(express.json());
app.use(express.static('public'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🌊 Universal Payment Protocol - Demo Server',
    status: 'Running',
    nfc_test: `http://localhost:${PORT}/nfc-test`
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve NFC test page
app.get('/nfc-test', nfcTestLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/nfc-test.html'));
});

// Serve network test page
app.get('/network-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'network-test.html'));
});

// NFC payment endpoint
app.post('/api/nfc-payment', (req, res) => {
  const { amount, nfcData, merchant, merchantId } = req.body;
  
  // Validate required fields
  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payment amount'
    });
  }
  
  if (!merchant?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Merchant name is required'
    });
  }
  
  console.log(`📱 Processing NFC payment: $${amount} at ${merchant}`);
  
  // Simulate processing
  setTimeout(() => {
    const transactionId = `txn_demo_${Date.now()}`;
    
    res.json({
      success: true,
      transactionId,
      amount: parseFloat(amount),
      currency: 'USD',
      timestamp: new Date(),
      merchant,
      merchantId: merchantId || 'demo_merchant',
      nfcType: nfcData?.type || 'simulated',
      metadata: {
        nfc_data: nfcData || {},
        demo_payment: true,
        hawaii_processed: true
      },
      receipt: {
        merchant,
        location: 'Demo Location',
        timestamp: new Date().toISOString()
      }
    });
  }, 1500);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🌊 ====================================');
  console.log('🚀 UPP Demo Server LIVE!');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`📱 Network: http://172.24.6.13:${PORT}`);
  console.log(`💳 NFC Test: http://172.24.6.13:${PORT}/nfc-test`);
  console.log('🌊 ====================================');
});