import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import serverlessExpress from '@vendia/serverless-express';
import { Handler, Context, Callback } from 'aws-lambda';
import { MembersModule } from '../../../members.module';
import { GlobalExceptionFilter } from '../../shared/filters/global-exception.filter';

/**
 * Cached serverless-express handler — reused across warm Lambda invocations.
 * Initialised on the first cold start, then held in the Lambda execution context.
 */
let cachedHandler: Handler;

async function bootstrap(): Promise<Handler> {
  const app = await NestFactory.create(MembersModule, {
    // Suppress NestJS startup logs in production; rely on Lambda Powertools
    logger: process.env.ENV === 'production' ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug'],
  });

  // ── Global prefix ──────────────────────────────────────────────────────────
  app.setGlobalPrefix('v1');

  // ── Global validation pipe ─────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown properties
      forbidNonWhitelisted: true, // Reject unknown properties with 400
      transform: true,           // Enable @Transform decorators
      transformOptions: {
        enableImplicitConversion: false, // Explicit types only
      },
    }),
  );

  // ── Global exception filter ────────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Swagger (disabled in production) ──────────────────────────────────────
  if (process.env.ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ActivaClub Members API')
      .setDescription('Member registration and authentication endpoints')
      .setVersion('1.0')
      .addTag('auth', 'Public authentication endpoints (registration + login)')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

/**
 * AWS Lambda entry point.
 *
 * On cold start: bootstraps the NestJS application and caches the handler.
 * On warm invocations: reuses the cached handler to avoid re-initialisation.
 */
export const handler: Handler = async (
  event: unknown,
  context: Context,
  callback: Callback,
) => {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }
  return cachedHandler(event, context, callback);
};
