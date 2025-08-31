#!/bin/bash

echo "🏴‍☠️ Starting MySQL for Captain Cashout..."

# Start MySQL service
echo "Starting MySQL/MariaDB service..."
systemctl start mysql 2>/dev/null || systemctl start mariadb 2>/dev/null || {
    echo "❌ Failed to start MySQL service"
    echo "📝 Please run manually as root:"
    echo "   systemctl start mysql"
    echo "   systemctl start mariadb" 
    exit 1
}

echo "✅ MySQL service started"

# Enable auto-start
systemctl enable mysql 2>/dev/null || systemctl enable mariadb 2>/dev/null

# Check if running
if systemctl is-active --quiet mysql 2>/dev/null || systemctl is-active --quiet mariadb 2>/dev/null; then
    echo "✅ MySQL is now running"
    
    # Test connection
    if mysql -u root -e "SELECT 1;" 2>/dev/null; then
        echo "✅ MySQL root connection successful"
        
        # Create Captain Cashout database
        echo "Creating Captain Cashout database..."
        mysql -u root -p < casino/setup-database.sql
        
        echo "Importing casino schema (this may take a few minutes)..."
        mysql -u captain_cashout_user -pCaptainCashout2024! captain_cashout < v105.sql
        
        echo "🏴‍☠️ Captain Cashout database setup complete!"
        echo "🚢 Your casino is ready to sail!"
        
    else
        echo "⚠️  MySQL is running but needs root password setup"
        echo "📝 Run: mysql_secure_installation"
    fi
else
    echo "❌ MySQL failed to start"
    echo "📝 Check with: systemctl status mysql"
fi