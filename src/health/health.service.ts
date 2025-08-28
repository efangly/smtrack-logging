import { Injectable } from '@nestjs/common';
import { MqttSubscriberService } from '../mqtt/mqtt-subscriber.service';
import { LokiService } from '../loki/loki.service';

export interface HealthStatus {
  status: 'ok' | 'error' | 'degraded';
  timestamp: Date;
  uptime: number;
  version: string;
  services: {
    mqtt: {
      status: 'ok' | 'error';
      connected: boolean;
      details?: string;
    };
    loki: {
      status: 'ok' | 'error' | 'degraded';
      bufferedLogs: number;
      details?: string;
    };
  };
}

@Injectable()
export class HealthService {
  private readonly startTime = new Date();

  constructor(
    private readonly mqttService: MqttSubscriberService,
    private readonly lokiService: LokiService,
  ) {}

  getHealth(): HealthStatus {
    const mqttStatus = this.mqttService.getConnectionStatus();
    const lokiStatus = this.lokiService.getStatus();

    const mqtt = {
      status: mqttStatus.connected ? ('ok' as const) : ('error' as const),
      connected: mqttStatus.connected,
      details: mqttStatus.lastError,
    };

    const loki = {
      status: this.getLokiHealthStatus(lokiStatus),
      bufferedLogs: lokiStatus.bufferedLogs,
      details: lokiStatus.lastError,
    };

    const overallStatus = this.getOverallStatus(mqtt.status, loki.status);

    return {
      status: overallStatus,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      version: process.env.npm_package_version || '0.0.1',
      services: {
        mqtt,
        loki,
      },
    };
  }

  private getLokiHealthStatus(lokiStatus: {
    lastError?: string;
    bufferedLogs: number;
  }): 'ok' | 'error' | 'degraded' {
    if (lokiStatus.lastError) return 'error';
    if (lokiStatus.bufferedLogs > 100) return 'degraded';
    return 'ok';
  }

  private getOverallStatus(
    mqttStatus: 'ok' | 'error',
    lokiStatus: 'ok' | 'error' | 'degraded',
  ): 'ok' | 'error' | 'degraded' {
    if (mqttStatus === 'error' || lokiStatus === 'error') return 'error';
    if (lokiStatus === 'degraded') return 'degraded';
    return 'ok';
  }
}
