// POS Inventory Management System
// Handles product inventory, stock tracking, and alerts

import { 
  Product, 
  ProductVariant, 
  Category, 
  InventoryMovement, 
  StockAlert,
  POSValidationResult 
} from '../types.js';
import { ValidationError } from '../../../utils/errors.js';
import secureLogger from '../../../shared/logger.js';

export class InventoryManager {
  private products: Map<string, Product> = new Map();
  private categories: Map<string, Category> = new Map();
  private stockAlerts: Map<string, StockAlert> = new Map();
  private movementHistory: InventoryMovement[] = [];

  // Product Management
  async createProduct(productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    this.validateProductData(productData);
    
    const product: Product = {
      ...productData,
      id: `prod_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.products.set(product.id, product);
    
    secureLogger.info('Product created', {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      initialQuantity: product.inventory_quantity
    });

    // Check for stock alerts after creation
    await this.checkStockLevels(product.id);
    
    return product;
  }

  async updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    const product = this.products.get(productId);
    if (!product) {
      throw new ValidationError(`Product not found: ${productId}`);
    }

    const oldQuantity = product.inventory_quantity;
    const updatedProduct: Product = {
      ...product,
      ...updates,
      id: productId,
      updated_at: new Date()
    };

    this.products.set(productId, updatedProduct);

    // Track inventory changes
    if (updates.inventory_quantity !== undefined && updates.inventory_quantity !== oldQuantity) {
      await this.recordInventoryMovement({
        id: `mov_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        product_id: productId,
        movement_type: 'adjustment',
        quantity_change: updates.inventory_quantity - oldQuantity,
        quantity_before: oldQuantity,
        quantity_after: updates.inventory_quantity,
        reason: 'Manual adjustment',
        created_at: new Date()
      });
    }

    await this.checkStockLevels(productId);
    
    secureLogger.info('Product updated', {
      productId,
      changes: Object.keys(updates)
    });

    return updatedProduct;
  }

  async deleteProduct(productId: string): Promise<boolean> {
    const product = this.products.get(productId);
    if (!product) {
      throw new ValidationError(`Product not found: ${productId}`);
    }

    // Mark as inactive instead of deleting for audit trail
    await this.updateProduct(productId, { is_active: false });
    
    secureLogger.info('Product deactivated', { productId });
    return true;
  }

  getProduct(productId: string): Product | undefined {
    return this.products.get(productId);
  }

  getAllProducts(filters?: {
    category?: string;
    isActive?: boolean;
    inStock?: boolean;
    lowStock?: boolean;
  }): Product[] {
    let products = Array.from(this.products.values());

    if (filters) {
      if (filters.category) {
        products = products.filter(p => p.category === filters.category);
      }
      if (filters.isActive !== undefined) {
        products = products.filter(p => p.is_active === filters.isActive);
      }
      if (filters.inStock) {
        products = products.filter(p => p.inventory_quantity > 0);
      }
      if (filters.lowStock) {
        products = products.filter(p => 
          p.min_stock_level && p.inventory_quantity <= p.min_stock_level
        );
      }
    }

    return products.sort((a, b) => a.name.localeCompare(b.name));
  }

  searchProducts(query: string): Product[] {
    const searchTerm = query.toLowerCase();
    return Array.from(this.products.values()).filter(product =>
      product.name.toLowerCase().includes(searchTerm) ||
      product.sku.toLowerCase().includes(searchTerm) ||
      product.barcode?.toLowerCase().includes(searchTerm) ||
      product.description?.toLowerCase().includes(searchTerm)
    );
  }

  // Category Management
  async createCategory(categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> {
    const category: Category = {
      ...categoryData,
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.categories.set(category.id, category);
    
    secureLogger.info('Category created', {
      categoryId: category.id,
      name: category.name
    });

    return category;
  }

  getCategory(categoryId: string): Category | undefined {
    return this.categories.get(categoryId);
  }

  getAllCategories(): Category[] {
    return Array.from(this.categories.values())
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  // Stock Management
  async adjustStock(
    productId: string, 
    quantityChange: number, 
    reason: string,
    variantId?: string,
    userId?: string
  ): Promise<void> {
    const product = this.products.get(productId);
    if (!product) {
      throw new ValidationError(`Product not found: ${productId}`);
    }

    const oldQuantity = product.inventory_quantity;
    const newQuantity = Math.max(0, oldQuantity + quantityChange);

    await this.updateProduct(productId, { 
      inventory_quantity: newQuantity 
    });

    await this.recordInventoryMovement({
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      product_id: productId,
      variant_id: variantId,
      movement_type: quantityChange > 0 ? 'restock' : 'adjustment',
      quantity_change: quantityChange,
      quantity_before: oldQuantity,
      quantity_after: newQuantity,
      reason,
      user_id: userId,
      created_at: new Date()
    });

    secureLogger.info('Stock adjusted', {
      productId,
      quantityChange,
      newQuantity,
      reason
    });
  }

  async processSale(productId: string, quantity: number, saleId: string): Promise<void> {
    const product = this.products.get(productId);
    if (!product) {
      throw new ValidationError(`Product not found: ${productId}`);
    }

    if (product.inventory_quantity < quantity) {
      throw new ValidationError(`Insufficient stock. Available: ${product.inventory_quantity}, Requested: ${quantity}`);
    }

    const oldQuantity = product.inventory_quantity;
    const newQuantity = oldQuantity - quantity;

    await this.updateProduct(productId, { 
      inventory_quantity: newQuantity 
    });

    await this.recordInventoryMovement({
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      product_id: productId,
      movement_type: 'sale',
      quantity_change: -quantity,
      quantity_before: oldQuantity,
      quantity_after: newQuantity,
      reference_id: saleId,
      created_at: new Date()
    });

    secureLogger.info('Stock reduced for sale', {
      productId,
      quantitySold: quantity,
      remainingStock: newQuantity,
      saleId
    });
  }

  async processReturn(productId: string, quantity: number, saleId: string): Promise<void> {
    const product = this.products.get(productId);
    if (!product) {
      throw new ValidationError(`Product not found: ${productId}`);
    }

    const oldQuantity = product.inventory_quantity;
    const newQuantity = oldQuantity + quantity;

    await this.updateProduct(productId, { 
      inventory_quantity: newQuantity 
    });

    await this.recordInventoryMovement({
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      product_id: productId,
      movement_type: 'return',
      quantity_change: quantity,
      quantity_before: oldQuantity,
      quantity_after: newQuantity,
      reference_id: saleId,
      created_at: new Date()
    });

    secureLogger.info('Stock increased for return', {
      productId,
      quantityReturned: quantity,
      newStock: newQuantity,
      saleId
    });
  }

  // Stock Alerts
  async checkStockLevels(productId?: string): Promise<StockAlert[]> {
    const productsToCheck = productId 
      ? [this.products.get(productId)].filter(Boolean) as Product[]
      : Array.from(this.products.values());

    const newAlerts: StockAlert[] = [];

    for (const product of productsToCheck) {
      if (!product.is_active) continue;

      const alerts = this.generateStockAlerts(product);
      for (const alert of alerts) {
        this.stockAlerts.set(alert.id, alert);
        newAlerts.push(alert);
      }
    }

    return newAlerts;
  }

  private generateStockAlerts(product: Product): StockAlert[] {
    const alerts: StockAlert[] = [];
    const currentQuantity = product.inventory_quantity;

    // Out of stock alert
    if (currentQuantity === 0) {
      alerts.push({
        id: `alert_${product.id}_out_of_stock`,
        product_id: product.id,
        alert_type: 'out_of_stock',
        current_quantity: currentQuantity,
        threshold_quantity: 0,
        message: `${product.name} is out of stock`,
        priority: 'critical',
        is_resolved: false,
        created_at: new Date()
      });
    }
    // Low stock alert
    else if (product.min_stock_level && currentQuantity <= product.min_stock_level) {
      alerts.push({
        id: `alert_${product.id}_low_stock`,
        product_id: product.id,
        alert_type: 'low_stock',
        current_quantity: currentQuantity,
        threshold_quantity: product.min_stock_level,
        message: `${product.name} is running low (${currentQuantity} remaining)`,
        priority: currentQuantity <= (product.min_stock_level * 0.5) ? 'high' : 'medium',
        is_resolved: false,
        created_at: new Date()
      });
    }
    // Overstock alert
    else if (product.max_stock_level && currentQuantity > product.max_stock_level) {
      alerts.push({
        id: `alert_${product.id}_overstock`,
        product_id: product.id,
        alert_type: 'overstock',
        current_quantity: currentQuantity,
        threshold_quantity: product.max_stock_level,
        message: `${product.name} is overstocked (${currentQuantity} units)`,
        priority: 'low',
        is_resolved: false,
        created_at: new Date()
      });
    }

    return alerts;
  }

  getStockAlerts(priority?: StockAlert['priority']): StockAlert[] {
    let alerts = Array.from(this.stockAlerts.values()).filter(alert => !alert.is_resolved);
    
    if (priority) {
      alerts = alerts.filter(alert => alert.priority === priority);
    }

    return alerts.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Inventory Movement History
  private async recordInventoryMovement(movement: InventoryMovement): Promise<void> {
    this.movementHistory.push(movement);
    
    // Keep only last 10000 movements in memory
    if (this.movementHistory.length > 10000) {
      this.movementHistory = this.movementHistory.slice(-10000);
    }
  }

  getInventoryMovements(
    productId?: string, 
    movementType?: InventoryMovement['movement_type'],
    limit: number = 100
  ): InventoryMovement[] {
    let movements = [...this.movementHistory];

    if (productId) {
      movements = movements.filter(m => m.product_id === productId);
    }

    if (movementType) {
      movements = movements.filter(m => m.movement_type === movementType);
    }

    return movements
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }

  // Validation
  private validateProductData(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): POSValidationResult {
    const errors: string[] = [];

    if (!product.name?.trim()) {
      errors.push('Product name is required');
    }

    if (!product.sku?.trim()) {
      errors.push('Product SKU is required');
    }

    if (product.price < 0) {
      errors.push('Product price cannot be negative');
    }

    if (product.inventory_quantity < 0) {
      errors.push('Inventory quantity cannot be negative');
    }

    if (!product.category?.trim()) {
      errors.push('Product category is required');
    }

    if (!product.unit_of_measure?.trim()) {
      errors.push('Unit of measure is required');
    }

    // Check for duplicate SKU
    const existingProduct = Array.from(this.products.values())
      .find(p => p.sku === product.sku && p.is_active);
    
    if (existingProduct) {
      errors.push(`SKU '${product.sku}' already exists`);
    }

    if (errors.length > 0) {
      throw new ValidationError(`Product validation failed: ${errors.join(', ')}`);
    }

    return { valid: true, errors: [] };
  }

  // Bulk Operations
  async bulkUpdateStock(updates: Array<{
    productId: string;
    quantityChange: number;
    reason: string;
  }>): Promise<void> {
    for (const update of updates) {
      await this.adjustStock(
        update.productId, 
        update.quantityChange, 
        update.reason
      );
    }

    secureLogger.info('Bulk stock update completed', {
      updatedProducts: updates.length
    });
  }

  // Analytics
  getInventoryValue(): { totalValue: number; totalCost: number; productCount: number } {
    let totalValue = 0;
    let totalCost = 0;
    let productCount = 0;

    for (const product of this.products.values()) {
      if (product.is_active) {
        totalValue += product.price * product.inventory_quantity;
        if (product.cost) {
          totalCost += product.cost * product.inventory_quantity;
        }
        productCount++;
      }
    }

    return { totalValue, totalCost, productCount };
  }

  getLowStockProducts(): Product[] {
    return this.getAllProducts({ lowStock: true });
  }

  getTopSellingProducts(days: number = 30): Array<{
    product: Product;
    quantitySold: number;
    revenue: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const salesData = new Map<string, { quantity: number; revenue: number }>();

    // Aggregate sales data from movement history
    for (const movement of this.movementHistory) {
      if (movement.movement_type === 'sale' && movement.created_at >= cutoffDate) {
        const productId = movement.product_id;
        const product = this.products.get(productId);
        
        if (product) {
          const existing = salesData.get(productId) || { quantity: 0, revenue: 0 };
          salesData.set(productId, {
            quantity: existing.quantity + Math.abs(movement.quantity_change),
            revenue: existing.revenue + (Math.abs(movement.quantity_change) * product.price)
          });
        }
      }
    }

    // Convert to array and sort by quantity sold
    return Array.from(salesData.entries())
      .map(([productId, data]) => ({
        product: this.products.get(productId)!,
        quantitySold: data.quantity,
        revenue: data.revenue
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 20);
  }
}