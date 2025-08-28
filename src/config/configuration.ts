import { registerAs } from '@nestjs/config';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsUrl,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class MqttConfig {
  @IsString()
  host: string = 'localhost';

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  port: number = 1883;

  @IsString()
  protocol: string = 'mqtt';

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsString()
  clientId: string = 'smtrack-logging-subscriber';

  @IsArray()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((s) => s.trim()) : value,
  )
  topics: string[] = ['smtrack/+/logs'];

  @IsNumber()
  @Min(1000)
  @Max(60000)
  @Type(() => Number)
  reconnectPeriod: number = 5000;

  @IsNumber()
  @Min(5000)
  @Max(120000)
  @Type(() => Number)
  connectTimeout: number = 30000;
}

export class LokiConfig {
  @IsUrl({ require_tld: false })
  url: string = 'http://localhost:3100';

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  batchSize: number = 10;

  @IsNumber()
  @Min(1000)
  @Max(60000)
  @Type(() => Number)
  flushInterval: number = 5000;

  @IsNumber()
  @Min(5000)
  @Max(30000)
  @Type(() => Number)
  timeout: number = 10000;
}

export class AppConfig {
  @IsNumber()
  @Min(1000)
  @Max(65535)
  @Type(() => Number)
  port: number = 3000;

  @IsString()
  environment: string = 'development';

  @Type(() => MqttConfig)
  mqtt: MqttConfig = new MqttConfig();

  @Type(() => LokiConfig)
  loki: LokiConfig = new LokiConfig();
}

export default registerAs('app', (): AppConfig => {
  const config = new AppConfig();

  // Map environment variables
  config.port = parseInt(process.env.PORT || '3000');
  config.environment = process.env.NODE_ENV || 'development';

  // MQTT configuration
  config.mqtt.host = process.env.MQTT_HOST || 'localhost';
  config.mqtt.port = parseInt(process.env.MQTT_PORT || '1883');
  config.mqtt.protocol = process.env.MQTT_PROTOCOL || 'mqtt';
  config.mqtt.username = process.env.MQTT_USERNAME;
  config.mqtt.password = process.env.MQTT_PASSWORD;
  config.mqtt.clientId =
    process.env.MQTT_CLIENT_ID || 'smtrack-logging-subscriber';
  config.mqtt.topics = process.env.MQTT_TOPICS?.split(',').map((s) =>
    s.trim(),
  ) || ['smtrack/+/logs'];
  config.mqtt.reconnectPeriod = parseInt(
    process.env.MQTT_RECONNECT_PERIOD || '5000',
  );
  config.mqtt.connectTimeout = parseInt(
    process.env.MQTT_CONNECT_TIMEOUT || '30000',
  );

  // Loki configuration
  config.loki.url = process.env.LOKI_URL || 'http://localhost:3100';
  config.loki.username = process.env.LOKI_USERNAME;
  config.loki.password = process.env.LOKI_PASSWORD;
  config.loki.batchSize = parseInt(process.env.LOKI_BATCH_SIZE || '10');
  config.loki.flushInterval = parseInt(
    process.env.LOKI_FLUSH_INTERVAL || '5000',
  );
  config.loki.timeout = parseInt(process.env.LOKI_TIMEOUT || '10000');

  return config;
});
