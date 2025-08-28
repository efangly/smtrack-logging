import { Module } from '@nestjs/common';
import { MqttSubscriberService } from './mqtt-subscriber.service';
import { MqttController } from './mqtt.controller';
import { LokiModule } from '../loki/loki.module';

@Module({
  imports: [LokiModule],
  controllers: [MqttController],
  providers: [MqttSubscriberService],
  exports: [MqttSubscriberService],
})
export class MqttModule {}
