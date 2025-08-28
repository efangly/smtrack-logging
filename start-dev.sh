#!/bin/bash

# Start development environment script

echo "Starting SMtrack Logging Development Environment"
echo "=============================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Start infrastructure services
echo "Starting infrastructure services..."
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Check service status
echo "Checking service status..."
echo "- Mosquitto MQTT Broker: http://localhost:1883"
echo "- Loki Logs: http://localhost:3100"
echo "- Grafana Dashboard: http://localhost:3001 (admin/admin)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
fi

echo ""
echo "Development environment is ready!"
echo ""
echo "Next steps:"
echo "1. Start the application: npm run start:dev"
echo "2. Test MQTT: ./test-mqtt.sh"
echo "3. View logs in Grafana: http://localhost:3001"
echo ""
echo "To stop services: docker-compose down"
