import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MqttModule } from '../mqtt/mqtt.module';
import { LokiModule } from '../loki/loki.module';

@Module({
  imports: [MqttModule, LokiModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
