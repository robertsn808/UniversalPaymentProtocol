#!/bin/bash

# Captain Cashout Casino Setup Script
echo "🏴‍☠️ Setting up Captain Cashout Casino..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "artisan" ]; then
    print_error "Laravel artisan file not found. Please ensure you're in the casino root directory."
    exit 1
fi

print_status "Checking system requirements..."

# Check PHP version
PHP_VERSION=$(php -v | head -n 1 | cut -d " " -f 2 | cut -d "." -f 1,2)
if [ "$(printf '%s\n' "8.2" "$PHP_VERSION" | sort -V | head -n1)" = "8.2" ]; then
    print_success "PHP $PHP_VERSION detected"
else
    print_error "PHP 8.2+ required, found $PHP_VERSION"
    exit 1
fi

# Check Composer
if ! command -v composer &> /dev/null; then
    print_error "Composer not found. Please install Composer."
    exit 1
fi
print_success "Composer found"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 16+."
    exit 1
fi
NODE_VERSION=$(node -v | cut -d "." -f 1 | sed 's/v//')
if [ "$NODE_VERSION" -ge 16 ]; then
    print_success "Node.js $(node -v) detected"
else
    print_error "Node.js 16+ required"
    exit 1
fi

print_status "Installing PHP dependencies..."
composer install --optimize-autoloader --ignore-platform-req=ext-curl --ignore-platform-req=ext-dom

print_status "Generating application key..."
php artisan key:generate

print_status "Creating storage symlink..."
php artisan storage:link

print_status "Setting up database..."
print_warning "Make sure to create the 'captain_cashout' database and user first!"
print_warning "Run: CREATE DATABASE captain_cashout; GRANT ALL ON captain_cashout.* TO 'captain_cashout_user'@'localhost' IDENTIFIED BY 'CaptainCashout2024!';"

read -p "Press Enter once database is created..."

# Import database schema
if [ -f "../v105.sql" ]; then
    print_status "Importing database schema..."
    mysql -u captain_cashout_user -pCaptainCashout2024! captain_cashout < ../v105.sql
    print_success "Database schema imported"
else
    print_warning "Database SQL file not found. You may need to run migrations manually."
    php artisan migrate --force
fi

print_status "Setting up WebSocket services..."
cd PTWebSocket

# Install Node dependencies
if [ -f "package.json" ]; then
    npm install
    print_success "Node dependencies installed"
fi

# Create SSL directory
mkdir -p ssl
print_warning "Please place your SSL certificates in PTWebSocket/ssl/:"
print_warning "- crt.crt (certificate file)"
print_warning "- key.key (private key file)" 
print_warning "- intermediate.pem (intermediate certificate)"

cd ..

print_status "Caching configuration for production..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

print_status "Setting permissions..."
chmod -R 755 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

print_success "🏴‍☠️ Captain Cashout setup complete!"
print_status "Next steps:"
echo "1. Configure your web server (Nginx/Apache) to point to the public/ directory"
echo "2. Set up SSL certificates in PTWebSocket/ssl/"
echo "3. Start WebSocket services with: pm2 start ecosystem.config.js"
echo "4. Download game packs from Discord and install them"
echo "5. Configure branding in resources/lang/en/app.php"
echo "6. Update slider images in /woocasino/ directory"
echo ""
print_warning "Don't forget to change APP_ENV=production and APP_DEBUG=false before going live!"