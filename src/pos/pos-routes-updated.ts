// Updated POS System Server Module with database persistence
// Complete retail point-of-sale system with Stripe integration and inventory management

import express from 'express';
import { createPaymentProcessor } from '../server/stripe-integration.js';
import { transactionRepository } from '../database/repositories.js';
import { productRepository } from '../database/product-repository.js';
import { authenticateToken } from '../auth/jwt.js';
import { asyncHandler } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Initialize payment processor
const paymentProcessor = createPaymentProcessor();

// Interfaces
interface CartItem {
  product: any;
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
router.get('/pos/products', asyncHandler(async (req: express.Request, res: express.Response) => {
  const { category, search } = req.query;
  
  try {
    const products = await productRepository.getAllProducts({
      category: category as string,
      search: search as string,
      isActive: true
    });
    
    const categories = await productRepository.getAllCategories();
    
    res.json({
      success: true,
      products,
      categories: categories.map(cat => cat.name)
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
}));

// POST /api/pos/order - Create new order
router.post('/pos/order', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
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
  
  try {
    // Validate products and check stock
    const cartItems: CartItem[] = [];
    for (const item of items) {
      const product = await productRepository.getProductById(item.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          error: `Product ${item.productId} not found`
        });
      }
      
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${product.name}`
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
    
    // Store order in database (simplified for demo)
    await transactionRepository.create({
      id: order.id,
      user_id: (req as any).user?.userId,
      device_id: order.terminalId,
      amount: order.total,
      currency: 'USD',
      status: 'pending',
      payment_method: 'pending',
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
    
    res.json({
      success: true,
      order,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
}));

// POST /api/pos/payment - Process payment for order
router.post('/pos/payment', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { orderId, paymentMethod } = req.body;
  
  try {
    // Get order details
    const order = await transactionRepository.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Process payment through payment processor
    const paymentResult = await paymentProcessor.processDevicePayment({
      amount: order.amount,
      deviceType: 'pos_terminal',
      deviceId: order.device_id,
      description: `POS Order ${order.id}`,
      customerEmail: order.metadata?.customer?.email,
      metadata: {
        order_id: order.id,
        items_count: order.metadata?.items?.length || 0,
        cashier_id: (req as any).user?.userId
      }
    });
    
    if (paymentResult.success) {
      // Update product stock
      const items = order.metadata?.items || [];
      for (const item of items) {
        await productRepository.updateProductStock(
          item.product_id,
          -item.quantity,
          'sale',
          order.id,
          (req as any).user?.userId
        );
      }
      
      // Update transaction status
      await transactionRepository.updateStatus(order.id, 'completed');
      
      res.json({
        success: true,
        payment: paymentResult,
        message: 'Payment processed successfully'
      });
    } else {
      await transactionRepository.updateStatus(order.id, 'failed', paymentResult.error_message);
      
      res.status(400).json({
        success: false,
        error: paymentResult.error_message || 'Payment failed'
      });
    }
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
}));

// GET /api/pos/categories - Get all categories
router.get('/pos/categories', asyncHandler(async (req: express.Request, res: express.Response) => {
  try {
    const categories = await productRepository.getAllCategories();
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
}));

// GET /api/pos/low-stock - Get low stock products
router.get('/pos/low-stock', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
  try {
    const products = await productRepository.getLowStockProducts();
    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch low stock products'
    });
  }
}));

// GET /api/pos/out-of-stock - Get out of stock products
router.get('/pos/out-of-stock', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
  try {
    const products = await productRepository.getOutOfStockProducts();
    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Error fetching out of stock products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch out of stock products'
    });
  }
}));

// POST /api/pos/restock - Restock products
router.post('/pos/restock', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { productId, quantity, supplierId, cost, notes } = req.body;
  
  try {
    const success = await productRepository.updateProductStock(
      productId,
      quantity,
      'purchase',
      supplierId,
      (req as any).user?.userId
    );
    
    if (success) {
      res.json({
        success: true,
        message: 'Products restocked successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to restock products'
      });
    }
  } catch (error) {
    console.error('Error restocking products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restock products'
    });
  }
}));

// GET /api/pos/stock-movements/:productId - Get stock movements for a product
router.get('/pos/stock-movements/:productId', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { productId } = req.params;
  const { limit = 50 } = req.query;
  
  try {
    const movements = await productRepository.getStockMovements(productId, parseInt(limit as string));
    res.json({
      success: true,
      movements
    });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stock movements'
