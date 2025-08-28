import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  HttpException,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { MqttSubscriberService } from './mqtt-subscriber.service';
import { LokiService } from '../loki/loki.service';
import {
  TestLogRequest,
  PublishMessageRequest,
  StatusResponse,
  LogSeverity,
} from '../types';

@Controller('mqtt')
export class MqttController {
  constructor(
    private readonly mqttService: MqttSubscriberService,
    private readonly lokiService: LokiService,
  ) {}

  @Get('status')
  getStatus(): StatusResponse {
    const mqttStatus = this.mqttService.getConnectionStatus();
    const lokiStatus = this.lokiService.getStatus();

    return {
      mqtt: {
        connected: mqttStatus.connected,
        status: mqttStatus.connected ? 'connected' : 'disconnected',
        connectedSince: mqttStatus.connectedSince,
        lastError: mqttStatus.lastError,
      },
      loki: {
        status: lokiStatus.status,
        bufferedLogs: lokiStatus.bufferedLogs,
        lastFlush: lokiStatus.lastFlush,
        lastError: lokiStatus.lastError,
      },
      timestamp: new Date(),
      uptime: this.mqttService.getUptime(),
    };
  }

  @Post('test-log')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async testLog(
    @Body() request: TestLogRequest,
  ): Promise<{ message: string; timestamp: Date }> {
    try {
      const logEntry = {
        message: request.message,
        device_id: request.deviceId,
        severity: request.severity || LogSeverity.INFO,
        timestamp: new Date(),
        labels: {
          severity: request.severity || LogSeverity.INFO,
          device_id: request.deviceId,
          source: 'test-endpoint',
          ...(request.metadata && {
            metadata: JSON.stringify(request.metadata),
          }),
        },
      };

      await this.lokiService.pushLog(logEntry);

      return {
        message: 'Test log sent to Loki successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to send test log: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('publish')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async publishMessage(
    @Body() request: PublishMessageRequest,
  ): Promise<{ message: string; timestamp: Date }> {
    try {
      await this.mqttService.publish(request.topic, request.message);

      return {
        message: `Message published to topic ${request.topic} successfully`,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to publish message: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('reconnect')
  reconnect(): { message: string; timestamp: Date } {
    try {
      this.mqttService.reconnect();

      return {
        message: 'MQTT reconnection initiated successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to reconnect: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('flush-logs')
  async flushLogs(): Promise<{ message: string; timestamp: Date }> {
    try {
      await this.lokiService.forceFlush();

      return {
        message: 'Log buffer flushed successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Failed to flush logs: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
