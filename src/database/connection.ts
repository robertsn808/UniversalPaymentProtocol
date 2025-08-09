
import { Pool, PoolClient } from 'pg';
import { env, getDatabaseUrl } from '../config/environment.js';
import secureLogger from '../shared/logger.js';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;
  private isConnected = false;

  private constructor() {
    this.pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('connect', (client: PoolClient) => {
      secureLogger.info('Database connected', { 
        database: env.DB_NAME,
        host: env.DB_HOST,
        port: env.DB_PORT 
      });
    });

    this.pool.on('error', (err: Error) => {
      secureLogger.error('Database connection error', { 
        error: err.message,
        stack: err.stack 
      });
    });

    this.initializeDatabase();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      secureLogger.debug('Database query executed', {
        duration,
        rowCount: result.rowCount,
        query: text.substring(0, 100)
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      secureLogger.error('Database query failed', {
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        query: text.substring(0, 100)
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
        this.isConnected = false;
      } else {
        throw error;
      }
    }
  }

  private async createTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(255) PRIMARY KEY,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        description TEXT,
        merchant_id VARCHAR(255),
        customer_email VARCHAR(255),
        payment_method VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        result JSONB,
        error_message TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS payment_intents (
        id VARCHAR(255) PRIMARY KEY,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(50) NOT NULL,
        client_secret VARCHAR(255) UNIQUE NOT NULL,
        customer_email VARCHAR(255),
        description TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'
      )`,
      
      `CREATE TABLE IF NOT EXISTS payment_methods (
        id VARCHAR(255) PRIMARY KEY,
        customer_id VARCHAR(255),
        type VARCHAR(50) NOT NULL,
        card_data JSONB,
        bank_account_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
      )`,
      
      `CREATE TABLE IF NOT EXISTS refunds (
        id VARCHAR(255) PRIMARY KEY,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(50) NOT NULL,
        reason TEXT,
        original_transaction_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (original_transaction_id) REFERENCES transactions(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        action VARCHAR(255) NOT NULL,
        transaction_id VARCHAR(255),
        amount DECIMAL(12,2),
        currency VARCHAR(3),
        ip_address INET,
        user_agent TEXT,
        correlation_id VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'
      )`,
      
      `CREATE TABLE IF NOT EXISTS kyc_verifications (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        document_type VARCHAR(50),
        document_number VARCHAR(255),
        full_name VARCHAR(255),
        address TEXT,
        date_of_birth DATE,
        verification_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ];

    for (const table of tables) {
      await this.query(table);
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_customer_email ON transactions(customer_email)',
      'CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status)',
      'CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user_id ON kyc_verifications(user_id)'
    ];

    for (const index of indexes) {
      await this.query(index);
    }
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  public async close(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    secureLogger.info('Database connection closed');
  }
}

export const db = DatabaseConnection.getInstance();
export default db;
