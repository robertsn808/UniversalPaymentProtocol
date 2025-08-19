// POS Data Loader
// Loads initial data into the POS system

import { InventoryManager } from './InventoryManager.js';
import { SalesManager } from './SalesManager.js';
import { seafoodProducts, seafoodCategories, generateProductIds, generateCategoryIds } from '../data/seafood-products.js';
import secureLogger from '../../../shared/logger.js';

export class POSDataLoader {
  private inventoryManager: InventoryManager;
  private salesManager: SalesManager;

  constructor(inventoryManager: InventoryManager, salesManager: SalesManager) {
    this.inventoryManager = inventoryManager;
    this.salesManager = salesManager;
  }

  async loadSeafoodMarketData(): Promise<void> {
    try {
      secureLogger.info('Loading seafood market data into POS system...');

      // Load categories first
      const categories = generateCategoryIds(seafoodCategories);
      for (const categoryData of categories) {
        await this.inventoryManager.createCategory(categoryData);
      }

      secureLogger.info(`Loaded ${categories.length} product categories`);

      // Load products
      const products = generateProductIds(seafoodProducts);
      for (const productData of products) {
        await this.inventoryManager.createProduct(productData);
      }

      secureLogger.info(`Loaded ${products.length} seafood products`);

      // Create some sample customers
      await this.createSampleCustomers();

      secureLogger.info('✅ Seafood market data loaded successfully');

    } catch (error) {
      secureLogger.error('Failed to load seafood market data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async createSampleCustomers(): Promise<void> {
    const sampleCustomers = [
      {
        name: 'John Smith',
        email: 'john.smith@email.com',
        phone: '(555) 123-4567',
        customer_type: 'regular' as const,
        address: {
          street: '123 Ocean Ave',
          city: 'Marina Bay',
          state: 'CA',
          zip_code: '90210',
          country: 'USA'
        }
      },
      {
        name: 'Maria Rodriguez',
        email: 'maria.r@email.com',
        phone: '(555) 987-6543',
        customer_type: 'vip' as const,
        address: {
          street: '456 Harbor St',
          city: 'Fisherman\'s Wharf',
          state: 'CA',
          zip_code: '90211',
          country: 'USA'
        }
      },
      {
        name: 'Chef Robert Wilson',
        email: 'chef.wilson@restaurant.com',
        phone: '(555) 555-0123',
        customer_type: 'vip' as const,
        address: {
          street: '789 Coastal Blvd',
          city: 'Seaside',
          state: 'CA',
          zip_code: '90212',
          country: 'USA'
        }
      }
    ];

    for (const customerData of sampleCustomers) {
      await this.salesManager.createCustomer(customerData);
    }

    secureLogger.info(`Created ${sampleCustomers.length} sample customers`);
  }

  async loadDemoTransactions(): Promise<void> {
    try {
      secureLogger.info('Creating demo transactions...');

      // Get some products for demo sales
      const products = this.inventoryManager.getAllProducts({ isActive: true });
      if (products.length === 0) {
        secureLogger.warn('No products available for demo transactions');
        return;
      }

      // Create demo sales
      const demoSales = [
        {
          items: [
            { product_id: products[0].id, quantity: 2 },
            { product_id: products[1].id, quantity: 1 }
          ],
          payment_method: { type: 'card' as const }
        },
        {
          items: [
            { product_id: products[2].id, quantity: 1.5 },
            { product_id: products[3].id, quantity: 3 }
          ],
          payment_method: { type: 'cash' as const }
        },
        {
          items: [
            { product_id: products[4].id, quantity: 1 }
          ],
          payment_method: { type: 'nfc' as const }
        }
      ];

      for (const saleData of demoSales) {
        try {
          // Create sale
          const sale = await this.salesManager.createSale(
            saleData,
            'seafood_market_001'
          );

          // Process payment
          const paymentRequest = {
            sale_id: sale.id,
            amount: sale.total_amount,
            payment_method: saleData.payment_method,
            upp_payment_data: {
              deviceType: 'pos_terminal',
              capabilities: {
                display: 'touchscreen',
                internet_connection: true
              }
            }
          };

          await this.salesManager.processPayment(paymentRequest);

        } catch (error) {
          secureLogger.warn('Demo transaction failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      secureLogger.info('✅ Demo transactions created');

    } catch (error) {
      secureLogger.error('Failed to create demo transactions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async initializeDefaultData(): Promise<void> {
    await this.loadSeafoodMarketData();
    await this.loadDemoTransactions();
  }
}