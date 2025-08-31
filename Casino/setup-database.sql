-- Captain Cashout Database Setup
-- Run this script as MySQL root user

-- Create database
CREATE DATABASE IF NOT EXISTS captain_cashout CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user and grant privileges
CREATE USER IF NOT EXISTS 'captain_cashout_user'@'localhost' IDENTIFIED BY 'CaptainCashout2024!';
GRANT ALL PRIVILEGES ON captain_cashout.* TO 'captain_cashout_user'@'localhost';

-- Grant privileges for remote access (if needed)
CREATE USER IF NOT EXISTS 'captain_cashout_user'@'%' IDENTIFIED BY 'CaptainCashout2024!';
GRANT ALL PRIVILEGES ON captain_cashout.* TO 'captain_cashout_user'@'%';

-- Flush privileges
FLUSH PRIVILEGES;

-- Use the new database
USE captain_cashout;

-- Show confirmation
SELECT 'Captain Cashout database created successfully!' as Status;