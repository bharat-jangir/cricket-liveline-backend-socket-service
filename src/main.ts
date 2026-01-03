import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SocketServiceModule } from './socket-service.module';

async function bootstrap() {
  const app = await NestFactory.create(SocketServiceModule);
  
  // Use Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  const port = process.env.PORT || 3002;
  await app.listen(port);
  
  console.log(`🔌 Socket Service is running on: http://localhost:${port}`);
}

bootstrap();

