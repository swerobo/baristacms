# BaristaCMS Docker Deployment

Docker Compose setup for running BaristaCMS with MySQL on Linux.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │     │     Backend     │     │      MySQL      │
│   (Nginx:80)    │────▶│   (Node:3001)   │────▶│    (Port 3306)  │
│   React/Vite    │     │   Express API   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Quick Start

### 1. Configure Environment

```bash
# Copy the example environment file
cp .env.docker.example .env

# Edit the .env file with your settings
nano .env
```

### 2. Build and Start

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f
```

### 3. Access the Application

- **Frontend:** http://localhost (or your configured FRONTEND_PORT)
- **Backend API:** http://localhost:3001 (or your configured BACKEND_PORT)
- **MySQL:** localhost:3306

## Services

### MySQL Database
- Image: `mysql:8.0`
- Data persisted in Docker volume `mysql_data`
- Health check included

### Backend API
- Node.js 20 Alpine
- Express server on port 3001
- Uploads stored in volume `uploads_data`

### Frontend
- Multi-stage build (Node.js → Nginx)
- React/Vite app served by Nginx
- SPA routing configured

## Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend

# Rebuild after code changes
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# Shell into container
docker-compose exec backend sh
docker-compose exec mysql mysql -u root -p
```

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `MYSQL_PASSWORD` | MySQL user password |
| `VITE_API_URL` | Backend API URL for frontend |

### Azure AD (for M365 login)

| Variable | Description |
|----------|-------------|
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | Azure AD app client ID |
| `VITE_AZURE_CLIENT_ID` | Same as AZURE_CLIENT_ID (for frontend) |
| `VITE_AZURE_TENANT_ID` | Same as AZURE_TENANT_ID (for frontend) |

### Email (optional)

| Variable | Description |
|----------|-------------|
| `EMAIL_PROVIDER` | `graph` or `smtp` |
| `EMAIL_AZURE_CLIENT_SECRET` | Azure app secret (for Graph API) |
| `EMAIL_FROM` | Sender email address |

## Production Deployment

### With Reverse Proxy (Recommended)

For production, use a reverse proxy like Traefik or Nginx:

```yaml
# Add to docker-compose.yml
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.baristacms.rule=Host(`cms.yourdomain.com`)"
      - "traefik.http.routers.baristacms.tls.certresolver=letsencrypt"
```

### SSL/HTTPS

For HTTPS, either:
1. Use a reverse proxy with Let's Encrypt
2. Mount SSL certificates into the nginx container
3. Use Cloudflare or similar CDN

### API Proxy (Same Domain)

To serve API from the same domain, uncomment the proxy settings in `docker/nginx.conf`:

```nginx
location /api {
    proxy_pass http://backend:3001;
    ...
}
```

Then set `VITE_API_URL=` (empty) to use relative URLs.

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs backend

# Verify MySQL is healthy
docker-compose ps
```

### Database connection errors

```bash
# Wait for MySQL to be ready (healthcheck)
docker-compose exec mysql mysqladmin ping -h localhost -u root -p

# Check MySQL logs
docker-compose logs mysql
```

### Frontend can't reach backend

1. Verify `VITE_API_URL` is correctly set
2. Check if backend is running: `curl http://localhost:3001/api/health`
3. Check for CORS issues in browser console

### Reset everything

```bash
# Stop and remove all containers, networks, volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Fresh start
docker-compose up -d --build
```

## Backup

### Database Backup

```bash
# Backup
docker-compose exec mysql mysqldump -u root -p baristacms > backup.sql

# Restore
docker-compose exec -T mysql mysql -u root -p baristacms < backup.sql
```

### Uploads Backup

```bash
# Backup uploads volume
docker run --rm -v baristacms_uploads_data:/data -v $(pwd):/backup alpine tar czf /backup/uploads.tar.gz -C /data .

# Restore
docker run --rm -v baristacms_uploads_data:/data -v $(pwd):/backup alpine tar xzf /backup/uploads.tar.gz -C /data
```
