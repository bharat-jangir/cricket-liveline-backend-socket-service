import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SocketServiceModule } from './socket-service.module';

async function bootstrap() {
  const app = await NestFactory.create(SocketServiceModule);
  
  // Use Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // CORS configuration
  const origins = (process.env.FRONTEND_URL || '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = process.env.PORT || 5002;
  await app.listen(port, '0.0.0.0');
  
  console.log(`🔌 Socket Service is running on: http://localhost:${port}`);
}

bootstrap();

