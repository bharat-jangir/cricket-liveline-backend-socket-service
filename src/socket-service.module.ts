import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database (for reading match data)
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/cricket_db',
    ),

    // Socket modules will be added here
  ],
  providers: [SocketGateway, SocketService],
})
export class SocketServiceModule {}

