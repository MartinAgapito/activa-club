import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ReservationsModule } from '../reservations.module';
import { GlobalExceptionFilter } from './infrastructure/shared/filters/global-exception.filter';

/**
 * Local development entry point.
 *
 * Bootstraps the NestJS HTTP server for running the reservations service locally.
 * Use `npm run start:dev` to start on PORT (default 3002).
 *
 * API:     http://localhost:3002/v1
 * Swagger: http://localhost:3002/api/docs
 *
 * AC-011 endpoint: GET /v1/areas/{areaId}/availability?date=YYYY-MM-DD
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ReservationsModule);

  // CORS — allow local frontend dev server
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

  const config = new DocumentBuilder()
    .setTitle('ActivaClub Reservations API')
    .setDescription('Reservation management and area availability endpoints — EP-02')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'cognito-jwt')
    .addTag('reservations', 'Member reservation endpoints (AC-011, AC-012, AC-013, AC-014)')
    .addTag('manager', 'Manager reservation management endpoints (AC-015)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3002;
  await app.listen(port);

  console.log(`Reservations service running on http://localhost:${port}/v1`);
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
  console.log(`AC-011: GET http://localhost:${port}/v1/areas/{areaId}/availability?date=YYYY-MM-DD`);
}

bootstrap();
