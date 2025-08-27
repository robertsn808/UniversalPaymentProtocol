// Minimal UPP Server for Production Testing
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9000;

// Basic middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:8080', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'UPP', timestamp: new Date().toISOString() });
});

// Simple payment endpoint for testing
app.post('/api/payments/create', async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    // Mock successful payment for testing
    const paymentIntent = {
      id: 'pi_' + Math.random().toString(36).substring(7),
      client_secret: 'pi_' + Math.random().toString(36).substring(7) + '_secret_test',
      amount: amount * 100, // Convert to cents
      currency: 'usd',
      status: 'requires_payment_method',
      description: description || 'UPP Payment'
    };
    
    res.json({
      success: true,
      paymentIntent,
      message: 'Payment intent created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Universal Payment Protocol</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; }
        .status { color: #28a745; font-weight: bold; }
        .endpoint { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
        h1 { color: #333; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🌊 Universal Payment Protocol</h1>
        <p class="status">✅ UPP Server Running Successfully</p>
        <p>Port: ${PORT}</p>
        
        <h3>🚀 Available Endpoints:</h3>
        <div class="endpoint">• GET /health - Health check</div>
        <div class="endpoint">• POST /api/payments/create - Create payment intent</div>
        
        <h3>🔗 Connected Services:</h3>
        <div class="endpoint">• <a href="http://localhost:3001" target="_blank">Alii Fish Market Frontend</a></div>
        <div class="endpoint">• <a href="http://localhost:8080" target="_blank">Alii Backend API</a></div>
        
        <p><strong>🎯 Ready for production testing!</strong></p>
      </div>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`🌊 UPP Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🏠 Main page: http://localhost:${PORT}`);
});