-- Captain Cashout Casino Database Setup for PostgreSQL
-- This script converts the MySQL v105.sql schema to PostgreSQL format
-- Compatible with Render PostgreSQL databases

-- =============================================================================
-- CASINO PLATFORM CORE TABLES
-- =============================================================================

-- API Management
CREATE TABLE IF NOT EXISTS w_apis (
    id SERIAL PRIMARY KEY,
    keygen VARCHAR(255) NOT NULL,
    ip VARCHAR(55),
    shop_id INTEGER NOT NULL,
    status INTEGER DEFAULT 0 CHECK (status IN (0, 1, 2))
);

CREATE TABLE IF NOT EXISTS w_api_tokens (
    id VARCHAR(40) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Articles/Content Management
CREATE TABLE IF NOT EXISTS w_articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    keywords VARCHAR(255),
    description VARCHAR(255),
    text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ATM/Banking System
CREATE TABLE IF NOT EXISTS w_atm (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER NOT NULL,
    atm_name VARCHAR(255) NOT NULL,
    atm_in DECIMAL(15,2) DEFAULT 0,
    atm_out DECIMAL(15,2) DEFAULT 0,
    atm_recycle DECIMAL(15,2) DEFAULT 0,
    atm_rec_5 DECIMAL(15,2) DEFAULT 0,
    atm_rec_10 DECIMAL(15,2) DEFAULT 0,
    atm_rec_20 DECIMAL(15,2) DEFAULT 0,
    atm_rec_50 DECIMAL(15,2) DEFAULT 0,
    atm_rec_100 DECIMAL(15,2) DEFAULT 0,
    atm_rec_200 DECIMAL(15,2) DEFAULT 0,
    api_key_id INTEGER NOT NULL,
    atm_status VARCHAR(10) DEFAULT 'active' CHECK (atm_status IN ('active', 'inactive'))
);

-- Bonus System
CREATE TABLE IF NOT EXISTS w_bonus_presets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    deposit_from DECIMAL(15,2) DEFAULT 0,
    deposit_to DECIMAL(15,2) DEFAULT 0,
    bonus DECIMAL(15,2) DEFAULT 0,
    bonus_type VARCHAR(20) DEFAULT 'percent' CHECK (bonus_type IN ('percent', 'fixed')),
    wager INTEGER DEFAULT 0,
    status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories
CREATE TABLE IF NOT EXISTS w_categories (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    href VARCHAR(255),
    src VARCHAR(255),
    alt VARCHAR(255),
    shop_id INTEGER DEFAULT 0,
    order_id INTEGER DEFAULT 0,
    parent INTEGER DEFAULT 0,
    view VARCHAR(20) DEFAULT 'all' CHECK (view IN ('all', 'desktop', 'mobile')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users (enhanced version compatible with Laravel and UPP)
CREATE TABLE IF NOT EXISTS w_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified_at TIMESTAMP,
    password VARCHAR(255) NOT NULL,
    remember_token VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Casino-specific fields
    balance DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned')),
    role VARCHAR(50) DEFAULT 'user',
    shop_id INTEGER DEFAULT 1,
    count_balance DECIMAL(15,2) DEFAULT 0,
    count_in DECIMAL(15,2) DEFAULT 0,
    count_out DECIMAL(15,2) DEFAULT 0,
    
    -- Profile information
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50),
    birthday DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    
    -- Referral system
    ref_id INTEGER,
    ref_percent DECIMAL(5,2) DEFAULT 0,
    
    -- Gaming settings
    currency VARCHAR(3) DEFAULT 'USD',
    language VARCHAR(5) DEFAULT 'en',
    timezone VARCHAR(50),
    
    -- Security
    last_login_at TIMESTAMP,
    last_ip VARCHAR(45),
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP
);

-- Games
CREATE TABLE IF NOT EXISTS w_games (
    id SERIAL PRIMARY KEY,
    game_code VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    provider VARCHAR(100),
    category_id INTEGER,
    image VARCHAR(500),
    device VARCHAR(20) DEFAULT 'all' CHECK (device IN ('all', 'desktop', 'mobile')),
    view VARCHAR(20) DEFAULT 'all' CHECK (view IN ('all', 'demo', 'real')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    popular BOOLEAN DEFAULT FALSE,
    new BOOLEAN DEFAULT FALSE,
    rtp DECIMAL(5,2) DEFAULT 95.00,
    volatility VARCHAR(10) DEFAULT 'medium' CHECK (volatility IN ('low', 'medium', 'high')),
    min_bet DECIMAL(10,2) DEFAULT 0.01,
    max_bet DECIMAL(10,2) DEFAULT 100.00,
    shop_id INTEGER DEFAULT 1,
    order_id INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game Sessions
CREATE TABLE IF NOT EXISTS w_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER,
    game_code VARCHAR(255),
    balance DECIMAL(15,2) DEFAULT 0,
    total_win DECIMAL(15,2) DEFAULT 0,
    total_bet DECIMAL(15,2) DEFAULT 0,
    profit DECIMAL(15,2) DEFAULT 0,
    date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(45),
    slot TEXT, -- JSON data for slot state
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired'))
);

-- Transactions
CREATE TABLE IF NOT EXISTS w_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    balance_before DECIMAL(15,2) DEFAULT 0,
    balance_after DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    reference_id VARCHAR(255),
    shop_id INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments Integration (connecting to UPP system)
CREATE TABLE IF NOT EXISTS w_payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    transaction_id VARCHAR(255), -- Links to UPP transactions
    payment_method VARCHAR(100),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    stripe_payment_intent_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tournaments
CREATE TABLE IF NOT EXISTS w_tournaments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    game_code VARCHAR(255),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    entry_fee DECIMAL(15,2) DEFAULT 0,
    prize_pool DECIMAL(15,2) DEFAULT 0,
    max_participants INTEGER DEFAULT 100,
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tournament Participants
CREATE TABLE IF NOT EXISTS w_tournament_participants (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    score DECIMAL(15,2) DEFAULT 0,
    rank INTEGER DEFAULT 0,
    prize_amount DECIMAL(15,2) DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, user_id)
);

-- Settings/Configuration
CREATE TABLE IF NOT EXISTS w_settings (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER DEFAULT 1,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    category VARCHAR(100) DEFAULT 'general',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, key)
);

-- Audit Logs (extends UPP audit system)
CREATE TABLE IF NOT EXISTS w_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id VARCHAR(255),
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON w_users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON w_users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON w_users(status);
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON w_users(shop_id);

-- Game indexes
CREATE INDEX IF NOT EXISTS idx_games_category ON w_games(category_id);
CREATE INDEX IF NOT EXISTS idx_games_provider ON w_games(provider);
CREATE INDEX IF NOT EXISTS idx_games_status ON w_games(status);
CREATE INDEX IF NOT EXISTS idx_games_popular ON w_games(popular);

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON w_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_game_code ON w_sessions(game_code);
CREATE INDEX IF NOT EXISTS idx_sessions_date_time ON w_sessions(date_time);

-- Transaction indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON w_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON w_transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON w_transactions(created_at);

-- Payment indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON w_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON w_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON w_payments(status);

-- =============================================================================
-- DEFAULT DATA AND CONFIGURATION
-- =============================================================================

-- Insert default settings
INSERT INTO w_settings (key, value, category, description) VALUES
('casino_name', 'Captain Cashout Casino', 'general', 'Casino display name'),
('casino_currency', 'USD', 'general', 'Default casino currency'),
('min_deposit', '10.00', 'payments', 'Minimum deposit amount'),
('max_deposit', '10000.00', 'payments', 'Maximum deposit amount'),
('min_withdrawal', '20.00', 'payments', 'Minimum withdrawal amount'),
('max_withdrawal', '5000.00', 'payments', 'Maximum withdrawal amount'),
('demo_mode', 'false', 'general', 'Enable demo mode for all games'),
('maintenance_mode', 'false', 'general', 'Enable maintenance mode'),
('registration_enabled', 'true', 'users', 'Allow new user registrations'),
('email_verification', 'true', 'users', 'Require email verification'),
('kyc_required', 'false', 'compliance', 'Require KYC verification'),
('session_timeout', '3600', 'security', 'Session timeout in seconds')
ON CONFLICT (shop_id, key) DO NOTHING;

-- Insert default game categories
INSERT INTO w_categories (title, href, src, alt, order_id) VALUES
('Slots', '/games/slots', '/images/categories/slots.png', 'Slot Games', 1),
('Table Games', '/games/table', '/images/categories/table.png', 'Table Games', 2),
('Live Casino', '/games/live', '/images/categories/live.png', 'Live Casino', 3),
('Poker', '/games/poker', '/images/categories/poker.png', 'Poker Games', 4),
('Arcade', '/games/arcade', '/images/categories/arcade.png', 'Arcade Games', 5),
('Fish Hunter', '/games/fish', '/images/categories/fish.png', 'Fish Hunter', 6)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Add foreign key constraints (after data insertion)
-- ALTER TABLE w_games ADD CONSTRAINT fk_games_category FOREIGN KEY (category_id) REFERENCES w_categories(id);
-- ALTER TABLE w_sessions ADD CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES w_users(id);
-- ALTER TABLE w_transactions ADD CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES w_users(id);
-- ALTER TABLE w_payments ADD CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES w_users(id);

-- =============================================================================
-- SECURITY AND PERMISSIONS
-- =============================================================================

-- Grant permissions to application user (adjust username as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

COMMENT ON TABLE w_users IS 'Casino users with gaming profiles and balances';
COMMENT ON TABLE w_games IS 'Game catalog with provider information and settings';
COMMENT ON TABLE w_sessions IS 'Active gaming sessions with state management';
COMMENT ON TABLE w_transactions IS 'Financial transaction history';
COMMENT ON TABLE w_payments IS 'Payment processing records linked to UPP system';

-- Success message
SELECT 'Captain Cashout Casino database schema created successfully for PostgreSQL!' as status;