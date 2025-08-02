// Kai's Universal Payment Protocol Server - PRODUCTION READY! 🌊
// Let's make some money! 💰

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { UPPStripeProcessor } from './stripe-integration.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Stripe processor
let stripeProcessor: UPPStripeProcessor;
try {
  stripeProcessor = new UPPStripeProcessor();
} catch (error) {
  console.error('⚠️  Stripe not configured. Set STRIPE_SECRET_KEY in .env file');
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

console.log('🌊 Kai\'s UPP Server Starting...');
console.log('💰 Ready to make some money!');

// Welcome endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🌊 Universal Payment Protocol - LIVE!',
    tagline: 'ANY Device + Internet = Payment Terminal',
    version: '1.0.0',
    status: 'Making Money! 💰',
    features: [
      'Smartphone Payments',
      'Smart TV Payments', 
      'IoT Device Payments',
      'Voice Assistant Payments',
      'ANY Internet Device!'
    ],
    stripe_configured: !!stripeProcessor
  });
});

// Health check for AWS
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'AWS',
    message: 'UPP System ALIVE and MAKING MONEY! 🌊💰',
    stripe_ready: !!stripeProcessor
  });
});

// REAL Stripe Payment Processing
app.post('/api/process-payment', async (req, res) => {
  try {
    if (!stripeProcessor) {
      return res.status(500).json({
        success: false,
        error: 'Stripe not configured',
        message: 'Set STRIPE_SECRET_KEY in environment variables'
      });
    }

    const { amount, deviceType, deviceId, description, customerEmail, metadata } = req.body;
    
    console.log(`💳 Processing ${deviceType} payment: $${amount}`);
    
    const result = await stripeProcessor.processDevicePayment({
      amount,
      deviceType,
      deviceId,
      description,
      customerEmail,
      metadata
    });

    console.log(`✅ Payment Intent Created: ${result.payment_intent_id}`);
    
    res.json({
      ...result,
      message: `Payment ready for ${deviceType}! 🌊`
    });

  } catch (error: any) {
    console.error('💥 Payment Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Payment failed, but we\'ll fix it! 🌊'
    });
  }
});

// Device Registration Endpoint
app.post('/api/register-device', async (req, res) => {
  try {
    const { deviceType, capabilities, fingerprint } = req.body;
    
    console.log(`📱 Registering ${deviceType} device`);
    
    // Generate device ID
    const deviceId = `${deviceType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // In a real implementation, you would store the device in a database
    // For now, we'll just return a success response
    res.json({
      success: true,
      deviceId: deviceId,
      message: `Device ${deviceType} registered successfully! 🌊`
    });

  } catch (error: any) {
    console.error('💥 Device Registration Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Device registration failed! 🌊'
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🌊 UPP Server listening on port ${PORT}`);
  console.log(`📱 Ready to process payments from ANY device!`);
});
