import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsNotEmpty,
} from 'class-validator';

export enum LogSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export class IoTMessage {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(LogSeverity)
  severity: LogSeverity;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  timestamp?: Date;
}

export class LogEntry {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  device_id: string;

  @IsEnum(LogSeverity)
  severity: LogSeverity;

  @IsOptional()
  @IsObject()
  labels?: Record<string, string>;

  @IsOptional()
  timestamp?: Date;
}

export class TestLogRequest {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsOptional()
  @IsEnum(LogSeverity)
  severity?: LogSeverity;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class PublishMessageRequest {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsNotEmpty()
  message: string | object;
}

export class StatusResponse {
  mqtt: {
    connected: boolean;
    status: string;
    connectedSince?: Date;
    lastError?: string;
  };
  loki: {
    status: string;
    bufferedLogs: number;
    lastFlush?: Date;
    lastError?: string;
  };
  timestamp: Date;
  uptime: number;
}

export interface LokiStream {
  stream: Record<string, string>;
  values: Array<[string, string]>;
}

export interface LokiPushRequest {
  streams: LokiStream[];
}

export interface MqttConnectionStatus {
  connected: boolean;
  connectedSince?: Date;
  lastError?: string;
  reconnectAttempts: number;
}
