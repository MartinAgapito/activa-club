import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MembersModule } from '../members.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';

/**
 * Local development entry point.
 *
 * Bootstraps the NestJS HTTP server for running the members service locally.
 * Use `npm run start:dev` to start on PORT (default 3001).
 *
 * API:     http://localhost:3001/v1
 * Swagger: http://localhost:3001/api/docs
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(MembersModule);

  // CORS must be the first middleware registered so it runs before guards,
  // pipes and exception filters — including OPTIONS preflight requests.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.setGlobalPrefix('v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('ActivaClub Members API')
    .setDescription('Member registration and authentication endpoints — local dev')
    .setVersion('1.0')
    .addTag('auth', 'Public authentication endpoints (registration + login)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`Members service running on http://localhost:${port}/v1`);
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
}

bootstrap();
