// Product repository for inventory management
// Provides database operations for products, categories, and stock management

import { db } from './connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  cost: number;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  maxStock: number;
  barcode?: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovement {
  id: string;
  productId: string;
  variantId?: string;
  movementType: 'sale' | 'purchase' | 'adjustment' | 'return' | 'transfer' | 'damage';
  quantity: number;
  referenceId?: string;
  referenceType?: string;
  notes?: string;
  userId?: number;
  createdAt: Date;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  parentCategoryId?: string;
  isActive: boolean;
  createdAt: Date;
}

export class ProductRepository {
  // Product management
  async createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const id = uuidv4();
    const query = `
      INSERT INTO products (id, name, description, price, cost, sku, category, stock, min_stock, max_stock, barcode, image_url, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      id,
      product.name,
      product.description,
      product.price,
      product.cost,
      product.sku,
      product.category,
      product.stock,
      product.minStock,
      product.maxStock,
      product.barcode,
      product.imageUrl,
      product.isActive
    ]);
    
    return this.mapProductFromDb(result.rows[0]);
  }

  async getProductById(id: string): Promise<Product | null> {
    const query = 'SELECT * FROM products WHERE id = $1 AND is_active = true';
    const result = await db.query(query, [id]);
    
    return result.rows.length > 0 ? this.mapProductFromDb(result.rows[0]) : null;
  }

  async getProductBySku(sku: string): Promise<Product | null> {
    const query = 'SELECT * FROM products WHERE sku = $1 AND is_active = true';
    const result = await db.query(query, [sku]);
    
    return result.rows.length > 0 ? this.mapProductFromDb(result.rows[0]) : null;
  }

  async getAllProducts(filters?: {
    category?: string;
    search?: string;
    isActive?: boolean;
    minStock?: number;
    maxStock?: number;
  }): Promise<Product[]> {
    let query = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.category) {
      query += ` AND category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    if (filters?.search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters?.isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(filters.isActive);
      paramIndex++;
    }

    if (filters?.minStock !== undefined) {
      query += ` AND stock >= $${paramIndex}`;
      params.push(filters.minStock);
      paramIndex++;
    }

    if (filters?.maxStock !== undefined) {
      query += ` AND stock <= $${paramIndex}`;
      params.push(filters.maxStock);
      paramIndex++;
    }

    query += ' ORDER BY name ASC';

    const result = await db.query(query, params);
    return result.rows.map(row => this.mapProductFromDb(row));
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
    const fields = Object.keys(updates).map(key => `${this.snakeCase(key)} = $${Object.keys(updates).indexOf(key) + 2}`).join(', ');
    
    const query = `
      UPDATE products 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [id, ...Object.values(updates)];
    const result = await db.query(query, values);
    
    return result.rows.length > 0 ? this.mapProductFromDb(result.rows[0]) : null;
  }

  async updateProductStock(id: string, quantity: number, movementType: StockMovement['movementType'], referenceId?: string, userId?: number): Promise<boolean> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Update product stock
      const updateQuery = `
        UPDATE products 
        SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING stock
      `;
      
      const updateResult = await client.query(updateQuery, [quantity, id]);
      
      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      
      // Record stock movement
      const movementQuery = `
        INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_id, user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await client.query(movementQuery, [
        uuidv4(),
        id,
        movementType,
        quantity,
        referenceId,
        userId
      ]);
      
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    const query = 'UPDATE products SET is_active = false WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rowCount > 0;
  }

  // Category management
  async getAllCategories(): Promise<ProductCategory[]> {
    const query = 'SELECT * FROM product_categories WHERE is_active = true ORDER BY name ASC';
    const result = await db.query(query);
    return result.rows.map(row => this.mapCategoryFromDb(row));
  }

  async getCategoryById(id: string): Promise<ProductCategory | null> {
    const query = 'SELECT * FROM product_categories WHERE id = $1 AND is_active = true';
    const result = await db.query(query, [id]);
    return result.rows.length > 0 ? this.mapCategoryFromDb(result.rows[0]) : null;
  }

  // Stock management
  async getStockMovements(productId: string, limit: number = 50): Promise<StockMovement[]> {
    const query = `
      SELECT * FROM stock_movements 
      WHERE product_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    
    const result = await db.query(query, [productId, limit]);
    return result.rows.map(row => this.mapStockMovementFromDb(row));
  }

  async getLowStockProducts(): Promise<Product[]> {
    const query = 'SELECT * FROM products WHERE stock <= min_stock AND is_active = true ORDER BY stock ASC';
    const result = await db.query(query);
    return result.rows.map(row => this.mapProductFromDb(row));
  }

  async getOutOfStockProducts(): Promise<Product[]> {
    const query = 'SELECT * FROM products WHERE stock = 0 AND is_active = true ORDER BY name ASC';
    const result = await db.query(query);
    return result.rows.map(row => this.mapProductFromDb(row));
  }

  // Helper methods
  private mapProductFromDb(row: any): Product {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: parseFloat(row.price),
      cost: parseFloat(row.cost),
      sku: row.sku,
      category: row.category,
      stock: row.stock,
      minStock: row.min_stock,
      maxStock: row.max_stock,
      barcode: row.barcode,
      imageUrl: row.image_url,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapCategoryFromDb(row: any): ProductCategory {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      parentCategoryId: row.parent_category_id,
      isActive: row.is_active,
      createdAt: row.created_at
    };
  }

  private mapStockMovementFromDb(row: any): StockMovement {
    return {
      id: row.id,
      productId: row.product_id,
      variantId: row.variant_id,
      movementType: row.movement_type,
      quantity: row.quantity,
      referenceId: row.reference_id,
      referenceType: row.reference_type,
      notes: row.notes,
      userId: row.user_id,
      createdAt: row.created_at
    };
  }

  private snakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}

// Export singleton instance
export const productRepository = new ProductRepository();
