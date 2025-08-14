import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server/index.js';
import { db } from '../database/connection.js';
import { productRepository } from '../database/product-repository.js';
import { customerRepository } from '../database/customer-repository.js';

describe('POS System Integration Tests - Part 1', () => {
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
});
