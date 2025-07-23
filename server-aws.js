// Universal Payment Protocol - AWS NFC Testing Server
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🌊 Universal Payment Protocol - NFC Testing Server',
    status: 'Live on AWS!',
    environment: 'production',
    features: [
      'NFC Payment Testing',
      'Web NFC API Support',
      'Real-time Payment Simulation',
      'Cross-device Compatibility'
    ],
    endpoints: {
      health: '/health',
      nfc_test: '/nfc-test',
      network_test: '/network-test',
      api_payment: '/api/nfc-payment'
    },
    deployment: {
      platform: 'AWS',
      region: process.env.AWS_REGION || 'us-east-1',
      timestamp: new Date().toISOString()
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'production',
    version: '1.0.0'
  });
});

// NFC test page
app.get('/nfc-test', (req, res) => {
  const nfcTestHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌊 UPP NFC Test - AWS</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 400px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 700;
        }
        
        .aws-badge {
            background: linear-gradient(45deg, #FF9500, #FF6B35);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 20px;
            display: inline-block;
        }
        
        .nfc-area {
            background: rgba(255, 255, 255, 0.15);
            border: 3px dashed rgba(255, 255, 255, 0.5);
            border-radius: 15px;
            padding: 40px 20px;
            margin: 20px 0;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .nfc-area:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.8);
        }
        
        .nfc-area.active {
            background: rgba(76, 175, 80, 0.3);
            border-color: #4CAF50;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .nfc-icon {
            font-size: 60px;
            margin-bottom: 15px;
            display: block;
        }
        
        .button {
            background: linear-gradient(45deg, #FF6B6B, #4ECDC4);
            border: none;
            border-radius: 25px;
            padding: 15px 30px;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin: 10px;
            transition: all 0.3s ease;
            min-width: 120px;
        }
        
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }
        
        .button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        
        .status {
            margin: 20px 0;
            padding: 15px;
            border-radius: 10px;
            font-weight: 500;
        }
        
        .status.success {
            background: rgba(76, 175, 80, 0.2);
            border: 1px solid #4CAF50;
        }
        
        .status.error {
            background: rgba(244, 67, 54, 0.2);
            border: 1px solid #f44336;
        }
        
        .status.info {
            background: rgba(33, 150, 243, 0.2);
            border: 1px solid #2196F3;
        }
        
        .merchant-info {
            background: rgba(0, 0, 0, 0.1);
            border-radius: 10px;
            padding: 15px;
            margin: 15px 0;
        }
        
        .amount-input {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            padding: 12px;
            color: white;
            font-size: 16px;
            text-align: center;
            margin: 10px;
            width: 120px;
        }
        
        .transaction-details {
            background: rgba(0, 0, 0, 0.1);
            border-radius: 10px;
            padding: 15px;
            margin: 15px 0;
            text-align: left;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌊 UPP NFC Test</h1>
        <div class="aws-badge">☁️ Running on AWS</div>
        
        <div class="merchant-info">
            <div style="font-size: 24px; margin-bottom: 5px;">☕</div>
            <strong>Hawaii Coffee Co</strong><br>
            <small>Cloud-Powered Payments</small>
        </div>
        
        <div class="nfc-area" id="nfcArea" onclick="startNFCRead()">
            <span class="nfc-icon">📱</span>
            <h3>Tap to Pay</h3>
            <p>Tap your NFC card or phone here</p>
        </div>
        
        <input type="number" class="amount-input" id="amount" placeholder="$25.99" value="25.99" step="0.01">
        <br>
        <button class="button" onclick="startNFCRead()" id="nfcButton">Start NFC Reader</button>
        <button class="button" onclick="simulateNFC()" id="simulateButton">Simulate NFC Tap</button>
        
        <div id="status"></div>
        <div id="transactionDetails"></div>
    </div>

    <script>
        let nfcReading = false;

        // Check for NFC support
        async function checkNFCSupport() {
            if ('NDEFReader' in window) {
                updateStatus('✅ Web NFC supported! Ready for real NFC payments.', 'success');
                return true;
            } else {
                updateStatus('⚠️ Web NFC not supported. Using simulation mode.', 'info');
                return false;
            }
        }

        // Start NFC reading
        async function startNFCRead() {
            if (nfcReading) {
                stopNFCRead();
                return;
            }

            const nfcSupported = await checkNFCSupport();
            
            if (nfcSupported) {
                try {
                    await startRealNFC();
                } catch (error) {
                    console.error('Real NFC failed:', error);
                    updateStatus('❌ NFC permission denied or not available. Using simulation.', 'error');
                    setTimeout(() => simulateNFC(), 1000);
                }
            } else {
                setTimeout(() => simulateNFC(), 1000);
            }
        }

        // Real NFC implementation
        async function startRealNFC() {
            const ndef = new NDEFReader();
            
            try {
                await ndef.scan();
                nfcReading = true;
                
                document.getElementById('nfcArea').classList.add('active');
                document.getElementById('nfcButton').textContent = 'Stop NFC Reader';
                updateStatus('📡 NFC Reader active... Waiting for tap', 'info');

                ndef.addEventListener('reading', ({ message, serialNumber }) => {
                    console.log('NFC tag detected:', serialNumber);
                    handleNFCData({
                        type: 'real_nfc',
                        serialNumber,
                        message,
                        timestamp: Date.now()
                    });
                });

            } catch (error) {
                console.error('NFC scan failed:', error);
                updateStatus('❌ NFC not available. Check permissions and try again.', 'error');
                nfcReading = false;
            }
        }

        // Stop NFC reading
        function stopNFCRead() {
            nfcReading = false;
            document.getElementById('nfcArea').classList.remove('active');
            document.getElementById('nfcButton').textContent = 'Start NFC Reader';
            updateStatus('📱 NFC Reader stopped', 'info');
        }

        // Simulate NFC tap
        function simulateNFC() {
            if (nfcReading) {
                updateStatus('📱 Simulated NFC tap detected!', 'success');
                handleNFCData({
                    type: 'simulated_nfc',
                    cardNumber: '**** **** **** 1234',
                    cardType: 'Visa',
                    timestamp: Date.now()
                });
            } else {
                startNFCRead();
                setTimeout(() => {
                    updateStatus('📱 Simulated NFC tap detected!', 'success');
                    handleNFCData({
                        type: 'simulated_nfc',
                        cardNumber: '**** **** **** 1234',
                        cardType: 'Visa',
                        timestamp: Date.now()
                    });
                }, 2000);
            }
        }

        // Handle NFC data
        async function handleNFCData(nfcData) {
            const amount = parseFloat(document.getElementById('amount').value) || 25.99;
            
            updateStatus('🔄 Processing payment on AWS...', 'info');
            
            try {
                const response = await fetch('/api/nfc-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount,
                        nfcData,
                        merchant: 'Hawaii Coffee Co',
                        merchantId: 'hcc_aws_001'
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showTransactionSuccess(result);
                    triggerSuccessEffects();
                } else {
                    updateStatus('❌ Payment failed: ' + result.error, 'error');
                }
            } catch (error) {
                console.error('Payment processing error:', error);
                updateStatus('❌ Payment processing failed. Please try again.', 'error');
            }
            
            stopNFCRead();
        }

        // Show transaction success
        function showTransactionSuccess(response) {
            updateStatus('✅ Payment Successful on AWS!', 'success');
            
            const details = \`
                <div class="transaction-details">
                    <h4>🧾 Transaction Details</h4>
                    <div class="detail-row">
                        <span>Amount:</span>
                        <strong>$\${response.amount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>Transaction ID:</span>
                        <small>\${response.transactionId}</small>
                    </div>
                    <div class="detail-row">
                        <span>Merchant:</span>
                        <span>\${response.merchant}</span>
                    </div>
                    <div class="detail-row">
                        <span>Platform:</span>
                        <span>☁️ AWS Cloud</span>
                    </div>
                    <div class="detail-row">
                        <span>Time:</span>
                        <span>\${new Date(response.timestamp).toLocaleTimeString()}</span>
                    </div>
                </div>
            \`;
            
            document.getElementById('transactionDetails').innerHTML = details;
        }

        // Success effects
        function triggerSuccessEffects() {
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
            
            document.body.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
            setTimeout(() => {
                document.body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }, 2000);
        }

        // Update status display
        function updateStatus(message, type) {
            const statusDiv = document.getElementById('status');
            statusDiv.innerHTML = \`<div class="status \${type}">\${message}</div>\`;
        }

        // Initialize
        window.addEventListener('load', async () => {
            updateStatus('☁️ Connected to AWS! Ready for NFC payments.', 'success');
            await checkNFCSupport();
        });
    </script>
</body>
</html>`;
  
  res.send(nfcTestHTML);
});

// Network test page
app.get('/network-test', (req, res) => {
  const networkTestHTML = `<!DOCTYPE html>
<html>
<head>
    <title>🌐 UPP Network Test - AWS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: linear-gradient(135deg, #4A90E2, #50C878); color: white; }
        .container { max-width: 400px; margin: 0 auto; background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; }
        .status { padding: 15px; margin: 10px 0; border-radius: 8px; text-align: center; }
        .success { background: rgba(76, 175, 80, 0.3); border: 1px solid #4CAF50; }
        .error { background: rgba(244, 67, 54, 0.3); border: 1px solid #f44336; }
        .info { background: rgba(33, 150, 243, 0.3); border: 1px solid #2196F3; }
        button { padding: 12px 24px; margin: 10px; background: linear-gradient(45deg, #FF6B6B, #4ECDC4); color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: 600; }
        button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .aws-badge { background: linear-gradient(45deg, #FF9500, #FF6B35); padding: 8px 16px; border-radius: 20px; font-size: 14px; margin-bottom: 20px; display: inline-block; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌐 Network Test</h1>
        <div class="aws-badge">☁️ AWS Deployment</div>
        <p>Testing Universal Payment Protocol connectivity from the cloud!</p>
        
        <div class="status success">
            <strong>✅ You're connected to AWS!</strong><br>
            If you can see this page, the deployment worked!
        </div>
        
        <button onclick="testAPI()">Test API Connection</button>
        <button onclick="testNFC()">Go to NFC Test</button>
        
        <div id="results"></div>
    </div>

    <script>
        function addResult(message, type) {
            const results = document.getElementById('results');
            const div = document.createElement('div');
            div.className = \`status \${type}\`;
            div.innerHTML = message;
            results.appendChild(div);
        }

        async function testAPI() {
            addResult('🔄 Testing AWS API...', 'info');
            
            try {
                const response = await fetch('/health');
                const data = await response.json();
                
                if (response.ok) {
                    addResult(\`✅ AWS API Connected! Uptime: \${Math.floor(data.uptime)}s\`, 'success');
                } else {
                    addResult(\`❌ API Error: \${response.status}\`, 'error');
                }
            } catch (error) {
                addResult(\`❌ Connection Failed: \${error.message}\`, 'error');
            }
        }

        function testNFC() {
            addResult('🚀 Redirecting to NFC testing...', 'info');
            window.location.href = '/nfc-test';
        }

        window.addEventListener('load', () => {
            addResult(\`🌐 Connected from: \${window.location.href}\`, 'success');
            addResult('☁️ Running on AWS cloud infrastructure', 'info');
        });
    </script>
</body>
</html>`;
  
  res.send(networkTestHTML);
});

// NFC payment processing endpoint
app.post('/api/nfc-payment', (req, res) => {
  const { amount, nfcData, merchant, merchantId } = req.body;
  
  console.log(\`💳 Processing AWS NFC payment: $\${amount} at \${merchant}\`);
  console.log(\`📍 NFC Data Type: \${nfcData?.type || 'unknown'}\`);
  
  // Simulate payment processing with realistic delay
  setTimeout(() => {
    const transactionId = \`txn_aws_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    
    const response = {
      success: true,
      transactionId,
      amount: parseFloat(amount),
      currency: 'USD',
      merchant,
      timestamp: new Date().toISOString(),
      nfcType: nfcData?.type || 'simulated',
      platform: 'AWS',
      region: process.env.AWS_REGION || 'us-east-1',
      receipt: {
        merchant,
        location: 'AWS Cloud',
        timestamp: new Date().toISOString(),
        paymentMethod: 'NFC'
      }
    };
    
    console.log(\`✅ Payment completed: \${transactionId}\`);
    res.json(response);
  }, 1500);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'Something went wrong processing your request'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: \`Endpoint \${req.method} \${req.originalUrl} not found\`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /nfc-test',
      'GET /network-test',
      'POST /api/nfc-payment'
    ]
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🌊 =======================================');
  console.log('🚀 UPP NFC Testing Server - AWS Edition');
  console.log(\`📡 Server running on port \${PORT}\`);
  console.log(\`🌐 Environment: \${process.env.NODE_ENV || 'production'}\`);
  console.log(\`☁️ Platform: AWS\`);
  console.log(\`🎯 Ready for NFC testing!\`);
  console.log('🌊 =======================================');
});

export default app;