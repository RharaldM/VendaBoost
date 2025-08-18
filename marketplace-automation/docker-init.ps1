# Docker initialization script for Windows
# This script prepares the environment for Docker deployment

Write-Host "Initializing Docker environment for Marketplace Automation..." -ForegroundColor Green

# Create data directories
Write-Host "Creating data directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "data\uploads" | Out-Null
New-Item -ItemType Directory -Force -Path "data\logs" | Out-Null
New-Item -ItemType Directory -Force -Path "data\sessions" | Out-Null

# Create .gitkeep files to preserve empty directories
New-Item -ItemType File -Force -Path "data\uploads\.gitkeep" | Out-Null
New-Item -ItemType File -Force -Path "data\logs\.gitkeep" | Out-Null
New-Item -ItemType File -Force -Path "data\sessions\.gitkeep" | Out-Null

# Copy environment file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file from .env.docker template..." -ForegroundColor Yellow
    Copy-Item ".env.docker" ".env"
} else {
    Write-Host ".env file already exists, skipping..." -ForegroundColor Cyan
}

Write-Host "Docker environment initialized successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Available commands:" -ForegroundColor White
Write-Host "  docker-compose up -d                    # Start production services" -ForegroundColor Cyan
Write-Host "  docker-compose -f docker-compose.dev.yml up -d  # Start development services" -ForegroundColor Cyan
Write-Host "  docker-compose down                     # Stop services" -ForegroundColor Cyan
Write-Host "  docker-compose logs -f                  # View logs" -ForegroundColor Cyan
Write-Host "  docker-compose ps                       # View running containers" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access the application:" -ForegroundColor White
Write-Host "  Web Portal: http://localhost" -ForegroundColor Green
Write-Host "  Backend API: http://localhost:3001/api" -ForegroundColor Green
Write-Host "  Health Check: http://localhost:3001/api/health" -ForegroundColor Green