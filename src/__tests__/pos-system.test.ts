import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from './test-bootstrap';
import { db } from '../database/connection.js';
import { productRepository } from '../database/product-repository.js';
import { customerRepository } from '../database/customer-repository.js';

describe('POS System Integration Tests', () => {
  let server: any;
  let testProduct: any;
  let testCustomer: any;

  beforeAll(async () => {
    server = app.listen(0);
    const isConnected = await db.testConnection();
    if (!isConnected) {
      console.warn('Database not connected - running in demo mode');
    }
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    testProduct = await productRepository.createProduct({
      name: 'Test Coffee',
      description: 'Premium test coffee',
      price: 12.99,
      cost: 8.50,
      sku: 'TEST-COF-001',
      category: 'Beverages',
      stock: 100,
      minStock: 10,
      maxStock: 200,
      barcode: '1234567890123',
      imageUrl: 'https://example.com/coffee.jpg',
      isActive: true
    });

    testCustomer = await customerRepository.createCustomer({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1-808-555-0100',
      address: '123 Test St, Honolulu, HI 96815'
    });
  });

  describe('Product Management', () => {
    it('should create a new product', async () => {
      const product = await productRepository.createProduct({
        name: 'Test Product',
        description: 'Test description',
        price: 9.99,
        cost: 5.00,
        sku: 'TEST-001',
        category: 'Test',
        stock: 50,
        minStock: 5,
        maxStock: 100,
        isActive: true
      });

      expect(product).toBeDefined();
      expect(product.id).toBeDefined();
      expect(product.name).toBe('Test Product');
      expect(product.stock).toBe(50);
    });

    it('should retrieve all products', async () => {
      const products = await productRepository.getAllProducts();
      expect(products).toBeInstanceOf(Array);
      expect(products.length).toBeGreaterThan(0);
    });

    it('should update product stock', async () => {
      const success = await productRepository.updateProductStock(
        testProduct.id,
        -5,
        'sale',
        'test-transaction-001'
      );
      
      expect(success).toBe(true);
      
      const updatedProduct = await productRepository.getProductById(testProduct.id);
      expect(updatedProduct?.stock).toBe(95);
    });

    it('should identify low stock products', async () => {
      await productRepository.updateProductStock(testProduct.id, -91, 'sale', 'test-transaction-002');
      
      const lowStockProducts = await productRepository.getLowStockProducts();
      const hasLowStock = lowStockProducts.some(p => p.id === testProduct.id);
      expect(hasLowStock).toBe(true);
    });
  });

  describe('Customer Management', () => {
    it('should create a new customer', async () => {
      const customer = await customerRepository.createCustomer({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+1-808-555-0200',
        address: '456 Test Ave, Honolulu, HI 96816'
      });

      expect(customer).toBeDefined();
      expect(customer.id).toBeDefined();
      expect(customer.email).toBe('jane.smith@example.com');
      expect(customer.loyaltyPoints).toBe(0);
    });

    it('should retrieve customer by email', async () => {
      const customer = await customerRepository.getCustomerByEmail('john.doe@example.com');
      expect(customer).toBeDefined();
      expect(customer?.email).toBe('john.doe@example.com');
    });

    it('should update customer information', async () => {
      const updated = await customerRepository.updateCustomer(testCustomer.id, {
        phone: '+1-808-555-9999'
      });
      
      expect(updated).toBeDefined();
      expect(updated?.phone).toBe('+1-808-555-9999');
    });

    it('should track purchase history', async () => {
      const history = await customerRepository.addPurchaseHistory({
        customerId: testCustomer.id,
        transactionId: 'test-transaction-003',
        purchaseDate: new Date(),
        amount: 25.99,
        currency: 'USD',
        items: [
          { productId: testProduct.id, name: testProduct.name, quantity: 2, price: testProduct.price }
        ]
      });

      expect(history).toBeDefined();
      expect(history.customerId).toBe(testCustomer.id);
      expect(history.amount).toBe(25.99);
    });

    it('should retrieve purchase history', async () => {
      await customerRepository.addPurchaseHistory({
        customerId: testCustomer.id,
        transactionId: 'test-transaction-004',
        purchaseDate: new Date(),
        amount: 15.99,
        currency: 'USD',
        items: []
      });

      const history = await customerRepository.getPurchaseHistory(testCustomer.id);
      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('POS API Endpoints', () => {
    it('should get product catalog', async () => {
      const response = await request(app)
        .get('/api/pos/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.products).toBeInstanceOf(Array);
    });

    it('should create a new order', async () => {
      const orderData = {
        items: [
          { productId: testProduct.id, quantity: 2 }
        ],
        customer: {
          email: testCustomer.email,
          name: `${testCustomer.firstName} ${testCustomer.lastName}`
        },
        terminalId: 'test-terminal-001'
      };

      const response = await request(app)
        .post('/api/pos/order')
        .send(orderData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.order).toBeDefined();
      expect(response.body.order.total).toBeGreaterThan(0);
    });

    it('should process customer payment', async () => {
      // First create an order
      const orderData = {
        items: [
          { productId: testProduct.id, quantity: 1 }
        ],
        customer: {
          email: testCustomer.email
        },
        terminalId: 'test-terminal-002'
      };

      const orderResponse = await request(app)
        .post('/api/pos/order')
        .send(orderData)
        .expect(200);

      const orderId = orderResponse.body.order.id;

      // Then process payment
      const paymentData = {
        orderId,
        paymentMethod: 'card'
      };

      const paymentResponse = await request(app)
        .post('/api/pos/payment')
        .send(paymentData)
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);
    });

    it('should get customer purchase history', async () => {
      const response = await request(app)
        .get(`/api/pos/customers/${testCustomer.id}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.history).toBeInstanceOf(Array);
    });

    it('should get low stock alerts', async () => {
      const response = await request(app)
        .get('/api/pos/low-stock')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.products).toBeInstanceOf(Array);
    });
  });

  describe('Loyalty Program', () => {
    it('should track loyalty points', async () => {
      const programs = await customerRepository.getLoyaltyPrograms();
      expect(programs).toBeInstanceOf(Array);
    });

    it('should update customer loyalty points', async () => {
      const success = await customerRepository.updateCustomerLoyaltyPoints(
        testCustomer.id,
        'default-program',
        10,
        0
      );
      
      expect(success).toBe(true);
      
      const updatedCustomer = await customerRepository.getCustomerById(testCustomer.id);
      expect(updatedCustomer?.loyaltyPoints).toBe(10);
    });
  });

  describe('Integration Testing', () => {
    it('should complete full purchase flow', async () => {
      // 1. Create order
      const orderData = {
        items: [
          { productId: testProduct.id, quantity: 3 }
        ],
        customer: {
          email: testCustomer.email,
          name: `${testCustomer.firstName} ${testCustomer.lastName}`
        },
        terminalId: 'test-terminal-integration'
      };

      const orderResponse = await request(app)
        .post('/api/pos/order')
        .send(orderData)
        .expect(200);

      const order = orderResponse.body.order;

      // 2. Process payment
      const paymentResponse = await request(app)
        .post('/api/pos/payment')
        .send({ orderId: order.id, paymentMethod: 'card' })
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);

      // 3. Verify stock update
      const updatedProduct = await productRepository.getProductById(testProduct.id);
      expect(updatedProduct?.stock).toBe(97); // 100 - 3 = 97

      // 4. Verify purchase history
      const history = await customerRepository.getPurchaseHistory(testCustomer.id);
      const hasPurchase = history.some(h => h.transactionId === order.id);
      expect(hasPurchase).toBe(true);
    });
  });
});
