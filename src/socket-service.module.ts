import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MatchGateway } from './redis/match.gateway';
import { RedisSubscriberService } from './redis/redis-subscriber.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  providers: [MatchGateway, RedisSubscriberService],
})
export class SocketServiceModule {}
