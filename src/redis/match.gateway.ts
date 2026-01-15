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
import { MatchUpdatePayload, RedisSubscriberService } from './redis-subscriber.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/live',
})
export class MatchGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MatchGateway.name);
  private readonly clientMatchMap = new Map<string, string>();

  constructor(private redisSubscriber: RedisSubscriberService) {}

  afterInit() {
    this.redisSubscriber.setMessageHandler((payload) => {
      if (payload.type === 'MATCH_RESET') {
        this.emitMatchReset(payload.matchId, payload);
      } else {
        this.emitMatchUpdate(payload.matchId, payload);
      }
    });
  } // clientId -> matchId

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const matchId = this.clientMatchMap.get(client.id);
    if (matchId) {
      client.leave(`match:${matchId}`);
      this.clientMatchMap.delete(client.id);
      this.logger.log(`Client ${client.id} left match ${matchId}`);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_match')
  handleJoinMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    const { matchId } = data;
    
    // Leave previous match if any
    const previousMatchId = this.clientMatchMap.get(client.id);
    if (previousMatchId) {
      client.leave(`match:${previousMatchId}`);
    }

    // Join new match room
    client.join(`match:${matchId}`);
    this.clientMatchMap.set(client.id, matchId);
    
    this.logger.log(`Client ${client.id} joined match ${matchId}`);
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
    
    this.logger.log(`Client ${client.id} left match ${matchId}`);
    client.emit('match_left', { matchId, success: true });
  }

  // Called by Redis Subscriber
  emitMatchUpdate(matchId: string, payload: MatchUpdatePayload) {
    const room = `match:${matchId}`;
    const clientCount = this.server?.sockets?.adapter?.rooms?.get(room)?.size || 0;
    
    if (clientCount > 0) {
      this.server.to(room).emit('match_update', payload);
      this.logger.debug(`Emitted match_update to ${clientCount} clients in ${room}`);
    }
  }

  // Called by Redis Subscriber for UNDO operations
  emitMatchReset(matchId: string, payload: MatchUpdatePayload) {
    const room = `match:${matchId}`;
    const clientCount = this.server?.sockets?.adapter?.rooms?.get(room)?.size || 0;
    
    if (clientCount > 0) {
      this.server.to(room).emit('match_reset', payload);
      this.logger.debug(`Emitted match_reset to ${clientCount} clients in ${room}`);
    }
  }
}