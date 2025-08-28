import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    const port = configService.get<number>('app.port') || 3000;

    await app.listen(port);

    logger.log(`SMtrack Logging Service is running on: http://localhost:${port}`);
    logger.log(`Health check available at: http://localhost:${port}/mqtt/status`);
    logger.log(`Environment: ${configService.get<string>('app.environment')}`);
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
