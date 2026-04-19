import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import {
  MatchUpdatePayload,
  ListingUpdatePayload,
  ScorecardDeltaPayload,
  CommentaryPayload,
  RedisSubscriberService,
} from './redis-subscriber.service';

const LISTING_ROOM = 'live-matches';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
  namespace: '/live',
})
export class MatchGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MatchGateway.name);

  /** clientId → matchId (for cleanup on disconnect) */
  private readonly clientMatchMap = new Map<string, string>();

  /** clientId → true if watching listing */
  private readonly listingClients = new Set<string>();

  constructor(private readonly redisSubscriber: RedisSubscriberService) { }

  afterInit() {
    // ── match:*:ball → scoreUpdate / match_reset ──────────────────────────────
    this.redisSubscriber.setMatchUpdateHandler((payload: MatchUpdatePayload) => {
      // Unified: Always emit scoreUpdate. UNDO/Reset events are marked by type 'BALL' and currentBall 'confirming'
      this.emitToMatchRoom(payload.matchId, 'scoreUpdate', payload);
      this.logger.debug(`[scoreUpdate]: matchId=${payload.matchId} runs=${payload.inning.totalRuns} type=${payload.type}`);
    });

    // ── match:*:inning → inning_change ────────────────────────────────────────
    this.redisSubscriber.setInningChangeHandler((payload) => {
      this.emitToMatchRoom(payload.matchId, 'inning_change', payload);
    });

    // ── match:*:odds → session_odds_update ─────────────────────────────────────
    this.redisSubscriber.setOddsSessionHandler((payload) => {
      this.emitToMatchRoom(payload.matchId, 'session_odds_update', payload);
    });

    // ── match:*:powerplay → powerplay_update ────────────────────────────────────
    this.redisSubscriber.setPowerplayUpdateHandler((payload) => {
      this.emitToMatchRoom(payload.matchId, 'powerplay_update', payload);
    });

    // ── live-match:listing → listing_update ───────────────────────────────
    this.redisSubscriber.setListingUpdateHandler((payload: ListingUpdatePayload) => {
      this.server.to(LISTING_ROOM).emit('listing_update', payload);
      this.logger.debug(`[listing_update] matchId=${payload.matchId}`);
    });

    // ── match:*:scorecard → scorecard_delta ───────────────────────────────
    this.redisSubscriber.setScorecardDeltaHandler((payload: ScorecardDeltaPayload) => {
      this.emitToMatchRoom(payload.matchId, 'scorecard_delta', payload);
    });

    // ── match:*:commentary → commentary_added ─────────────────────────────
    this.redisSubscriber.setCommentaryHandler((payload: CommentaryPayload) => {
      this.emitToMatchRoom(payload.matchId, 'commentary_added', payload);
    });

    this.logger.log('MatchGateway initialized — all Redis handlers registered');
  }

  // ── Connection lifecycle ─────────────────────────────────────────────────

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Clean up match room membership
    const matchId = this.clientMatchMap.get(client.id);
    if (matchId) {
      client.leave(`match:${matchId}`);
      this.clientMatchMap.delete(client.id);
    }

    // Clean up listing room membership
    if (this.listingClients.has(client.id)) {
      client.leave(LISTING_ROOM);
      this.listingClients.delete(client.id);
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ── Match Room events ─────────────────────────────────────────────────────

  @SubscribeMessage('join_match')
  handleJoinMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    const { matchId } = data;

    // Leave previous match room if switching
    const prevMatchId = this.clientMatchMap.get(client.id);
    if (prevMatchId && prevMatchId !== matchId) {
      client.leave(`match:${prevMatchId}`);
      this.logger.debug(`Client ${client.id} left previous match ${prevMatchId}`);
    }

    client.join(`match:${matchId}`);
    this.clientMatchMap.set(client.id, matchId);

    this.logger.log(`Client ${client.id} joined match:${matchId}`);
    client.emit('match_joined', { matchId, success: true });
  }

  @SubscribeMessage('leave_match')
  handleLeaveMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    const { matchId } = data;
    client.leave(`match:${matchId}`);
    this.clientMatchMap.delete(client.id);

    this.logger.log(`Client ${client.id} left match:${matchId}`);
    client.emit('match_left', { matchId, success: true });
  }

  // ── Listing Room events ───────────────────────────────────────────────────

  @SubscribeMessage('join_live_listing')
  handleJoinLiveListing(@ConnectedSocket() client: Socket) {
    client.join(LISTING_ROOM);
    this.listingClients.add(client.id);
    this.logger.log(`Client ${client.id} joined ${LISTING_ROOM}`);
    client.emit('listing_joined', { room: LISTING_ROOM, success: true });
  }

  @SubscribeMessage('leave_live_listing')
  handleLeaveLiveListing(@ConnectedSocket() client: Socket) {
    client.leave(LISTING_ROOM);
    this.listingClients.delete(client.id);
    this.logger.log(`Client ${client.id} left ${LISTING_ROOM}`);
    client.emit('listing_left', { room: LISTING_ROOM, success: true });
  }

  // ── Emit helpers ──────────────────────────────────────────────────────────

  private emitToMatchRoom(matchId: string, event: string, payload: any) {
    const room = `match:${matchId}`;
    this.server.to(room).emit(event, payload);
    this.logger.debug(`Emitted '${event}' to ${room}`);
  }
}