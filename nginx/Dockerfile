FROM nginx:1.25-alpine

# Install certbot + openssl for Let's Encrypt provisioning and self-signed fallback
RUN apk add --no-cache certbot openssl

# Template → rendered at startup by entrypoint.sh
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Entrypoint renders template, provisions certs, starts nginx
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ACME webroot for Let's Encrypt http-01 challenge
RUN mkdir -p /var/www/certbot

EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]
