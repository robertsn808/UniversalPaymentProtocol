#!/bin/bash

# SSL Certificate Setup Script for Universal Payment Protocol
# Supports self-signed, Let's Encrypt, and custom certificates

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${1:-"localhost"}
EMAIL=${2:-"admin@${DOMAIN}"}
CERT_TYPE=${3:-"letsencrypt"} # Options: self-signed, letsencrypt, custom
CERT_DIR="/etc/ssl/upp"

echo -e "${BLUE}🔒 SSL Certificate Setup for Universal Payment Protocol${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo "Certificate Type: $CERT_TYPE"
echo "Certificate Directory: $CERT_DIR"
echo ""

# Check if running as root for system-wide installation
check_permissions() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}⚠️ Not running as root. Some operations may require sudo.${NC}"
        SUDO="sudo"
    else
        echo -e "${GREEN}✅ Running as root${NC}"
        SUDO=""
    fi
}

# Create certificate directory
setup_directories() {
    echo -e "${YELLOW}📁 Setting up certificate directories...${NC}"
    
    $SUDO mkdir -p $CERT_DIR
    $SUDO chmod 755 $CERT_DIR
    
    echo -e "${GREEN}✅ Certificate directory created${NC}"
}

# Generate self-signed certificate
generate_self_signed() {
    echo -e "${YELLOW}🔐 Generating self-signed certificate...${NC}"
    
    # Create private key
    $SUDO openssl genrsa -out $CERT_DIR/private.key 2048
    
    # Create certificate signing request
    $SUDO openssl req -new -key $CERT_DIR/private.key -out $CERT_DIR/cert.csr -subj "/C=US/ST=State/L=City/O=UPP/CN=$DOMAIN"
    
    # Generate self-signed certificate
    $SUDO openssl x509 -req -days 365 -in $CERT_DIR/cert.csr -signkey $CERT_DIR/private.key -out $CERT_DIR/certificate.crt
    
    # Set proper permissions
    $SUDO chmod 600 $CERT_DIR/private.key
    $SUDO chmod 644 $CERT_DIR/certificate.crt
    
    # Clean up CSR
    $SUDO rm $CERT_DIR/cert.csr
    
    echo -e "${GREEN}✅ Self-signed certificate generated${NC}"
    echo -e "${YELLOW}⚠️ Warning: Self-signed certificates are not trusted by browsers${NC}"
    echo -e "${YELLOW}   Use only for development and testing${NC}"
}

# Setup Let's Encrypt certificate
setup_letsencrypt() {
    echo -e "${YELLOW}🌐 Setting up Let's Encrypt certificate...${NC}"
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo -e "${YELLOW}📦 Installing certbot...${NC}"
        
        if command -v apt-get &> /dev/null; then
            $SUDO apt-get update
            $SUDO apt-get install -y certbot
        elif command -v yum &> /dev/null; then
            $SUDO yum install -y certbot
        elif command -v brew &> /dev/null; then
            brew install certbot
        else
            echo -e "${RED}❌ Unable to install certbot automatically${NC}"
            echo "Please install certbot manually and run this script again"
            exit 1
        fi
    fi
    
    # Stop any running web server temporarily
    if pgrep -f "node.*server" > /dev/null; then
        echo -e "${YELLOW}⏸️ Stopping UPP server temporarily...${NC}"
        pkill -f "node.*server" || true
        RESTART_SERVER=true
    fi
    
    # Generate certificate
    echo -e "${YELLOW}🔑 Generating Let's Encrypt certificate...${NC}"
    $SUDO certbot certonly --standalone -d $DOMAIN --email $EMAIL --agree-tos --non-interactive
    
    if [ $? -eq 0 ]; then
        # Copy certificates to our directory
        $SUDO cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $CERT_DIR/certificate.crt
        $SUDO cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $CERT_DIR/private.key
        
        # Set proper permissions
        $SUDO chmod 600 $CERT_DIR/private.key
        $SUDO chmod 644 $CERT_DIR/certificate.crt
        
        echo -e "${GREEN}✅ Let's Encrypt certificate generated successfully${NC}"
        
        # Setup auto-renewal
        setup_auto_renewal
        
    else
        echo -e "${RED}❌ Failed to generate Let's Encrypt certificate${NC}"
        echo "Please check domain DNS settings and try again"
        exit 1
    fi
    
    # Restart server if it was running
    if [ "$RESTART_SERVER" = true ]; then
        echo -e "${YELLOW}🔄 Restarting UPP server...${NC}"
        # You would add your server start command here
        # npm start &
    fi
}

# Setup auto-renewal for Let's Encrypt
setup_auto_renewal() {
    echo -e "${YELLOW}🔄 Setting up automatic certificate renewal...${NC}"
    
    # Create renewal script
    cat > /tmp/renew-upp-cert.sh << 'EOF'
#!/bin/bash
# UPP Certificate Renewal Script

# Renew certificate
certbot renew --quiet

# Copy renewed certificates
if [ -f /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem ]; then
    cp /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem /etc/ssl/upp/certificate.crt
    cp /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem /etc/ssl/upp/private.key
    chmod 600 /etc/ssl/upp/private.key
    chmod 644 /etc/ssl/upp/certificate.crt
    
    # Restart UPP server
    pkill -USR1 -f "node.*server" || systemctl reload upp || true
fi
EOF
    
    # Replace domain placeholder
    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /tmp/renew-upp-cert.sh
    
    # Install renewal script
    $SUDO mv /tmp/renew-upp-cert.sh /usr/local/bin/renew-upp-cert.sh
    $SUDO chmod +x /usr/local/bin/renew-upp-cert.sh
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/renew-upp-cert.sh") | $SUDO crontab -
    
    echo -e "${GREEN}✅ Auto-renewal configured${NC}"
    echo -e "${BLUE}📅 Certificates will be automatically renewed at 2 AM daily${NC}"
}

# Setup custom certificate
setup_custom() {
    echo -e "${YELLOW}📋 Setting up custom certificate...${NC}"
    
    echo "Please provide the paths to your certificate files:"
    read -p "Certificate file (.crt or .pem): " CERT_FILE
    read -p "Private key file (.key): " KEY_FILE
    read -p "CA bundle file (optional, press Enter to skip): " CA_FILE
    
    # Validate files exist
    if [ ! -f "$CERT_FILE" ]; then
        echo -e "${RED}❌ Certificate file not found: $CERT_FILE${NC}"
        exit 1
    fi
    
    if [ ! -f "$KEY_FILE" ]; then
        echo -e "${RED}❌ Private key file not found: $KEY_FILE${NC}"
        exit 1
    fi
    
    # Copy files
    $SUDO cp "$CERT_FILE" $CERT_DIR/certificate.crt
    $SUDO cp "$KEY_FILE" $CERT_DIR/private.key
    
    if [ -n "$CA_FILE" ] && [ -f "$CA_FILE" ]; then
        $SUDO cp "$CA_FILE" $CERT_DIR/ca-bundle.crt
    fi
    
    # Set proper permissions
    $SUDO chmod 600 $CERT_DIR/private.key
    $SUDO chmod 644 $CERT_DIR/certificate.crt
    
    echo -e "${GREEN}✅ Custom certificate installed${NC}"
}

# Validate certificate
validate_certificate() {
    echo -e "${YELLOW}🔍 Validating certificate...${NC}"
    
    # Check if certificate and key match
    CERT_HASH=$(openssl x509 -noout -modulus -in $CERT_DIR/certificate.crt | openssl md5)
    KEY_HASH=$(openssl rsa -noout -modulus -in $CERT_DIR/private.key | openssl md5)
    
    if [ "$CERT_HASH" = "$KEY_HASH" ]; then
        echo -e "${GREEN}✅ Certificate and private key match${NC}"
    else
        echo -e "${RED}❌ Certificate and private key do not match${NC}"
        exit 1
    fi
    
    # Check certificate expiry
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in $CERT_DIR/certificate.crt | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
    
    echo -e "${BLUE}📅 Certificate expires: $EXPIRY_DATE${NC}"
    echo -e "${BLUE}⏰ Days until expiry: $DAYS_UNTIL_EXPIRY${NC}"
    
    if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
        echo -e "${YELLOW}⚠️ Certificate expires in less than 30 days${NC}"
    fi
}

# Update environment configuration
update_environment() {
    echo -e "${YELLOW}⚙️ Updating environment configuration...${NC}"
    
    # Update .env file if it exists
    if [ -f ".env" ]; then
        # Remove existing SSL configuration
        sed -i '/^SSL_CERT_PATH/d' .env
        sed -i '/^SSL_KEY_PATH/d' .env
        sed -i '/^SSL_CA_PATH/d' .env
        sed -i '/^FORCE_HTTPS/d' .env
        
        # Add new SSL configuration
        echo "" >> .env
        echo "# SSL Configuration" >> .env
        echo "SSL_CERT_PATH=$CERT_DIR/certificate.crt" >> .env
        echo "SSL_KEY_PATH=$CERT_DIR/private.key" >> .env
        
        if [ -f "$CERT_DIR/ca-bundle.crt" ]; then
            echo "SSL_CA_PATH=$CERT_DIR/ca-bundle.crt" >> .env
        fi
        
        echo "FORCE_HTTPS=true" >> .env
        echo "TRUST_PROXY=true" >> .env
        
        echo -e "${GREEN}✅ Environment configuration updated${NC}"
    else
        echo -e "${YELLOW}⚠️ .env file not found, please configure SSL paths manually${NC}"
        echo "Add these to your environment:"
        echo "SSL_CERT_PATH=$CERT_DIR/certificate.crt"
        echo "SSL_KEY_PATH=$CERT_DIR/private.key"
        if [ -f "$CERT_DIR/ca-bundle.crt" ]; then
            echo "SSL_CA_PATH=$CERT_DIR/ca-bundle.crt"
        fi
        echo "FORCE_HTTPS=true"
        echo "TRUST_PROXY=true"
    fi
}

# Main execution
main() {
    check_permissions
    setup_directories
    
    case $CERT_TYPE in
        "self-signed")
            generate_self_signed
            ;;
        "letsencrypt")
            setup_letsencrypt
            ;;
        "custom")
            setup_custom
            ;;
        *)
            echo -e "${RED}❌ Invalid certificate type: $CERT_TYPE${NC}"
            echo "Valid options: self-signed, letsencrypt, custom"
            exit 1
            ;;
    esac
    
    validate_certificate
    update_environment
    
    echo ""
    echo -e "${GREEN}🎉 SSL Certificate setup completed successfully!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo -e "${BLUE}Certificate Details:${NC}"
    echo "Domain: $DOMAIN"
    echo "Certificate: $CERT_DIR/certificate.crt" 
    echo "Private Key: $CERT_DIR/private.key"
    echo "Type: $CERT_TYPE"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Restart your UPP server to use the new certificate"
    echo "2. Test HTTPS connectivity: https://$DOMAIN"
    echo "3. Verify certificate in browser or with: openssl s_client -connect $DOMAIN:443"
    if [ "$CERT_TYPE" = "letsencrypt" ]; then
        echo "4. Certificate will auto-renew - check /usr/local/bin/renew-upp-cert.sh"
    fi
    echo ""
    echo -e "${GREEN}🔒 Your Universal Payment Protocol is now secured with SSL! 🔒${NC}"
}

# Show usage if no arguments
if [ $# -eq 0 ]; then
    echo "Usage: $0 <domain> [email] [cert_type]"
    echo ""
    echo "Arguments:"
    echo "  domain     - Your domain name (e.g., pay.yourdomain.com)"
    echo "  email      - Email for Let's Encrypt registration (optional)"
    echo "  cert_type  - Certificate type: self-signed, letsencrypt, custom (default: letsencrypt)"
    echo ""
    echo "Examples:"
    echo "  $0 pay.example.com admin@example.com letsencrypt"
    echo "  $0 localhost localhost@example.com self-signed"
    echo "  $0 pay.example.com admin@example.com custom"
    exit 1
fi

# Run main function
main "$@"