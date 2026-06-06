#!/bin/bash
set -e

echo "🚀 Starting Production Deployment..."
echo "======================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop existing containers
echo -e "${YELLOW}📦 Stopping existing containers...${NC}"
docker compose down

# Step 2: Build all images
echo -e "${YELLOW}🔨 Building Docker images...${NC}"
docker compose build

# Step 3: Start all services
echo -e "${YELLOW}🚀 Starting all services...${NC}"
docker compose up -d

# Step 4: Wait for health checks
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Step 5: Check service status
echo -e "${YELLOW}📊 Checking service status...${NC}"
docker compose ps

# Step 6: Show logs for any failed services
echo -e "${YELLOW}📋 Checking for errors in logs...${NC}"
FAILED_SERVICES=$(docker compose ps --services --filter "status=exited")
if [ -n "$FAILED_SERVICES" ]; then
    echo -e "${RED}❌ Some services failed to start:${NC}"
    echo "$FAILED_SERVICES"
    docker compose logs
    exit 1
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Services are running on:${NC}"
echo "   - PostgreSQL:     localhost:1300"
echo "   - Landing Page:  localhost:1301"
echo "   - Redis:         localhost:1303"
echo "   - OCR Service:   localhost:1304"
echo "   - Embedding:     localhost:1305"
echo "   - API Gateway:   localhost:1306"
echo "   - Platform:      localhost:1307"
echo "   - MinIO API:     localhost:1308"
echo "   - MinIO Console: localhost:1309"
echo ""
echo "📝 View logs with: docker compose logs -f"
