import { Module } from '@nestjs/common';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Controllers
import { AuthController } from './src/presentation/controllers/auth.controller';

// Use case handlers
import { RegisterMemberHandler } from './src/application/commands/register-member/register-member.handler';
import { VerifyEmailHandler } from './src/application/commands/verify-email/verify-email.handler';
import { ResendCodeHandler } from './src/application/commands/resend-code/resend-code.handler';
import { LoginHandler } from './src/application/commands/login/login.handler';
import { VerifyOtpHandler } from './src/application/commands/verify-otp/verify-otp.handler';
import { LogoutHandler } from './src/application/commands/logout/logout.handler';

// Infrastructure
import { DynamoMemberRepository } from './src/infrastructure/repositories/dynamo-member.repository';
import { DynamoSeedMemberRepository } from './src/infrastructure/repositories/dynamo-seed-member.repository';
import { CognitoService } from './src/infrastructure/cognito/cognito.service';
import {
  DYNAMODB_CLIENT,
  createDynamoDBDocumentClient,
} from './src/infrastructure/dynamo-client.factory';

// Domain repository tokens
import { MEMBER_REPOSITORY } from './src/domain/repositories/member.repository.interface';
import { SEED_MEMBER_REPOSITORY } from './src/domain/repositories/seed-member.repository.interface';

/**
 * Members feature module — AC-001 Rev2 + AC-002.
 *
 * Wires together:
 *   - DynamoDB Document Client (singleton factory)
 *   - Repository implementations (DynamoDB adapters)
 *   - CognitoService (infrastructure)
 *   - Use case handlers (application layer)
 *   - AuthController (presentation)
 *
 * Domain repository interfaces are bound to their DynamoDB implementations
 * via injection tokens (Symbol), keeping use cases independent of infrastructure.
 */
@Module({
  controllers: [AuthController],
  providers: [
    // ── DynamoDB client — singleton factory ────────────────────────────────
    {
      provide: DYNAMODB_CLIENT,
      useFactory: (): DynamoDBDocumentClient => createDynamoDBDocumentClient(),
    },

    // ── Repository implementations ─────────────────────────────────────────
    {
      provide: MEMBER_REPOSITORY,
      useFactory: (client: DynamoDBDocumentClient) => new DynamoMemberRepository(client),
      inject: [DYNAMODB_CLIENT],
    },
    {
      provide: SEED_MEMBER_REPOSITORY,
      useFactory: (client: DynamoDBDocumentClient) => new DynamoSeedMemberRepository(client),
      inject: [DYNAMODB_CLIENT],
    },

    // ── Infrastructure services ────────────────────────────────────────────
    CognitoService,

    // ── AC-001 Rev2 use cases ──────────────────────────────────────────────
    RegisterMemberHandler,
    VerifyEmailHandler,
    ResendCodeHandler,

    // ── AC-002 use cases ───────────────────────────────────────────────────
    LoginHandler,
    VerifyOtpHandler,

    // ── AC-008 use cases ───────────────────────────────────────────────────
    LogoutHandler,
  ],
})
export class MembersModule {}
