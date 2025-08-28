import { Module } from '@nestjs/common';
import { LokiService } from './loki.service';

@Module({
  providers: [LokiService],
  exports: [LokiService],
})
export class LokiModule {}
