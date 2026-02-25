import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import serverlessExpress from '@vendia/serverless-express';
import { Handler, Context, Callback } from 'aws-lambda';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';

/**
 * Cached Lambda handler.
 *
 * The NestJS application is bootstrapped once per Lambda container (cold start)
 * and reused across warm invocations. The handler is cached in module scope to
 * avoid re-initialising the application on every request.
 */
let cachedHandler: Handler;

async function bootstrapLambda(): Promise<Handler> {
  const app = await NestFactory.create(AppModule, {
    // Disable NestJS logger in Lambda — use structured logging via @libs/logging
    logger: process.env.ENV === 'prod' ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug'],
  });

  // Global prefix for all routes
  app.setGlobalPrefix('v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter — consistent error response shape
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // Swagger setup (available even in Lambda for API Gateway integration)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ActivaClub API')
    .setDescription('ActivaClub backend REST API — NestJS on AWS Lambda')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'AWS Cognito JWT token',
      },
      'cognito-jwt',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

/**
 * AWS Lambda handler entry point.
 *
 * Export name must match the `handler` property in the Lambda configuration
 * (e.g. Terraform resource or serverless.yml).
 *
 * Convention used across all ActivaClub services:
 *   handler: "dist/src/lambda.handler"
 */
export const handler: Handler = async (event: unknown, context: Context, callback: Callback) => {
  // Reuse the cached handler across warm Lambda invocations
  if (!cachedHandler) {
    cachedHandler = await bootstrapLambda();
  }

  // Prevent Lambda from waiting for the event loop to drain
  context.callbackWaitsForEmptyEventLoop = false;

  return cachedHandler(event, context, callback);
};
