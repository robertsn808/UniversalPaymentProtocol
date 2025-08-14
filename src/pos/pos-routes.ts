// POS System Server Module for Universal Payment Protocol
// Complete retail point-of-sale system with Stripe integration

import express from 'express';
import { createPaymentProcessor } from '../../server/stripe-integration.js';
import { transactionRepository } from '../database/repositories.js';
import { authenticateToken } from '../auth/jwt.js';
import { asyncHandler } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Initialize payment processor
const paymentProcessor = createPaymentProcessor();

// Product catalog (in-memory for demo)
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  sku: string;
  stock: number;
  description?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount?: number;
}

interface POSOrder {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
  };
  paymentMethod: 'card' | 'cash' | 'digital';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  completedAt?: Date;
  receiptNumber: string;
  terminalId: string;
  cashierId?: string;
}

// Mock product catalog
const products: Product[] = [
  { id: '1', name: 'Hawaiian Coffee', price: 12.99, category: 'Beverages', sku: 'COF-001', stock: 50, description: 'Premium Kona coffee' },
  { id: '2', name: 'Macadamia Nuts', price: 8.50, category: 'Snacks', sku: 'NUT-001', stock: 30, description: 'Roasted macadamia nuts' },
  { id: '3', name: 'Pineapple Juice', price: 3.99, category: 'Beverages', sku: 'JUI-001', stock: 100, description: 'Fresh pineapple juice' },
  { id: '4', name: 'Coconut Water', price: 2.99, category: 'Beverages', sku: 'COC-001', stock: 75, description: 'Natural coconut water' },
  { id: '5', name: 'Taro Chips', price: 4.99, category: 'Snacks', sku: 'CHI-001', stock: 40, description: 'Crispy taro chips' },
  { id: '6', name: 'Mango Salsa', price: 5.99, category: 'Condiments', sku: 'SAL-001', stock: 25, description: 'Spicy mango salsa' },
  { id: '7', name: 'Hawaiian Honey', price: 15.99, category: 'Condiments', sku: 'HON-001', stock: 20, description: 'Raw Hawaiian honey' },
  { id: '8', name: 'Kona Chocolate', price: 9.99, category: 'Snacks', sku: 'CHO-001', stock: 35, description: 'Dark chocolate with Kona coffee' }
];

// Active orders storage
const activeOrders = new Map<string, POSOrder>();

// Generate receipt number
function generateReceiptNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const sequence = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `RCP${year}${month}${day}${sequence}`;
}

// Calculate order totals
function calculateOrderTotals(items: CartItem[]): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, item) => {
    const itemPrice = item.product.price * item.quantity;
    const discount = item.discount || 0;
    return sum + (itemPrice * (1 - discount / 100));
  }, 0);
  
  const tax = subtotal * 0.04; // 4% Hawaii state tax
  const total = subtotal + tax;
  
  return { subtotal, tax, total };
}

// GET /api/pos/products - Get product catalog
router.get('/pos/products', asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
  const { category, search } = req.query;
  
  let filteredProducts = products;
  
  if (category) {
    filteredProducts = filteredProducts.filter(p => p.category === category);
  }
  
  if (search) {
    const searchLower = search.toString().toLowerCase();
    filteredProducts = filteredProducts.filter(p => 
      p.name.toLowerCase().includes(searchLower) || 
      p.sku.toLowerCase().includes(searchLower)
    );
  }
  
  res.json({
    success: true,
    products: filteredProducts,
    categories: [...new Set(products.map(p => p.category))]
  });
}));

// POST /api/pos/order - Create new order
router.post('/pos/order', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
  const { items, customer, terminalId } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Order must contain at least one item'
    });
  }
  
  if (!terminalId) {
    return res.status(400).json({
      success: false,
      error: 'Terminal ID is required'
    });
  }
  
  // Validate products and stock
  const cartItems: CartItem[] = [];
  for (const item of items) {
    const product = products.find(p => p.id === item.productId);
    if (!product) {
      return res.status(400).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    if (product.stock < item.quantity) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient stock'
      });
    }
    
    cartItems.push({
      product,
      quantity: item.quantity,
      discount: item.discount || 0
    });
  }
  
  const { subtotal, tax, total } = calculateOrderTotals(cartItems);
  
  const order: POSOrder = {
    id: uuidv4(),
    items: cartItems,
    subtotal,
    tax,
    total,
    customer,
    paymentMethod: 'card',
    status: 'pending',
    createdAt: new Date(),
    receiptNumber: generateReceiptNumber(),
    terminalId,
    cashierId: (req as any).user?.userId
  };
  
  activeOrders.set(order.id, order);
  
  res.json({
    success: true,
    order,
    message: 'Order created successfully'
  });
}));

// POST /api/pos/payment - Process payment for order
router.post('/pos/payment', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
  const { orderId, paymentMethod } = req.body;
  
  const order = activeOrders.get(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }
  
  // Process payment through payment processor
  const paymentResult = await paymentProcessor.processDevicePayment({
    amount: order.total,
    deviceType: 'pos_terminal',
    deviceId: order.terminalId,
    description: `POS Order ${order.receiptNumber}`,
    customerEmail: order.customer?.email,
    metadata: {
      order_id: order.id,
      receipt_number: order.receiptNumber,
      items_count: order.items.length,
      cashier_id: (req as any).user?.userId
    }
  });
  
  if (paymentResult.success) {
    order.status = 'completed';
    order.completedAt = new Date();
    
    // Update stock
    for (const item of order.items) {
      const product = products.find(p => p.id === item.product.id);
      if (product) {
        product.stock -= item.quantity;
      }
    }
    
    // Save to database
    try {
      await transactionRepository.create({
        id: paymentResult.transactionId,
        user_id: (req as any).user?.userId,
        device_id: order.terminalId,
        amount: order.total,
        currency: 'USD',
        status: 'completed',
        payment_method: paymentMethod,
        description: `POS Order ${order.receiptNumber}`,
        metadata: {
          order_id: order.id,
          items: order.items.map(item => ({
            product_id: item.product.id,
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            discount: item.discount || 0
          })),
          subtotal: order.subtotal,
          tax: order.tax,
          customer: order.customer
        }
      });
    } catch (dbError) {
      console.warn('Failed to save transaction to database:', dbError);
    }
    
    res.json({
      success: true,
      order,
      payment: paymentResult,
      message: 'Payment processed successfully'
    });
  } else {
    order.status = 'failed';
    res.status(400).json({
      success: false,
      error: paymentResult.error || 'Payment failed'
    });
  }
}));

// GET /api/pos/order/:orderId - Get order details
router.get('/pos/order/:orderId', async (req: express.Request, res: express.Response): Promise<void> => {
  const { orderId } = req.params;
  const order = activeOrders.get(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found'
    });
  }
  
  res.json({
    success: true,
    order
  });
});

// POST /api/pos/refund - Process refund
router.post('/pos/refund', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response): Promise<void> => {
  const { transactionId, amount } = req.body;
  
  if (!transactionId) {
    return res.status(400).json({
      success: false,
      error: 'Transaction ID is required'
    });
  }
  
  const refundResult = await paymentProcessor.refundPayment(
    transactionId,
    amount ? parseFloat(amount) : undefined
  );
  
  res.json({
    success: true,
    refund: refundResult,
    message: 'Refund processed successfully'
  });
}));

export default router;
