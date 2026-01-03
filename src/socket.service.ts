import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class SocketService {
  private connectedClients: Map<string, Set<string>> = new Map(); // matchId -> Set of clientIds

  handleConnection(client: Socket) {
    console.log(`New client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Remove client from all match rooms
    this.connectedClients.forEach((clients, matchId) => {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        client.leave(`match:${matchId}`);
      }
    });
    console.log(`Client disconnected: ${client.id}`);
  }

  joinMatch(client: Socket, matchId: string) {
    const room = `match:${matchId}`;
    client.join(room);
    
    if (!this.connectedClients.has(matchId)) {
      this.connectedClients.set(matchId, new Set());
    }
    this.connectedClients.get(matchId)?.add(client.id);
    
    console.log(`Client ${client.id} joined match ${matchId}`);
    client.emit('joined_match', { matchId, room });
  }

  leaveMatch(client: Socket, matchId: string) {
    const room = `match:${matchId}`;
    client.leave(room);
    
    this.connectedClients.get(matchId)?.delete(client.id);
    
    console.log(`Client ${client.id} left match ${matchId}`);
    client.emit('left_match', { matchId });
  }

  getConnectedClientsCount(matchId: string): number {
    return this.connectedClients.get(matchId)?.size || 0;
  }
}

