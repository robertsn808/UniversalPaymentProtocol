# 🏴‍☠️ Captain Cashout Casino Setup Guide

## Prerequisites

- **PHP 8.2+** with extensions: BCMath, Ctype, Fileinfo, JSON, Mbstring, OpenSSL, PDO, Tokenizer, XML
- **MySQL 8.0+** or **MariaDB 10.3+**
- **Node.js 16+** with NPM
- **Composer** (PHP dependency manager)
- **Redis** (for caching and sessions)
- **PM2** (for WebSocket service management)
- **Nginx** or **Apache** web server
- **SSL Certificate** (for production)

## Step 1: Get the Casino Codebase

1. Download/clone the Laravel casino application
2. Extract to `/var/www/captain-cashout/` (or your preferred directory)
3. Copy the files from this directory into the casino root

## Step 2: Database Setup

```bash
# Run as MySQL root user
mysql -u root -p < setup-database.sql
```

## Step 3: Environment Configuration

The `.env` file is already configured for Captain Cashout. Update the following if needed:

```bash
# Edit domain and database credentials if different
nano .env
```

## Step 4: Laravel Application Setup

```bash
# Make setup script executable and run it
chmod +x setup-captain-cashout.sh
./setup-captain-cashout.sh
```

This script will:
- Install PHP dependencies
- Generate application key
- Create storage symlinks
- Import database schema
- Set up WebSocket services
- Cache configurations

## Step 5: WebSocket Services

```bash
# Install PM2 globally if not installed
npm install -g pm2

# Start WebSocket services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup
```

## Step 6: Web Server Configuration

### For Nginx:
```bash
# Copy the configuration file
sudo cp nginx-captain-cashout.conf /etc/nginx/sites-available/captaincashout.local
sudo ln -s /etc/nginx/sites-available/captaincashout.local /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### For Apache:
Create a virtual host configuration similar to the Nginx setup.

## Step 7: SSL Certificate Setup

### Development (Self-signed):
```bash
# Create SSL directory
mkdir -p PTWebSocket/ssl

# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout PTWebSocket/ssl/key.key -out PTWebSocket/ssl/crt.crt -days 365 -nodes -subj "/C=US/ST=State/L=City/O=CaptainCashout/CN=captaincashout.local"

# Create intermediate file (empty for self-signed)
touch PTWebSocket/ssl/intermediate.pem
```

### Production:
Place your SSL certificates in the following locations:
- `PTWebSocket/ssl/crt.crt` - SSL Certificate
- `PTWebSocket/ssl/key.key` - Private Key
- `PTWebSocket/ssl/intermediate.pem` - Intermediate Certificate

## Step 8: Branding Customization

The `captain-cashout-branding.json` file contains all branding configurations. To apply:

1. **Language Files**: Update `resources/lang/en/app.php` with Captain Cashout text
2. **Images**: Replace slider images in `/woocasino/` directory
3. **Logo**: Update logo files in `public/images/`
4. **Colors**: Modify CSS variables in your theme files
5. **Favicon**: Replace `public/favicon.ico`

## Step 9: Game Packs Installation

1. Download game packs from the Discord server
2. Extract to the games directory (usually `public/games/`)
3. Run any migration scripts included with the packs

## Step 10: Final Steps

```bash
# Set proper permissions
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 755 storage bootstrap/cache

# For production, optimize and secure
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Update environment for production
# Change in .env:
# APP_ENV=production
# APP_DEBUG=false
```

## Security Checklist

- [ ] Changed default admin passwords
- [ ] Updated database credentials
- [ ] Configured proper file permissions
- [ ] Set up SSL certificates
- [ ] Configured firewall rules
- [ ] Set up regular backups
- [ ] Enabled error logging
- [ ] Configured rate limiting

## Troubleshooting

### WebSocket Connection Issues:
- Check firewall ports (22154, 22188, 22197)
- Verify SSL certificates
- Check PM2 service status: `pm2 status`

### Database Connection Issues:
- Verify credentials in `.env`
- Check MySQL service status
- Ensure database exists

### Permission Issues:
```bash
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 755 storage bootstrap/cache
```

### Clear All Caches:
```bash
php artisan cache:clear
php artisan view:clear
php artisan config:clear
php artisan route:clear
```

## Support

For support, check:
1. Laravel logs in `storage/logs/`
2. WebSocket service logs: `pm2 logs`
3. Nginx/Apache error logs
4. MySQL error logs

## Captain Cashout Features

- **Pirate Theme**: Maritime casino experience
- **Multi-currency Support**: USD, EUR, BTC ready
- **Real-time Gaming**: WebSocket-powered live games
- **Mobile Responsive**: Works on all devices
- **Secure Payments**: Encrypted transactions
- **Multi-language**: Ready for localization

---

**🏴‍☠️ Welcome aboard Captain Cashout! May your sails be full and your coffers overflow!**