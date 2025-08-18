# Docker Deployment Guide

This guide explains how to deploy the Marketplace Automation system using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available
- At least 1GB disk space

## Quick Start

### 1. Initialize Environment

**Windows:**
```powershell
.\docker-init.ps1
```

**Linux/macOS:**
```bash
chmod +x docker-init.sh
./docker-init.sh
```

### 2. Start Services

**Production Mode:**
```bash
docker-compose up -d
```

**Development Mode:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Access Application

- **Web Portal:** http://localhost
- **Backend API:** http://localhost:3001/api
- **Health Check:** http://localhost:3001/api/health

## Configuration

### Environment Variables

Edit `.env` file to customize configuration:

```env
# Backend Configuration
NODE_ENV=production
PORT=3001
MAX_FILE_SIZE=10485760

# Puppeteer Configuration
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Web Portal Configuration
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

### Persistent Data

Data is stored in the following directories:

- `./data/uploads/` - Uploaded files
- `./data/logs/` - Application logs
- `./data/sessions/` - Browser sessions

## Services

### Backend Service

- **Container:** `marketplace-backend`
- **Port:** 3001
- **Health Check:** `/api/health`
- **Features:**
  - Express.js API server
  - Socket.IO for real-time communication
  - Puppeteer for browser automation
  - File upload handling
  - Logging system

### Web Portal Service

- **Container:** `marketplace-web-portal`
- **Port:** 80
- **Features:**
  - React SPA with Vite
  - Nginx reverse proxy
  - API proxy to backend
  - Socket.IO proxy for real-time features

## Development

### Development Mode

Development mode provides:

- Hot reload for both frontend and backend
- Source code mounting
- Debug port exposure (9229)
- Development dependencies

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Access development servers
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

### Debugging

**Backend Debug:**
- Debug port: 9229
- Attach debugger to `localhost:9229`

**View Logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f web-portal
```

## Management Commands

### Service Management

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# View running containers
docker-compose ps

# View service status
docker-compose top
```

### Data Management

```bash
# Backup data
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# Clear logs
rm -rf data/logs/*

# Clear uploads
rm -rf data/uploads/*

# Clear sessions
rm -rf data/sessions/*
```

### Container Management

```bash
# Execute commands in containers
docker-compose exec backend bash
docker-compose exec web-portal sh

# View container stats
docker stats

# Inspect containers
docker-compose exec backend ps aux
```

## Troubleshooting

### Common Issues

**1. Port Already in Use**
```bash
# Check what's using the port
netstat -tulpn | grep :80
netstat -tulpn | grep :3001

# Stop conflicting services
sudo systemctl stop nginx
sudo systemctl stop apache2
```

**2. Permission Issues**
```bash
# Fix data directory permissions
sudo chown -R $USER:$USER data/
chmod -R 755 data/
```

**3. Puppeteer Issues**
```bash
# Check Chromium installation
docker-compose exec backend chromium-browser --version

# View Puppeteer logs
docker-compose logs backend | grep -i puppeteer
```

**4. Build Issues**
```bash
# Rebuild containers
docker-compose build --no-cache

# Clean Docker system
docker system prune -a
```

### Health Checks

```bash
# Check service health
curl http://localhost:3001/api/health
curl http://localhost/

# Check container health
docker-compose ps
```

### Logs Analysis

```bash
# Follow all logs
docker-compose logs -f

# Filter logs by service
docker-compose logs -f backend 2>&1 | grep ERROR

# Export logs
docker-compose logs --no-color > application.log
```

## Security Considerations

1. **Environment Variables:** Never commit `.env` files with sensitive data
2. **File Permissions:** Ensure proper permissions on data directories
3. **Network Security:** Use reverse proxy for production deployments
4. **Container Security:** Regularly update base images
5. **Data Backup:** Implement regular backup strategy

## Production Deployment

For production deployment:

1. Use environment-specific `.env` files
2. Set up SSL/TLS termination
3. Configure log rotation
4. Set up monitoring and alerting
5. Implement backup strategy
6. Use Docker secrets for sensitive data

## Support

For issues and questions:

1. Check logs: `docker-compose logs -f`
2. Verify health: `curl http://localhost:3001/api/health`
3. Check container status: `docker-compose ps`
4. Review configuration: `.env` and `docker-compose.yml`