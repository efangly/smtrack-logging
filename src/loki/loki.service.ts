import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { LogEntry, LokiStream, LokiPushRequest } from '../types';
import configuration from '../config/configuration';

@Injectable()
export class LokiService implements OnModuleDestroy {
  private readonly logger = new Logger(LokiService.name);
  private readonly httpClient: AxiosInstance;
  private logBuffer: LogEntry[] = [];
  private intervalId?: NodeJS.Timeout;
  private lastFlush?: Date;
  private lastError?: string;
  private isShuttingDown = false;

  constructor(
    @Inject(configuration.KEY)
    private readonly config: ConfigType<typeof configuration>,
  ) {
    this.httpClient = this.createHttpClient();
    this.startBatchProcessing();
  }

  private createHttpClient(): AxiosInstance {
    const lokiConfig = this.config.loki;
    const client = axios.create({
      baseURL: lokiConfig.url,
      timeout: lokiConfig.timeout,
      headers: { 'Content-Type': 'application/json' },
    });

    // Add authentication if configured
    if (lokiConfig.username && lokiConfig.password) {
      client.defaults.auth = {
        username: lokiConfig.username,
        password: lokiConfig.password,
      };
    }

    // Add request/response interceptors for better error handling
    client.interceptors.request.use(
      (config) => {
        this.logger.debug(
          `Sending request to Loki: ${config.method?.toUpperCase()} ${config.url}`,
        );
        return config;
      },
      (error) => {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Request error: ${message}`);
        return Promise.reject(error);
      },
    );

    client.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `Loki response: ${response.status} ${response.statusText}`,
        );
        return response;
      },
      (error: AxiosError) => {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const message = error.response?.data || error.message;
        this.logger.error(
          `Loki API error: ${status} ${statusText} - ${JSON.stringify(message)}`,
        );
        return Promise.reject(error);
      },
    );

    return client;
  }

  async pushLog(entry: LogEntry): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Service is shutting down, rejecting new logs');
      return;
    }

    // Validate log entry
    if (!entry.message || !entry.device_id || !entry.severity) {
      this.logger.warn('Invalid log entry, skipping', entry);
      return;
    }

    this.logBuffer.push({
      ...entry,
      timestamp: entry.timestamp || new Date(),
    });

    if (this.logBuffer.length >= this.config.loki.batchSize) {
      await this.flushLogs();
    }
  }

  async pushLogs(entries: LogEntry[]): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Service is shutting down, rejecting new logs');
      return;
    }

    // Validate and filter invalid entries
    const validEntries = entries
      .filter((entry) => {
        if (!entry.message || !entry.device_id || !entry.severity) {
          this.logger.warn('Invalid log entry, skipping', entry);
          return false;
        }
        return true;
      })
      .map((entry) => ({
        ...entry,
        timestamp: entry.timestamp || new Date(),
      }));

    this.logBuffer.push(...validEntries);

    if (this.logBuffer.length >= this.config.loki.batchSize) {
      await this.flushLogs();
    }
  }

  private startBatchProcessing(): void {
    this.intervalId = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      if (this.logBuffer.length > 0 && !this.isShuttingDown) {
        void this.flushLogs();
      }
    }, this.config.loki.flushInterval);
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const lokiRequest = this.convertToLokiFormat(logsToSend);
      await this.sendToLoki(lokiRequest);
      this.lastFlush = new Date();
      this.lastError = undefined;
      this.logger.log(`Successfully sent ${logsToSend.length} logs to Loki`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.lastError = errorMessage;
      this.logger.error(`Failed to send logs to Loki: ${errorMessage}`);

      // Put logs back to buffer for retry (but limit buffer size to prevent memory issues)
      if (this.logBuffer.length < 1000) {
        this.logBuffer.unshift(...logsToSend);
      } else {
        this.logger.warn(`Log buffer full, dropping ${logsToSend.length} logs`);
      }
    }
  }

  private convertToLokiFormat(entries: LogEntry[]): LokiPushRequest {
    // Group logs by labels to create streams
    const streamMap = new Map<string, LogEntry[]>();

    entries.forEach((entry) => {
      const labels = {
        severity: entry.severity,
        device_id: entry.device_id,
        ...entry.labels,
      };

      const streamKey = JSON.stringify(labels);
      if (!streamMap.has(streamKey)) {
        streamMap.set(streamKey, []);
      }
      streamMap.get(streamKey)!.push(entry);
    });

    // Convert to Loki format
    const streams: LokiStream[] = [];

    streamMap.forEach((logs, streamKey) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const labels = JSON.parse(streamKey);

      const values: Array<[string, string]> = logs.map((log) => {
        // Convert timestamp to nanoseconds for Loki
        const timestamp = log.timestamp || new Date();
        const nanoseconds = (timestamp.getTime() * 1000000).toString();
        return [nanoseconds, log.message];
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      streams.push({ stream: labels, values });
    });

    return { streams };
  }

  private async sendToLoki(request: LokiPushRequest): Promise<void> {
    try {
      const response = await this.httpClient.post('/loki/api/v1/push', request);

      if (response.status !== 204) {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = error.response?.data;
        throw new Error(`Loki API error: ${status} - ${JSON.stringify(data)}`);
      }
      throw error;
    }
  }

  // Health check methods
  getStatus(): {
    status: string;
    bufferedLogs: number;
    lastFlush?: Date;
    lastError?: string;
  } {
    return {
      status: this.lastError ? 'error' : 'active',
      bufferedLogs: this.logBuffer.length,
      lastFlush: this.lastFlush,
      lastError: this.lastError,
    };
  }

  // Force flush for testing or immediate sending
  async forceFlush(): Promise<void> {
    await this.flushLogs();
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Flush remaining logs before shutdown with timeout
    if (this.logBuffer.length > 0) {
      this.logger.log(
        `Flushing ${this.logBuffer.length} remaining logs before shutdown`,
      );
      try {
        await Promise.race([
          this.flushLogs(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Flush timeout')), 5000),
          ),
        ]);
      } catch (error) {
        this.logger.error(
          `Failed to flush logs during shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }
}
