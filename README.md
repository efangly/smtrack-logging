# SMtrack Logging Service

A production-ready NestJS service that subscribes to MQTT messages from IoT devices and forwards logs to Loki for centralized logging and monitoring.

## 🚀 Features

- **MQTT Subscriber**: Automatically subscribes to configured MQTT topics with robust error handling
- **Loki Integration**: Batches and sends logs to Loki with proper formatting and retry logic
- **IoT Device Support**: Handles various message formats from IoT devices with intelligent parsing
- **Health Monitoring**: REST API endpoints for comprehensive status checking and testing
- **Flexible Configuration**: Environment-based configuration with validation
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Production Ready**: Docker support, health checks, and graceful shutdown

## 🏗 Architecture

```
IoT Devices → MQTT Broker → MQTT Subscriber → Loki → Grafana (optional)
```

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

### Environment Variables

#### Application Settings
- `NODE_ENV`: Environment (development/production)
- `PORT`: Application port (default: 3000)
- `CORS_ORIGINS`: Comma-separated list of allowed origins

#### MQTT Configuration
- `MQTT_HOST`: MQTT broker hostname (default: localhost)
- `MQTT_PORT`: MQTT broker port (default: 1883)
- `MQTT_PROTOCOL`: Protocol (mqtt/mqtts) (default: mqtt)
- `MQTT_USERNAME`: MQTT username (optional)
- `MQTT_PASSWORD`: MQTT password (optional)
- `MQTT_CLIENT_ID`: Unique client identifier
- `MQTT_TOPICS`: Comma-separated list of topics to subscribe to
- `MQTT_RECONNECT_PERIOD`: Reconnection interval in ms (default: 5000)
- `MQTT_CONNECT_TIMEOUT`: Connection timeout in ms (default: 30000)

#### Loki Configuration
- `LOKI_URL`: Loki server URL (default: http://localhost:3100)
- `LOKI_USERNAME`: Loki username (optional)
- `LOKI_PASSWORD`: Loki password (optional)
- `LOKI_BATCH_SIZE`: Number of logs to batch before sending (default: 10)
- `LOKI_FLUSH_INTERVAL`: Batch flush interval in ms (default: 5000)
- `LOKI_TIMEOUT`: Request timeout in ms (default: 10000)

## 🚀 Running the Application

### Development
```bash
npm run start:dev
```

### Production
```bash
npm run build
npm run start:prod
```

### Using Docker
```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

### Using Docker Compose (with MQTT and Loki)
```bash
docker-compose up -d
```

## 📡 API Endpoints

### Health Check
- `GET /health` - Comprehensive health status
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe

### MQTT Management
- `GET /mqtt/status` - MQTT and Loki status
- `POST /mqtt/test-log` - Send test log to Loki
- `POST /mqtt/publish` - Publish message to MQTT topic
- `POST /mqtt/reconnect` - Force MQTT reconnection
- `POST /mqtt/flush-logs` - Force flush log buffer

### Example API Usage

#### Send Test Log
```bash
curl -X POST http://localhost:3000/mqtt/test-log \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device001",
    "message": "Test log message",
    "severity": "info",
    "metadata": {"temperature": 25}
  }'
```

#### Publish MQTT Message
```bash
curl -X POST http://localhost:3000/mqtt/publish \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "smtrack/device001/logs",
    "message": {
      "deviceId": "device001",
      "message": "Device online",
      "severity": "info"
    }
  }'
```

## 📊 Message Format

### Supported IoT Message Formats

#### JSON Format
```json
{
  "deviceId": "device001",
  "message": "Temperature reading: 25°C",
  "severity": "info",
  "timestamp": "2025-01-01T12:00:00Z",
  "metadata": {
    "sensor": "temp001",
    "location": "room1"
  }
}
```

#### Plain Text
```
Temperature reading: 25°C
```

### Supported Severity Levels
- `debug`
- `info`
- `warning`
- `error`
- `critical`

## 🏥 Health Monitoring

The service provides comprehensive health monitoring:

```json
{
  "status": "ok",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "uptime": 3600000,
  "version": "1.0.0",
  "services": {
    "mqtt": {
      "status": "ok",
      "connected": true,
      "connectedSince": "2025-01-01T11:00:00.000Z"
    },
    "loki": {
      "status": "ok",
      "bufferedLogs": 5,
      "lastFlush": "2025-01-01T11:59:00.000Z"
    }
  }
}
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run e2e tests
npm run test:e2e

# Run with coverage
npm run test:cov
```

## 🔍 Monitoring and Logging

### Grafana Integration
The included Docker Compose setup provides Grafana with Loki integration for log visualization.

Access Grafana at: http://localhost:3001
- Username: admin
- Password: admin

### Log Queries in Grafana
```logql
# All logs from a specific device
{device_id="device001"}

# Error logs only
{severity="error"}

# Logs from the last hour
{source="smtrack-logging"} |= "error" [1h]
```

## 🐳 Docker Support

### Multi-stage Dockerfile
- Optimized for production
- Health checks included
- Non-root user
- Proper signal handling

### Docker Compose Features
- MQTT broker (Mosquitto)
- Loki for log storage
- Grafana for visualization
- Automatic test message publisher

## 🛠 Development

### Project Structure
```
src/
├── config/           # Configuration management
├── health/           # Health check services
├── loki/            # Loki integration
├── mqtt/            # MQTT services and controllers
├── types/           # TypeScript type definitions
├── app.module.ts    # Main application module
└── main.ts          # Application entry point
```

### Code Quality
- ESLint configuration
- Prettier formatting
- TypeScript strict mode
- Comprehensive error handling
- Input validation with class-validator

## 🔒 Security Considerations

- Input validation and sanitization
- CORS configuration
- Environment-based secrets
- Non-root Docker container
- Request timeouts
- Memory leak prevention

## 📈 Performance

- Batch processing for Loki
- Connection pooling
- Graceful shutdown
- Memory-efficient buffering
- Configurable timeouts
- Retry mechanisms

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the UNLICENSED License.

## 🆘 Troubleshooting

### Common Issues

#### MQTT Connection Failed
- Check MQTT broker availability
- Verify credentials and network connectivity
- Review MQTT_HOST and MQTT_PORT configuration

#### Loki Push Failed
- Ensure Loki is running and accessible
- Check LOKI_URL configuration
- Verify network connectivity to Loki

#### Memory Usage High
- Reduce LOKI_BATCH_SIZE if buffering too many logs
- Check for message loops
- Monitor log volume and adjust flush intervals

### Debug Mode
```bash
NODE_ENV=development npm run start:debug
```

### Logs Analysis
```bash
# View application logs
docker-compose logs smtrack-logging

# View MQTT broker logs
docker-compose logs mosquitto

# View Loki logs
docker-compose logs loki
```
