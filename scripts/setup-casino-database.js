#!/usr/bin/env node

/**
 * Captain Cashout Casino Database Setup Script
 * Initializes the casino database schema in the existing UPP PostgreSQL database
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));

async function setupCasinoDatabase() {
  console.log('🎰 Setting up Captain Cashout Casino database...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Read the casino database schema
    // Note: When running from a compiled build (dist/), __dirname points to dist/scripts.
    // Use process.cwd() so this resolves from the project root in both dev and prod.
    const candidates = [
      // project root during runtime (Render starts app from project root)
      join(process.cwd(), 'Casino/casino-database-setup.sql'),
      // fallback: relative to source layout when not compiled
      join(__dirname, '../Casino/casino-database-setup.sql'),
      // fallback: two levels up from dist/scripts -> project root
      join(__dirname, '../../Casino/casino-database-setup.sql'),
    ];

    let schema;
    let schemaPath;
    for (const p of candidates) {
      try {
        schema = readFileSync(p, 'utf8');
        schemaPath = p;
        break;
      } catch (_) {
        // try next
      }
    }
    if (!schema) {
      throw new Error(
        `ENOENT: casino schema not found. Tried: \n- ${candidates.join('\n- ')}`
      );
    }
    console.log(`📄 Using casino schema file: ${schemaPath}`);

    console.log('📝 Executing casino database schema...');
    
    // Split the schema into individual statements and execute them
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        await client.query(statement + ';');
        successCount++;
        
        // Log table creation
        if (statement.toLowerCase().includes('create table')) {
          const tableMatch = statement.match(/create table\s+(?:if not exists\s+)?(\w+)/i);
          if (tableMatch) {
            console.log(`  ✓ Created table: ${tableMatch[1]}`);
          }
        }
        
        // Log index creation
        if (statement.toLowerCase().includes('create index')) {
          const indexMatch = statement.match(/create index\s+(?:if not exists\s+)?(\w+)/i);
          if (indexMatch) {
            console.log(`  ✓ Created index: ${indexMatch[1]}`);
          }
        }
        
      } catch (error) {
        // Skip duplicate errors (tables already exist)
        if (error.code === '42P07' || error.message.includes('already exists')) {
          console.log(`  ⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
        } else {
          console.error(`  ❌ Error executing statement: ${error.message}`);
          errorCount++;
        }
      }
    }

    // Insert default casino data
    console.log('🎯 Setting up default casino data...');
    
    // Check if default admin user exists, create if not
    const adminCheck = await client.query(`
      SELECT id FROM w_users WHERE email = 'admin@captaincashout.com'
    `);
    
    if (adminCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO w_users (
          username, email, password, role, balance, status, 
          first_name, last_name, currency
        ) VALUES (
          'admin', 'admin@captaincashout.com', 
          '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
          'admin', 10000.00, 'active',
          'Casino', 'Administrator', 'USD'
        )
      `);
      console.log('  ✓ Created default admin user');
    }

    // Check database status
    const tableCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'w_%'
    `);

    console.log('\n🎰 Casino Database Setup Complete!');
    console.log(`✅ Successfully executed ${successCount} statements`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} errors (likely duplicate tables)`);
    }
    console.log(`🗃️  Casino tables in database: ${tableCount.rows[0].count}`);
    
    console.log('\n📋 Casino Database Summary:');
    console.log('  • User management with gaming profiles');
    console.log('  • Game catalog and session management');
    console.log('  • Financial transactions and payments');
    console.log('  • Tournament and bonus systems');
    console.log('  • Audit logging and security');
    console.log('  • Integration with UPP payment system');
    
    console.log('\n🔗 Next steps:');
    console.log('  1. Casino platform available at /captain-cashout/platform');
    console.log('  2. Admin login: admin@captaincashout.com');
    console.log('  3. Default password: password (change immediately!)');
    console.log('  4. Database ready for Laravel migrations');
    
  } catch (error) {
    console.error('❌ Casino database setup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupCasinoDatabase().catch(console.error);
}

export { setupCasinoDatabase };
