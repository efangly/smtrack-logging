import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthStatus } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthStatus {
    return this.healthService.getHealth();
  }

  @Get('live')
  getLiveness(): { status: string; timestamp: Date } {
    return {
      status: 'ok',
      timestamp: new Date(),
    };
  }

  @Get('ready')
  getReadiness(): { status: string; timestamp: Date } {
    const health = this.healthService.getHealth();

    return {
      status: health.status === 'error' ? 'not ready' : 'ready',
      timestamp: new Date(),
    };
  }
}
