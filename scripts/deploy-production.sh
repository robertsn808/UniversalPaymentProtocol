#!/bin/bash

# UPP Production Deployment Script
# Automated deployment with security checks and validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_ENV=${1:-production}
BACKUP_BEFORE_DEPLOY=${2:-true}
RUN_TESTS=${3:-true}

echo -e "${BLUE}🌊 Universal Payment Protocol - Production Deployment${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""
echo "Environment: $DEPLOY_ENV"
echo "Backup before deploy: $BACKUP_BEFORE_DEPLOY"
echo "Run tests: $RUN_TESTS"
echo ""

# Validation functions
validate_environment() {
    echo -e "${YELLOW}🔍 Validating environment...${NC}"
    
    if [ ! -f ".env.${DEPLOY_ENV}" ]; then
        echo -e "${RED}❌ Environment file .env.${DEPLOY_ENV} not found${NC}"
        echo "Please create .env.${DEPLOY_ENV} based on .env.production.example"
        exit 1
    fi
    
    # Source environment variables
    export $(cat .env.${DEPLOY_ENV} | grep -v '^#' | xargs)
    
    # Check required variables
    required_vars=(
        "NODE_ENV"
        "PORT"
        "DATABASE_URL"
        "STRIPE_SECRET_KEY"
        "STRIPE_PUBLISHABLE_KEY"
        "JWT_SECRET"
        "FRONTEND_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}❌ Required environment variable $var is not set${NC}"
            exit 1
        fi
    done
    
    # Validate JWT secret strength
    if [ ${#JWT_SECRET} -lt 32 ]; then
        echo -e "${RED}❌ JWT_SECRET must be at least 32 characters long${NC}"
        exit 1
    fi
    
    # Check if using live Stripe keys for production
    if [ "$DEPLOY_ENV" = "production" ] && [[ $STRIPE_SECRET_KEY != sk_live_* ]]; then
        echo -e "${RED}❌ Production deployment requires live Stripe keys${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Environment validation passed${NC}"
}

run_tests() {
    if [ "$RUN_TESTS" = "true" ]; then
        echo -e "${YELLOW}🧪 Running test suite...${NC}"
        
        npm test
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Tests failed. Deployment aborted.${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ All tests passed${NC}"
    else
        echo -e "${YELLOW}⚠️ Skipping tests${NC}"
    fi
}

build_application() {
    echo -e "${YELLOW}🔨 Building application...${NC}"
    
    # Install production dependencies
    npm ci --only=production
    
    # Build TypeScript
    npm run build
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Build completed successfully${NC}"
}

backup_database() {
    if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
        echo -e "${YELLOW}💾 Creating database backup...${NC}"
        
        # Extract database info from DATABASE_URL
        DB_BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
        
        # Create backup (you'll need to adjust this based on your DB setup)
        pg_dump $DATABASE_URL > "backups/$DB_BACKUP_FILE"
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Database backup created: $DB_BACKUP_FILE${NC}"
        else
            echo -e "${YELLOW}⚠️ Database backup failed, continuing...${NC}"
        fi
    fi
}

run_migrations() {
    echo -e "${YELLOW}🗃️ Running database migrations...${NC}"
    
    # Run migrations (you'll need to implement a migration runner)
    for migration in migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo "Running migration: $migration"
            psql $DATABASE_URL -f "$migration"
        fi
    done
    
    echo -e "${GREEN}✅ Migrations completed${NC}"
}

security_check() {
    echo -e "${YELLOW}🔒 Running security checks...${NC}"
    
    # Check for common security issues
    npm audit --audit-level=high
    
    # Check environment file permissions
    chmod 600 .env.${DEPLOY_ENV}
    
    # Validate SSL certificates if configured
    if [ -n "$SSL_CERT_PATH" ] && [ -f "$SSL_CERT_PATH" ]; then
        openssl x509 -in $SSL_CERT_PATH -text -noout > /dev/null
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ SSL certificate is valid${NC}"
        else
            echo -e "${RED}❌ Invalid SSL certificate${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ Security checks passed${NC}"
}

deploy_application() {
    echo -e "${YELLOW}🚀 Deploying application...${NC}"
    
    # Stop existing service (adjust based on your process manager)
    if pgrep -f "node.*server/index.js" > /dev/null; then
        echo "Stopping existing service..."
        pkill -f "node.*server/index.js"
        sleep 5
    fi
    
    # Start the application
    NODE_ENV=$DEPLOY_ENV npm start &
    APP_PID=$!
    
    # Wait for application to start
    sleep 10
    
    # Health check
    HEALTH_URL="http://localhost:$PORT/health"
    if [ "$FORCE_HTTPS" = "true" ]; then
        HEALTH_URL="https://localhost:$PORT/health"
    fi
    
    if curl -f -s $HEALTH_URL > /dev/null; then
        echo -e "${GREEN}✅ Application is running and healthy${NC}"
    else
        echo -e "${RED}❌ Application health check failed${NC}"
        kill $APP_PID 2>/dev/null || true
        exit 1
    fi
    
    echo -e "${GREEN}✅ Deployment completed successfully${NC}"
}

setup_monitoring() {
    echo -e "${YELLOW}📊 Setting up monitoring...${NC}"
    
    # Setup log rotation
    if [ "$LOG_TO_FILE" = "true" ]; then
        mkdir -p $(dirname $LOG_FILE_PATH)
        
        # Create logrotate configuration
        cat > /tmp/upp-logrotate << EOF
$LOG_FILE_PATH {
    daily
    rotate $LOG_MAX_FILES
    compress
    delaycompress
    missingok
    create 644 $(whoami) $(whoami)
    postrotate
        pkill -USR1 -f "node.*server/index.js"
    endscript
}
EOF
        
        # Install logrotate config (requires sudo)
        if command -v sudo > /dev/null; then
            sudo cp /tmp/upp-logrotate /etc/logrotate.d/upp
            echo -e "${GREEN}✅ Log rotation configured${NC}"
        else
            echo -e "${YELLOW}⚠️ Logrotate setup requires sudo access${NC}"
        fi
    fi
    
    echo -e "${GREEN}✅ Monitoring setup completed${NC}"
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting deployment process...${NC}"
    echo ""
    
    validate_environment
    echo ""
    
    run_tests
    echo ""
    
    security_check
    echo ""
    
    backup_database
    echo ""
    
    build_application
    echo ""
    
    run_migrations
    echo ""
    
    deploy_application
    echo ""
    
    setup_monitoring
    echo ""
    
    echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
    echo -e "${GREEN}====================================${NC}"
    echo ""
    echo -e "${BLUE}Application Details:${NC}"
    echo "Environment: $DEPLOY_ENV"
    echo "URL: $FRONTEND_URL"
    echo "Health Check: $FRONTEND_URL/health"
    echo "API Base: $FRONTEND_URL/api"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Configure your domain DNS to point to this server"
    echo "2. Set up SSL certificates if not already configured"
    echo "3. Configure Stripe webhooks to point to: $FRONTEND_URL/api/webhooks/stripe"
    echo "4. Monitor application logs and metrics"
    echo "5. Test payment flows end-to-end"
    echo ""
    echo -e "${GREEN}🌊 Universal Payment Protocol is LIVE! 🌊${NC}"
}

# Error handling
trap 'echo -e "${RED}❌ Deployment failed. Check the logs above.${NC}"; exit 1' ERR

# Run main deployment
main "$@"