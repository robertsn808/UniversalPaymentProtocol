// Customer repository for POS system
// Manages customers, purchase history, and loyalty programs

import { db } from './connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  address?: string;
  loyaltyPoints: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseHistory {
  id: string;
  customerId: string;
  transactionId: string;
  purchaseDate: Date;
  amount: number;
  currency: string;
  items: any[];
  createdAt: Date;
}

export interface LoyaltyProgram {
  id: string;
  name: string;
  description?: string;
  pointsPerDollar: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerLoyalty {
  id: string;
  customerId: string;
  loyaltyProgramId: string;
  pointsEarned: number;
  pointsRedeemed: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CustomerRepository {
  async createCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'loyaltyPoints' | 'isActive'>): Promise<Customer> {
    const id = uuidv4();
    const query = `
      INSERT INTO customers (id, first_name, last_name, email, phone, address, loyalty_points, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, 0, true)
      RETURNING *
    `;
    const result = await db.query(query, [
      id,
      customer.firstName,
      customer.lastName,
      customer.email,
      customer.phone,
      customer.address
    ]);
    return this.mapCustomerFromDb(result.rows[0]);
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const query = 'SELECT * FROM customers WHERE id = $1 AND is_active = true';
    const result = await db.query(query, [id]);
    return result.rows.length > 0 ? this.mapCustomerFromDb(result.rows[0]) : null;
  }

  async getCustomerByEmail(email: string): Promise<Customer | null> {
    const query = 'SELECT * FROM customers WHERE email = $1 AND is_active = true';
    const result = await db.query(query, [email]);
    return result.rows.length > 0 ? this.mapCustomerFromDb(result.rows[0]) : null;
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | null> {
    const fields = Object.keys(updates).map((key, idx) => `${this.snakeCase(key)} = $${idx + 2}`).join(', ');
    const query = `
      UPDATE customers
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const values = [id, ...Object.values(updates)];
    const result = await db.query(query, values);
    return result.rows.length > 0 ? this.mapCustomerFromDb(result.rows[0]) : null;
  }

  async addPurchaseHistory(history: Omit<PurchaseHistory, 'id' | 'createdAt'>): Promise<PurchaseHistory> {
    const id = uuidv4();
    const query = `
      INSERT INTO customer_purchase_history (id, customer_id, transaction_id, purchase_date, amount, currency, items)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await db.query(query, [
      id,
      history.customerId,
      history.transactionId,
      history.purchaseDate,
      history.amount,
      history.currency,
      JSON.stringify(history.items)
    ]);
    return this.mapPurchaseHistoryFromDb(result.rows[0]);
  }

  async getPurchaseHistory(customerId: string, limit: number = 50): Promise<PurchaseHistory[]> {
    const query = `
      SELECT * FROM customer_purchase_history
      WHERE customer_id = $1
      ORDER BY purchase_date DESC
      LIMIT $2
    `;
    const result = await db.query(query, [customerId, limit]);
    return result.rows.map(row => this.mapPurchaseHistoryFromDb(row));
  }

  async getLoyaltyPrograms(): Promise<LoyaltyProgram[]> {
    const query = 'SELECT * FROM loyalty_programs WHERE active = true ORDER BY name ASC';
    const result = await db.query(query);
    return result.rows.map(row => this.mapLoyaltyProgramFromDb(row));
  }

  async getCustomerLoyalty(customerId: string): Promise<CustomerLoyalty[]> {
    const query = 'SELECT * FROM customer_loyalty WHERE customer_id = $1';
    const result = await db.query(query, [customerId]);
    return result.rows.map(row => this.mapCustomerLoyaltyFromDb(row));
  }

  async updateCustomerLoyaltyPoints(customerId: string, programId: string, pointsEarned: number, pointsRedeemed: number): Promise<boolean> {
    const query = `
      UPDATE customer_loyalty
      SET points_earned = points_earned + $1,
          points_redeemed = points_redeemed + $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE customer_id = $3 AND loyalty_program_id = $4
    `;
    const result = await db.query(query, [pointsEarned, pointsRedeemed, customerId, programId]);
    return result.rowCount > 0;
  }

  // Helper methods
  private mapCustomerFromDb(row: unknown): Customer {
    const r = row as any;
    return {
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      address: r.address,
      loyaltyPoints: r.loyalty_points,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapPurchaseHistoryFromDb(row: unknown): PurchaseHistory {
    const r = row as any;
    return {
      id: r.id,
      customerId: r.customer_id,
      transactionId: r.transaction_id,
      purchaseDate: r.purchase_date,
      amount: parseFloat(r.amount),
      currency: r.currency,
      items: r.items,
      createdAt: r.created_at
    };
  }

  private mapLoyaltyProgramFromDb(row: unknown): LoyaltyProgram {
    const r = row as any;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      pointsPerDollar: parseFloat(r.points_per_dollar),
      active: r.active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  private mapCustomerLoyaltyFromDb(row: any): CustomerLoyalty {
    return {
      id: row.id,
      customerId: row.customer_id,
      loyaltyProgramId: row.loyalty_program_id,
      pointsEarned: row.points_earned,
      pointsRedeemed: row.points_redeemed,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private snakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }
}

export const customerRepository = new CustomerRepository();
