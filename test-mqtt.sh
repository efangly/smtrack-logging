#!/bin/bash

# Test script for MQTT IoT logging service
# Make sure the service is running before executing this script

echo "Testing MQTT IoT Logging Service"
echo "================================="

# Test 1: Check service status
echo "1. Checking service status..."
curl -s http://localhost:3000/mqtt/status | jq '.'
echo ""

# Test 2: Send a test log via API
echo "2. Sending test log via API..."
curl -X POST http://localhost:3000/mqtt/test-log \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "sensor001",
    "level": "info",
    "message": "Test log from API",
    "topic": "iot/sensor001/logs"
  }' | jq '.'
echo ""

# Test 3: Publish MQTT message (requires mosquitto_pub)
echo "3. Publishing MQTT message..."
if command -v mosquitto_pub &> /dev/null; then
  mosquitto_pub -h localhost -t "iot/sensor001/logs" -m '{
    "deviceId": "sensor001",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "level": "info",
    "data": {
      "temperature": 25.5,
      "humidity": 60.2,
      "location": "greenhouse-1"
    },
    "messageType": "data"
  }'
  echo "MQTT message published successfully"
else
  echo "mosquitto_pub not found. Install with: brew install mosquitto"
fi
echo ""

# Test 4: Publish via API
echo "4. Publishing message via API..."
curl -X POST http://localhost:3000/mqtt/publish \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "iot/gateway01/status",
    "message": {
      "deviceId": "gateway01",
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
      "level": "info",
      "data": {
        "status": "online",
        "connectedDevices": 5,
        "memoryUsage": "45%"
      },
      "messageType": "status"
    }
  }' | jq '.'
echo ""

echo "Test completed!"
echo "Check Loki logs at: http://localhost:3100"
