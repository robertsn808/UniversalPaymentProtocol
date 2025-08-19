// POS API Routes
// RESTful endpoints for Point of Sale operations

import express, { Request, Response } from 'express';
import { InventoryManager } from '../core/InventoryManager.js';
import { SalesManager } from '../core/SalesManager.js';
import { POSDataLoader } from '../core/DataLoader.js';
import { 
  CreateSaleRequest, 
  ProcessPaymentRequest, 
  Product, 
  Customer 
} from '../types.js';
import { authenticateToken, AuthenticatedRequest } from '../../../auth/jwt.js';
import { asyncHandler } from '../../../utils/errors.js';
import { generalRateLimit, paymentRateLimit } from '../../../middleware/security.js';
import secureLogger from '../../../shared/logger.js';

const router = express.Router();

// Initialize POS managers
const inventoryManager = new InventoryManager();
const salesManager = new SalesManager(inventoryManager);
const dataLoader = new POSDataLoader(inventoryManager, salesManager);

// Initialize with seafood market data
let dataInitialized = false;
async function initializePOSData() {
  if (!dataInitialized) {
    try {
      await dataLoader.initializeDefaultData();
      dataInitialized = true;
      secureLogger.info('POS system initialized with seafood market data');
    } catch (error) {
      secureLogger.error('Failed to initialize POS data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Initialize data on first request
router.use(asyncHandler(async (req, res, next) => {
  await initializePOSData();
  next();
}));

// Middleware for all POS routes
router.use(authenticateToken);
router.use(generalRateLimit);

// Product Management Routes

// Get all products
router.get('/products', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { category, inStock, lowStock, search } = req.query;
  
  let products = inventoryManager.getAllProducts({
    category: category as string,
    isActive: true,
    inStock: inStock === 'true',
    lowStock: lowStock === 'true'
  });

  if (search) {
    products = inventoryManager.searchProducts(search as string);
  }

  secureLogger.info('Products retrieved', {
    userId: req.user?.userId?.toString(),
    productCount: products.length,
    filters: { category, inStock, lowStock, search }
  });

  res.json({
    success: true,
    products,
    count: products.length
  });
}));

// Get product by ID
router.get('/products/:productId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;
  
  const product = inventoryManager.getProduct(productId);
  if (!product) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }

  res.json({
    success: true,
    product
  });
}));

// Create new product
router.post('/products', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const productData = req.body;
  
  const product = await inventoryManager.createProduct(productData);

  secureLogger.info('Product created', {
    userId: req.user?.userId?.toString(),
    productId: product.id,
    productName: product.name
  });

  res.status(201).json({
    success: true,
    product,
    message: 'Product created successfully'
  });
}));

// Update product
router.put('/products/:productId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;
  const updates = req.body;

  const product = await inventoryManager.updateProduct(productId, updates);

  secureLogger.info('Product updated', {
    userId: req.user?.userId?.toString(),
    productId,
    changes: Object.keys(updates)
  });

  res.json({
    success: true,
    product,
    message: 'Product updated successfully'
  });
}));

// Delete (deactivate) product
router.delete('/products/:productId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productId } = req.params;

  await inventoryManager.deleteProduct(productId);

  secureLogger.info('Product deactivated', {
    userId: req.user?.userId?.toString(),
    productId
  });

  res.json({
    success: true,
    message: 'Product deactivated successfully'
  });
}));

// Inventory Management Routes

// Adjust stock
router.post('/inventory/adjust', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productId, quantityChange, reason, variantId } = req.body;

  await inventoryManager.adjustStock(
    productId,
    quantityChange,
    reason,
    variantId,
    req.user?.userId?.toString()
  );

  secureLogger.info('Stock adjusted', {
    userId: req.user?.userId?.toString(),
    productId,
    quantityChange,
    reason
  });

  res.json({
    success: true,
    message: 'Stock adjusted successfully'
  });
}));

// Get stock alerts
router.get('/inventory/alerts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { priority } = req.query;

  const alerts = inventoryManager.getStockAlerts(priority as any);

  res.json({
    success: true,
    alerts,
    count: alerts.length
  });
}));

// Get inventory movements
router.get('/inventory/movements', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { productId, movementType, limit } = req.query;

  const movements = inventoryManager.getInventoryMovements(
    productId as string,
    movementType as any,
    limit ? parseInt(limit as string) : 100
  );

  res.json({
    success: true,
    movements,
    count: movements.length
  });
}));

// Get inventory analytics
router.get('/inventory/analytics', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const inventoryValue = inventoryManager.getInventoryValue();
  const lowStockProducts = inventoryManager.getLowStockProducts();
  const topSellingProducts = inventoryManager.getTopSellingProducts(30);

  res.json({
    success: true,
    analytics: {
      inventory_value: inventoryValue,
      low_stock_products: lowStockProducts,
      top_selling_products: topSellingProducts
    }
  });
}));

// Sales Management Routes

// Create new sale
router.post('/sales', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const saleData: CreateSaleRequest = req.body;
  const { merchantId } = req.query;

  const sale = await salesManager.createSale(
    saleData,
    merchantId as string || 'default_merchant',
    req.body.deviceId
  );

  secureLogger.info('Sale created', {
    userId: req.user?.userId?.toString(),
    saleId: sale.id,
    saleNumber: sale.sale_number,
    totalAmount: sale.total_amount
  });

  res.status(201).json({
    success: true,
    sale,
    message: 'Sale created successfully'
  });
}));

// Process payment for sale
router.post('/sales/:saleId/payment', paymentRateLimit, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { saleId } = req.params;
  const paymentRequest: ProcessPaymentRequest = {
    ...req.body,
    sale_id: saleId
  };

  const completedSale = await salesManager.processPayment(paymentRequest);

  secureLogger.payment('Sale payment completed', {
    userId: req.user?.userId?.toString(),
    saleId,
    saleNumber: completedSale.sale_number,
    totalAmount: completedSale.total_amount,
    paymentMethod: completedSale.payment_method.type,
    transactionId: completedSale.transaction_id
  });

  res.json({
    success: true,
    sale: completedSale,
    message: 'Payment processed successfully'
  });
}));

// Get sale by ID
router.get('/sales/:saleId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { saleId } = req.params;

  const sale = salesManager.getSale(saleId);
  if (!sale) {
    return res.status(404).json({
      success: false,
      error: 'Sale not found'
    });
  }

  res.json({
    success: true,
    sale
  });
}));

// Get all sales with filters
router.get('/sales', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { 
    merchantId, 
    customerId, 
    status, 
    saleType, 
    dateFrom, 
    dateTo,
    page = 1,
    limit = 50
  } = req.query;

  const filters = {
    merchantId: merchantId as string,
    customerId: customerId as string,
    status: status as any,
    saleType: saleType as any,
    dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
    dateTo: dateTo ? new Date(dateTo as string) : undefined
  };

  const sales = salesManager.getSales(filters);
  
  // Simple pagination
  const startIndex = (Number(page) - 1) * Number(limit);
  const endIndex = startIndex + Number(limit);
  const paginatedSales = sales.slice(startIndex, endIndex);

  res.json({
    success: true,
    sales: paginatedSales,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: sales.length,
      totalPages: Math.ceil(sales.length / Number(limit))
    }
  });
}));

// Void sale
router.post('/sales/:saleId/void', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { saleId } = req.params;
  const { reason } = req.body;

  const voidedSale = await salesManager.voidSale(saleId, reason);

  secureLogger.info('Sale voided', {
    userId: req.user?.userId?.toString(),
    saleId,
    reason
  });

  res.json({
    success: true,
    sale: voidedSale,
    message: 'Sale voided successfully'
  });
}));

// Return sale
router.post('/sales/:saleId/return', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { saleId } = req.params;
  const { itemsToReturn, reason } = req.body;

  const returnSale = await salesManager.returnSale(saleId, itemsToReturn, reason);

  secureLogger.info('Sale return processed', {
    userId: req.user?.userId?.toString(),
    originalSaleId: saleId,
    returnSaleId: returnSale.id,
    returnAmount: Math.abs(returnSale.total_amount)
  });

  res.json({
    success: true,
    returnSale,
    message: 'Return processed successfully'
  });
}));

// Customer Management Routes

// Create customer
router.post('/customers', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const customerData = req.body;

  const customer = await salesManager.createCustomer(customerData);

  secureLogger.info('Customer created', {
    userId: req.user?.userId?.toString(),
    customerId: customer.id,
    customerName: customer.name
  });

  res.status(201).json({
    success: true,
    customer,
    message: 'Customer created successfully'
  });
}));

// Search customers
router.get('/customers/search', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Search query is required'
    });
  }

  const customers = salesManager.searchCustomers(query as string);

  res.json({
    success: true,
    customers,
    count: customers.length
  });
}));

// Get customer by ID
router.get('/customers/:customerId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { customerId } = req.params;

  const customer = salesManager.getCustomer(customerId);
  if (!customer) {
    return res.status(404).json({
      success: false,
      error: 'Customer not found'
    });
  }

  res.json({
    success: true,
    customer
  });
}));

// Reports and Analytics Routes

// Daily sales report
router.get('/reports/daily', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { date, merchantId } = req.query;

  const reportDate = date ? new Date(date as string) : new Date();
  const report = salesManager.getDailySalesReport(
    reportDate,
    merchantId as string || 'default_merchant'
  );

  res.json({
    success: true,
    report
  });
}));

// Dashboard stats
router.get('/dashboard/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { merchantId } = req.query;
  const today = new Date();

  // Get today's sales
  const dailyReport = salesManager.getDailySalesReport(
    today,
    merchantId as string || 'default_merchant'
  );

  // Get inventory stats
  const inventoryValue = inventoryManager.getInventoryValue();
  const stockAlerts = inventoryManager.getStockAlerts();
  const lowStockCount = stockAlerts.filter(alert => 
    alert.alert_type === 'low_stock' || alert.alert_type === 'out_of_stock'
  ).length;

  res.json({
    success: true,
    stats: {
      today_sales: dailyReport.totalSales,
      today_transactions: dailyReport.transactionCount,
      average_transaction: dailyReport.averageTransaction,
      inventory_value: inventoryValue.totalValue,
      product_count: inventoryValue.productCount,
      low_stock_alerts: lowStockCount,
      total_alerts: stockAlerts.length
    }
  });
}));

// Categories Management

// Get all categories
router.get('/categories', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const categories = inventoryManager.getAllCategories();

  res.json({
    success: true,
    categories,
    count: categories.length
  });
}));

// Create category
router.post('/categories', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const categoryData = req.body;

  const category = await inventoryManager.createCategory(categoryData);

  secureLogger.info('Category created', {
    userId: req.user?.userId?.toString(),
    categoryId: category.id,
    categoryName: category.name
  });

  res.status(201).json({
    success: true,
    category,
    message: 'Category created successfully'
  });
}));

// Admin endpoint to reload seafood market data
router.post('/admin/reload-data', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  secureLogger.info('Reloading seafood market data', {
    userId: req.user?.userId?.toString()
  });

  try {
    await dataLoader.loadSeafoodMarketData();
    
    res.json({
      success: true,
      message: 'Seafood market data reloaded successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reload data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;