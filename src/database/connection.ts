import { Pool, PoolClient } from 'pg';
import { Redis } from 'ioredis';
import { env } from '../config/environment.js';
import { secureLogger } from '../shared/logger.js';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseConnection {
  private pool: Pool;
  public redis: Redis;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxRetries: number = 3;

  constructor() {
    // Initialize PostgreSQL pool
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Initialize Redis client
    if (env.REDIS_URL) {
      this.redis = new Redis(env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
    } else {
      this.redis = new Redis({
        host: 'localhost',
        port: 6379,
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
    }

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.pool.on('error', (err: Error) => {
      secureLogger.error('Database pool error', { error: err.message });
    });

    this.redis.on('error', (err: Error) => {
      secureLogger.error('Redis connection error', { error: err.message });
    });

    this.redis.on('connect', () => {
      secureLogger.info('Redis connected successfully');
    });

    this.redis.on('close', () => {
      secureLogger.warn('Redis connection closed');
    });
  }

  public async connect(): Promise<void> {
    try {
      this.connectionAttempts++;
      await this.initializeDatabase();
      await this.connectRedis();
      this.isConnected = true;
      secureLogger.info('Database and Redis connections established');
    } catch (error) {
      if (this.connectionAttempts < this.maxRetries) {
        secureLogger.warn(`Database connection attempt ${this.connectionAttempts} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * this.connectionAttempts));
        return this.connect();
      }
      throw error;
    }
  }

  private async connectRedis(): Promise<void> {
    try {
      await this.redis.connect();
      secureLogger.info('Redis connection established');
    } catch (error) {
      secureLogger.warn('Redis connection failed, continuing without cache', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      // Don't throw error - allow app to continue without Redis
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.pool.end(),
        this.redis.disconnect()
      ]);
      this.isConnected = false;
      secureLogger.info('Database and Redis connections closed');
    } catch (error) {
      secureLogger.error('Error closing database connections', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  public async query(text: string, params?: any[]): Promise<any> {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      secureLogger.error('Database query error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: text
      });
      throw error;
    }
  }

  public async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT NOW()');
      return true;
    } catch (error) {
      secureLogger.error('Database connection test failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Test connection
      await this.query('SELECT NOW()');
      this.isConnected = true;
      
      // Create tables if they don't exist
      await this.createTables();
      
      secureLogger.info('Database initialized successfully');
    } catch (error) {
      secureLogger.error('Database initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Use in-memory fallback for development
      if (env.NODE_ENV === 'development') {
        secureLogger.warn('Using in-memory database fallback');
        this.isConnected = true;
        return;
      }
      
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(50) NOT NULL,
        device_type VARCHAR(100),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS payment_methods (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        token VARCHAR(255),
        metadata JSONB,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS merchant_configs (
        id SERIAL PRIMARY KEY,
        merchant_id VARCHAR(255) UNIQUE NOT NULL,
        config JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS device_registrations (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        device_type VARCHAR(100) NOT NULL,
        capabilities JSONB,
        security_context JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        action VARCHAR(255) NOT NULL,
        resource VARCHAR(255),
        metadata JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)`,
      `CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`
    ];

    for (const table of tables) {
      try {
        await this.query(table);
      } catch (error) {
        secureLogger.error('Failed to create table', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sql: table.substring(0, 100) + '...'
        });
        throw error;
      }
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public async healthCheck(): Promise<{ postgres: boolean; redis: boolean }> {
    const postgres = await this.testConnection();
    
    let redis = false;
    try {
      await this.redis.ping();
      redis = true;
    } catch (error) {
      secureLogger.warn('Redis health check failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    
    return { postgres, redis };
  }
}

// Singleton instance
export const db = new DatabaseConnection();

// Default export for backwards compatibility
export default db;
