import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

export interface MatchUpdatePayload {
  matchId: string;
  type: 'BALL' | 'WICKET' | 'OVER_END' | 'MATCH_RESET';
  timestamp: Date;
  inning: {
    number: number;
    totalRuns: number;
    totalBalls: number;
    wickets: number;
    overs: number;
    runRate: number;
  };
  striker?: {
    playerId: string;
    runs: number;
    balls: number;
    strikeRate: number;
  };
  bowler?: {
    playerId: string;
    overs: number;
    runs: number;
    wickets: number;
    economy: number;
  };
  lastBall?: {
    runs: number;
    extras: number;
    isWicket: boolean;
    ballType: string;
  };
}

@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private client: RedisClientType;
  private isConnected = false;
  private messageHandler: (payload: MatchUpdatePayload) => void;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0'),
      socket: {
        connectTimeout: 5000,
      },
    });
    
    this.client.on('error', (err) => {
      this.logger.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      this.logger.warn('Redis client disconnected');
      this.isConnected = false;
    });
  }

  setMessageHandler(handler: (payload: MatchUpdatePayload) => void) {
    this.messageHandler = handler;
  }

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    try {
      await this.client.connect();
      await this.subscribeToMatches();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async subscribeToMatches() {
    try {
      await this.client.pSubscribe('match:*:ball', (message, channel) => {
        this.handleMatchUpdate(message, channel);
      });
      this.logger.log('Subscribed to match updates pattern: match:*:ball');
    } catch (error) {
      this.logger.error('Failed to subscribe to Redis channels:', error);
    }
  }

  private handleMatchUpdate(message: string, channel: string) {
    try {
      const payload: MatchUpdatePayload = JSON.parse(message);
      this.logger.debug(`Received update for match ${payload.matchId}: ${payload.type}`);

      if (this.messageHandler) {
        this.messageHandler(payload);
      }
    } catch (error) {
      this.logger.error('Failed to process match update:', error);
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.client.quit();
    }
  }
}