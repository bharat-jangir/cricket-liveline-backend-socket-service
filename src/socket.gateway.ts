import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketService } from './socket.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/live',
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly socketService: SocketService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.socketService.handleConnection(client);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.socketService.handleDisconnect(client);
  }

  @SubscribeMessage('join_match')
  handleJoinMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    this.socketService.joinMatch(client, data.matchId);
  }

  @SubscribeMessage('leave_match')
  handleLeaveMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string },
  ) {
    this.socketService.leaveMatch(client, data.matchId);
  }

  // Method to emit live match updates (called from service)
  emitMatchUpdate(matchId: string, data: any) {
    this.server.to(`match:${matchId}`).emit('match_update', data);
  }

  // Method to emit ball-by-ball updates
  emitBallUpdate(matchId: string, ballData: any) {
    this.server.to(`match:${matchId}`).emit('ball_update', ballData);
  }

  // Method to emit scorecard updates
  emitScorecardUpdate(matchId: string, scorecardData: any) {
    this.server.to(`match:${matchId}`).emit('scorecard_update', scorecardData);
  }
}

