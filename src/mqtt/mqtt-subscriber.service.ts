import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { MqttClient } from 'mqtt';
import { LokiService } from '../loki/loki.service';
import { IoTMessage, LogEntry, LogSeverity, MqttConnectionStatus } from '../types';
import configuration from '../config/configuration';

@Injectable()
export class MqttSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttSubscriberService.name);
  private client: MqttClient;
  private connectionStatus: MqttConnectionStatus = {
    connected: false,
    reconnectAttempts: 0,
  };
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly startTime = new Date();

  constructor(
    private readonly lokiService: LokiService,
    @Inject(configuration.KEY)
    private readonly config: ConfigType<typeof configuration>,
  ) {}

  onModuleInit(): void {
    this.connect();
  }

  onModuleDestroy(): void {
    if (this.client) {
      this.client.end(true);
    }
  }

  private connect(): void {
    const mqttConfig = this.config.mqtt;
    const options: mqtt.IClientOptions = {
      host: mqttConfig.host,
      port: mqttConfig.port,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      protocol: mqttConfig.protocol as any,
      clientId: mqttConfig.clientId,
      username: mqttConfig.username,
      password: mqttConfig.password,
      reconnectPeriod: mqttConfig.reconnectPeriod,
      connectTimeout: mqttConfig.connectTimeout,
      clean: true,
    };

    try {
      this.client = mqtt.connect(options);
      this.setupEventHandlers();

      this.logger.log(
        `Connecting to MQTT broker at ${mqttConfig.protocol}://${mqttConfig.host}:${mqttConfig.port}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.connectionStatus.lastError = errorMessage;
      this.logger.error(`Failed to connect to MQTT broker: ${errorMessage}`);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.logger.log('Connected to MQTT broker');
      this.connectionStatus.connected = true;
      this.connectionStatus.connectedSince = new Date();
      this.connectionStatus.lastError = undefined;
      this.reconnectAttempts = 0;
      this.subscribeToTopics();
    });

    this.client.on('message', async (topic: string, payload: Buffer) => {
      try {
        await this.handleMessage(topic, payload);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Error handling message from topic ${topic}: ${errorMessage}`,
        );
      }
    });

    this.client.on('error', (error) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.connectionStatus.lastError = errorMessage;
      this.connectionStatus.connected = false;
      this.logger.error(`MQTT client error: ${errorMessage}`);
    });

    this.client.on('close', () => {
      this.connectionStatus.connected = false;
      this.logger.warn('MQTT connection closed');
    });

    this.client.on('reconnect', () => {
      this.reconnectAttempts++;
      this.connectionStatus.reconnectAttempts = this.reconnectAttempts;

      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        this.logger.error(
          `Max reconnect attempts (${this.maxReconnectAttempts}) reached`,
        );
        this.client.end(true);
        return;
      }

      this.logger.log(
        `Attempting to reconnect to MQTT broker (attempt ${this.reconnectAttempts})`,
      );
    });

    this.client.on('offline', () => {
      this.connectionStatus.connected = false;
      this.logger.warn('MQTT client is offline');
    });
  }

  private subscribeToTopics(): void {
    const topics = this.config.mqtt.topics;
    topics.forEach((topic) => {
      this.client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `Failed to subscribe to topic ${topic}: ${errorMessage}`,
          );
        } else {
          this.logger.log(`Subscribed to topic: ${topic}`);
        }
      });
    });
  }

  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    try {
      const messageStr = payload.toString();
      // this.logger.debug(`Received message from ${topic}: ${messageStr}`);

      // Try to parse as JSON, fallback to plain text
      let message: IoTMessage;

      try {
        const parsedMessage = JSON.parse(messageStr);
        message = this.normalizeMessage(parsedMessage, topic);
      } catch {
        // If not JSON, treat as plain text log
        message = this.createPlainTextMessage(messageStr, topic);
      }

      // Convert to log entry and send to Loki
      const logEntry = this.convertToLogEntry(message);
      await this.lokiService.pushLog(logEntry);

      // this.logger.debug(`Processed message from device ${message.deviceId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to process message from ${topic}: ${errorMessage}`,
      );
    }
  }

  private normalizeMessage(parsedMessage: any, topic: string): IoTMessage {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const deviceId =
      parsedMessage.deviceId || this.extractDeviceIdFromTopic(topic);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const message =
      typeof parsedMessage.message === 'string'
        ? parsedMessage.message
        : JSON.stringify(parsedMessage);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const severity =
      this.mapToLogSeverity(parsedMessage.severity) ||
      this.inferMessageType(topic, parsedMessage);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const metadata = parsedMessage.metadata;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const timestamp = parsedMessage.timestamp
      ? new Date(parsedMessage.timestamp)
      : new Date();

    return {
      deviceId,
      message,
      severity,
      metadata,
      timestamp,
    };
  }

  private createPlainTextMessage(text: string, topic: string): IoTMessage {
    return {
      deviceId: this.extractDeviceIdFromTopic(topic),
      message: text,
      severity: this.inferMessageType(topic, { message: text }),
      timestamp: new Date(),
    };
  }

  private extractDeviceIdFromTopic(topic: string): string {
    // Support multiple topic patterns:
    // - smtrack/{deviceId}/logs
    // - iot/{deviceId}/logs
    // - {deviceId}/logs
    const parts = topic.split('/');

    if (parts.length >= 3) {
      // Pattern: prefix/{deviceId}/suffix
      return parts[1];
    } else if (parts.length === 2) {
      // Pattern: {deviceId}/logs
      return parts[0];
    }

    // Fallback: use last part before file extension or return unknown
    return parts[parts.length - 2] || 'unknown';
  }

  private mapToLogSeverity(severity: string): LogSeverity | undefined {
    if (!severity) return undefined;

    const severityMap: Record<string, LogSeverity> = {
      debug: LogSeverity.DEBUG,
      info: LogSeverity.INFO,
      information: LogSeverity.INFO,
      warn: LogSeverity.WARNING,
      warning: LogSeverity.WARNING,
      error: LogSeverity.ERROR,
      err: LogSeverity.ERROR,
      critical: LogSeverity.CRITICAL,
      crit: LogSeverity.CRITICAL,
      fatal: LogSeverity.CRITICAL,
    };

    return severityMap[severity.toLowerCase()];
  }

  private inferMessageType(topic: string, message: any): LogSeverity {
    // Check topic patterns
    if (topic.includes('/error') || topic.includes('/alert'))
      return LogSeverity.ERROR;
    if (topic.includes('/warning') || topic.includes('/warn'))
      return LogSeverity.WARNING;
    if (topic.includes('/debug')) return LogSeverity.DEBUG;

    // Check message content
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (message.level) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const mapped = this.mapToLogSeverity(message.level);
      if (mapped) return mapped;
    }

    // Check for error keywords in message
    const messageText =
      typeof message === 'string' ? message : JSON.stringify(message);
    const lowerMessage = messageText.toLowerCase();

    if (
      lowerMessage.includes('error') ||
      lowerMessage.includes('exception') ||
      lowerMessage.includes('fail')
    ) {
      return LogSeverity.ERROR;
    }
    if (lowerMessage.includes('warn')) {
      return LogSeverity.WARNING;
    }

    // Default to info
    return LogSeverity.INFO;
  }

  private convertToLogEntry(message: IoTMessage): LogEntry {
    const logMessage =
      typeof message.message === 'string'
        ? message.message
        : JSON.stringify(message.message);

    return {
      message: logMessage,
      device_id: message.deviceId,
      severity: message.severity,
      timestamp: message.timestamp || new Date(),
      labels: {
        severity: message.severity,
        device_id: message.deviceId,
        source: 'smtrack-logging',
        ...(message.metadata && { metadata: JSON.stringify(message.metadata) }),
      },
    };
  }

  // Public methods for health checks and status
  isConnected(): boolean {
    return this.client && this.client.connected;
  }

  getConnectionStatus(): MqttConnectionStatus {
    return {
      ...this.connectionStatus,
      connected: this.isConnected(),
    };
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  // Public method to publish a message (for testing or control)
  async publish(topic: string, message: string | object): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('MQTT client is not connected');
    }

    const payload =
      typeof message === 'string' ? message : JSON.stringify(message);

    return new Promise((resolve, reject) => {
      this.client.publish(topic, payload, { qos: 1 }, (error) => {
        if (error) {
          reject(new Error(`Failed to publish message: ${error.message}`));
        } else {
          this.logger.debug(`Published message to topic ${topic}`);
          resolve();
        }
      });
    });
  }

  // Force reconnection
  reconnect(): void {
    if (this.client) {
      this.client.end(true);
    }
    this.reconnectAttempts = 0;
    this.connect();
  }
}
