#!/bin/bash

# Buddy Docker Deployment Script
# This script builds and runs Buddy in a Docker container with a single command

set -e  # Exit on any error

echo "🚀 Starting Buddy Docker Deployment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed. Please install pnpm and try again."
    exit 1
fi

echo "📦 Building Buddy locally..."
pnpm build:web && pnpm --filter @buddy/server build

echo "🐳 Building Docker image..."
docker build -t buddy-webapp .

echo "🛑 Stopping any existing Buddy container..."
docker stop buddy-container 2>/dev/null || true
docker rm buddy-container 2>/dev/null || true

echo "🌟 Starting Buddy container..."
docker run -d \
  -p 9000:9000 \
  -p 3002:3002 \
  --name buddy-container \
  --restart unless-stopped \
  buddy-webapp

echo ""
echo "✅ Buddy is now running!"
echo "🌐 Web UI: http://localhost:9000"
echo "🔌 API Server: http://localhost:3002"
echo ""
echo "📋 Useful commands:"
echo "   View logs: docker logs -f buddy-container"
echo "   Stop: docker stop buddy-container"
echo "   Restart: docker restart buddy-container"
echo ""
echo "🎉 Deployment complete!"