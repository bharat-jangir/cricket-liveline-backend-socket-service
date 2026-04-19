import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

// ─────────────────────────────────────────────────────────────────────────────
// Shared payload types (mirrored from main-app redis-publisher.service.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface TeamMeta {
  teamId: string;
  name: string;
  code: string;
  score: string;
  overs: string;
}

export interface MatchUpdatePayload {
  matchId: string;
  type: 'BALL' | 'WICKET' | 'OVER_END' | 'MATCH_RESET';
  timestamp: Date;
  
  // Root-level generalized fields (for scoreUpdate)
  score?: string;
  overs?: string | number;
  runRate?: number;
  currentBall?: string;
  currentInning?: number;
  currentStrikerId?: string;
  currentNonStrikerId?: string;
  currentBowlerId?: string;

  inning: {
    number: number;
    totalRuns: number;
    totalBalls: number;
    wickets: number;
    overs: number;
    runRate: number;
    extras: number;
  };
  striker?: {
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number;
  };
  nonStriker?: {
    playerId: string;
    name: string;
    runs: number;
    balls: number;
  };
  bowler?: {
    playerId: string;
    name: string;
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
    ballLabel: string;
  };
  teamA: TeamMeta;
  teamB: TeamMeta;
  target?: number;
  requiredRunRate?: number;
  requiredRuns?: number;
  remainingBalls?: number;
  recentBalls?: any[];
}

export interface InningChangePayload {
  matchId: string;
  inningNumber: number;
  battingTeamId: string;
  bowlingTeamId: string;
  timestamp: Date;
}

export interface OddsSessionPayload {
  matchId: string;
  oddsTeam?: string;
  oddsBlue?: number | string;
  oddsRed?: number | string;
  session?: number | string;
  sessionBlue?: number | string;
  sessionRed?: number | string;
  lambi?: number | string;
  lambiBlue?: number | string;
  lambiRed?: number | string;
  timestamp: Date;
}

export interface PowerplayUpdatePayload {
  matchId: string;
  powerplayOvers?: string;
  onOC?: boolean;
  timestamp: Date;
}

export interface ListingUpdatePayload {
  matchId: string;
  teamA: TeamMeta;
  teamB: TeamMeta;
  status: string;
  currentInning: number;
  runRate: number;
  requiredRunRate?: number;
  lastBallLabel: string;
  timestamp: Date;
}

export interface ScorecardDeltaPayload {
  matchId: string;
  inningNumber: number;
  batting: {
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number;
    isOut: boolean;
    dismissalText?: string;
    isOnStrike: boolean;
  }[];
  bowling: {
    playerId: string;
    name: string;
    overs: number;
    runs: number;
    wickets: number;
    economy: number;
    isCurrent: boolean;
  }[];
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
    penalties: number;
    total: number;
  };
  totalRuns: number;
  wickets: number;
  timestamp: Date;
}

export interface CommentaryPayload {
  matchId: string;
  inningNumber: number;
  overNumber: number;
  ballLabel: string;
  ballType: string;
  commentary: string;
  runs: number;
  extras: number;
  isWicket: boolean;
  batsmanName: string;
  batsmanId?: string;
  bowlerName: string;
  bowlerId?: string;
  highlightData?: any;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler types
// ─────────────────────────────────────────────────────────────────────────────

export type MatchUpdateHandler = (payload: MatchUpdatePayload) => void;
export type ListingUpdateHandler = (payload: ListingUpdatePayload) => void;
export type ScorecardDeltaHandler = (payload: ScorecardDeltaPayload) => void;
export type CommentaryHandler = (payload: CommentaryPayload) => void;
export type InningChangeHandler = (payload: InningChangePayload) => void;
export type OddsSessionHandler = (payload: OddsSessionPayload) => void;
export type PowerplayUpdateHandler = (payload: PowerplayUpdatePayload) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private client: RedisClientType;
  private isConnected = false;

  // Handlers set by gateway after init
  private matchUpdateHandler: MatchUpdateHandler;
  private listingUpdateHandler: ListingUpdateHandler;
  private scorecardDeltaHandler: ScorecardDeltaHandler;
  private commentaryHandler: CommentaryHandler;
  private inningChangeHandler: InningChangeHandler;
  private oddsSessionHandler: OddsSessionHandler;
  private powerplayUpdateHandler: PowerplayUpdateHandler;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0'),
      socket: { connectTimeout: 5000 },
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

  // ── Handler registration ─────────────────────────────────────────────────

  setMatchUpdateHandler(handler: MatchUpdateHandler) {
    this.matchUpdateHandler = handler;
  }

  setListingUpdateHandler(handler: ListingUpdateHandler) {
    this.listingUpdateHandler = handler;
  }

  setScorecardDeltaHandler(handler: ScorecardDeltaHandler) {
    this.scorecardDeltaHandler = handler;
  }

  setCommentaryHandler(handler: CommentaryHandler) {
    this.commentaryHandler = handler;
  }

  setInningChangeHandler(handler: InningChangeHandler) {
    this.inningChangeHandler = handler;
  }

  setOddsSessionHandler(handler: OddsSessionHandler) {
    this.oddsSessionHandler = handler;
  }

  setPowerplayUpdateHandler(handler: PowerplayUpdateHandler) {
    this.powerplayUpdateHandler = handler;
  }

  /** @deprecated Use setMatchUpdateHandler */
  setMessageHandler(handler: MatchUpdateHandler) {
    this.setMatchUpdateHandler(handler);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    try {
      await this.client.connect();
      await this.subscribeToChannels();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async subscribeToChannels() {
    try {
      // Per-match ball events  →  match:{matchId}:ball
      await this.client.pSubscribe('match:*:ball', (message, channel) => {
        this.handleMatchUpdate(message, channel);
      });

      // Global listing updates  →  live-match:listing
      await this.client.subscribe('live-match:listing', (message) => {
        this.handleListingUpdate(message);
      });

      // Per-match scorecard delta  →  match:{matchId}:scorecard
      await this.client.pSubscribe('match:*:scorecard', (message) => {
        this.handleScorecardDelta(message);
      });

      // Per-match commentary  →  match:{matchId}:commentary
      await this.client.pSubscribe('match:*:commentary', (message) => {
        this.handleCommentary(message);
      });

      // Per-match inning change  →  match:{matchId}:inning
      await this.client.pSubscribe('match:*:inning', (message) => {
        this.handleInningChange(message);
      });

      // Per-match odds/session  →  match:{matchId}:odds
      await this.client.pSubscribe('match:*:odds', (message) => {
        this.handleOddsSession(message);
      });

      // Per-match powerplay  →  match:{matchId}:powerplay
      await this.client.pSubscribe('match:*:powerplay', (message) => {
        this.handlePowerplayUpdate(message);
      });

      this.logger.log('Subscribed to all Redis channels');
    } catch (error) {
      this.logger.error('Failed to subscribe to Redis channels:', error);
    }
  }

  // ── Message handlers ─────────────────────────────────────────────────────

  private handleMatchUpdate(message: string, channel: string) {
    try {
      const payload: MatchUpdatePayload = JSON.parse(message);
      this.logger.debug(`[match:ball] matchId=${payload.matchId} type=${payload.type}`);
      if (this.matchUpdateHandler) {
        this.matchUpdateHandler(payload);
      }
    } catch (error) {
      this.logger.error('Failed to process match update:', error);
    }
  }

  private handleListingUpdate(message: string) {
    try {
      const payload: ListingUpdatePayload = JSON.parse(message);
      this.logger.debug(`[listing] matchId=${payload.matchId}`);
      if (this.listingUpdateHandler) {
        this.listingUpdateHandler(payload);
      }
    } catch (error) {
      this.logger.error('Failed to process listing update:', error);
    }
  }

  private handleScorecardDelta(message: string) {
    try {
      const payload: ScorecardDeltaPayload = JSON.parse(message);
      this.logger.debug(`[scorecard] matchId=${payload.matchId} inning=${payload.inningNumber}`);
      if (this.scorecardDeltaHandler) {
        this.scorecardDeltaHandler(payload);
      }
    } catch (error) {
      this.logger.error('Failed to process scorecard delta:', error);
    }
  }

  private handleCommentary(message: string) {
    try {
      const payload: CommentaryPayload = JSON.parse(message);
      this.logger.debug(`[commentary] matchId=${payload.matchId}`);
      if (this.commentaryHandler) {
        this.commentaryHandler(payload);
      }
    } catch (error) {
      this.logger.error('Failed to process commentary:', error);
    }
  }

  private handleInningChange(message: string) {
    try {
      const payload: InningChangePayload = JSON.parse(message);
      this.logger.debug(`[inning] matchId=${payload.matchId}`);
      if (this.inningChangeHandler) {
        this.inningChangeHandler(payload);
      }
    } catch (error) {
      this.logger.error('Failed to process inning change:', error);
    }
  }

  private handleOddsSession(message: string) {
    try {
      const payload: OddsSessionPayload = JSON.parse(message);
      this.logger.debug(`[odds] matchId=${payload.matchId}`);
      if (this.oddsSessionHandler) {
        this.oddsSessionHandler(payload);
      }
    } catch (error) {
      this.logger.error('Failed to process odds/session update:', error);
    }
  }

  private handlePowerplayUpdate(message: string) {
    try {
      const payload: PowerplayUpdatePayload = JSON.parse(message);
      this.logger.debug(`[powerplay] matchId=${payload.matchId}`);
      if (this.powerplayUpdateHandler) {
        this.powerplayUpdateHandler(payload);
      }
    } catch (error) {
      this.logger.error('Failed to process powerplay update:', error);
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.client.quit();
    }
  }
}