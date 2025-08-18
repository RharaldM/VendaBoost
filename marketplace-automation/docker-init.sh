#!/bin/bash

# Docker initialization script
# This script prepares the environment for Docker deployment

echo "Initializing Docker environment for Marketplace Automation..."

# Create data directories
echo "Creating data directories..."
mkdir -p data/uploads
mkdir -p data/logs
mkdir -p data/sessions

# Set proper permissions
echo "Setting permissions..."
chmod 755 data
chmod 755 data/uploads
chmod 755 data/logs
chmod 755 data/sessions

# Create .gitkeep files to preserve empty directories
touch data/uploads/.gitkeep
touch data/logs/.gitkeep
touch data/sessions/.gitkeep

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.docker template..."
    cp .env.docker .env
else
    echo ".env file already exists, skipping..."
fi

echo "Docker environment initialized successfully!"
echo ""
echo "Available commands:"
echo "  docker-compose up -d                    # Start production services"
echo "  docker-compose -f docker-compose.dev.yml up -d  # Start development services"
echo "  docker-compose down                     # Stop services"
echo "  docker-compose logs -f                  # View logs"
echo "  docker-compose ps                       # View running containers"
echo ""
echo "Access the application:"
echo "  Web Portal: http://localhost"
echo "  Backend API: http://localhost:3001/api"
echo "  Health Check: http://localhost:3001/api/health"