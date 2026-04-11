import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SocketServiceModule } from './socket-service.module';

async function bootstrap() {
  const app = await NestFactory.create(SocketServiceModule);
  
  // Use Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // CORS configuration
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT || 3002;
  await app.listen(port, '0.0.0.0');
  
  console.log(`🔌 Socket Service is running on: http://localhost:${port}`);
}

bootstrap();

