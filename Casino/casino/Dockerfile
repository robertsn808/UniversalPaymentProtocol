FROM php:8.2-apache

# Install system dependencies and PostgreSQL extension
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libpq-dev git unzip \
    && docker-php-ext-install pdo pdo_pgsql \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /var/www/html

# Copy application source
COPY . /var/www/html

# Use composer from official image
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Adjust Apache document root to Laravel public
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-interaction || true

# Permissions for storage and cache
RUN mkdir -p storage bootstrap/cache \
  && chown -R www-data:www-data storage bootstrap/cache \
  && chmod -R 775 storage bootstrap/cache

# Healthcheck lightweight
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost/ || exit 1

EXPOSE 80

# Start Apache
CMD ["apache2-foreground"]

