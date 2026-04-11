import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { MatchGateway } from './redis/match.gateway';
import { RedisSubscriberService } from './redis/redis-subscriber.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database (for reading match data)
    MongooseModule.forRoot(
      process.env.MONGODB_URL || 'mongodb://localhost:27017/cricket_db',
    ),

    // Socket modules will be added here
  ],
  providers: [SocketGateway, SocketService, MatchGateway, RedisSubscriberService],
})
export class SocketServiceModule { }

