import { Module } from '@nestjs/common';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AuthController } from './src/presentation/controllers/auth.controller';
import { RegisterMemberHandler } from './src/application/commands/register-member/register-member.handler';
import { DynamoMemberRepository } from './src/infrastructure/repositories/dynamo-member.repository';
import { DynamoSeedMemberRepository } from './src/infrastructure/repositories/dynamo-seed-member.repository';
import { CognitoService } from './src/infrastructure/cognito/cognito.service';
import { MEMBER_REPOSITORY } from './src/domain/repositories/member.repository.interface';
import { SEED_MEMBER_REPOSITORY } from './src/domain/repositories/seed-member.repository.interface';
import {
  DYNAMODB_CLIENT,
  createDynamoDBDocumentClient,
} from './src/infrastructure/dynamo-client.factory';

/**
 * Members feature module.
 *
 * Wires together:
 *   - DynamoDB Document Client (singleton factory)
 *   - Repository implementations (DynamoDB adapters)
 *   - CognitoService (infrastructure)
 *   - RegisterMemberHandler (use case)
 *   - AuthController (presentation)
 *
 * Domain repository interfaces are bound to their DynamoDB implementations
 * via injection tokens (Symbol), keeping use cases independent of infrastructure.
 */
@Module({
  controllers: [AuthController],
  providers: [
    // DynamoDB client — singleton factory
    {
      provide: DYNAMODB_CLIENT,
      useFactory: (): DynamoDBDocumentClient => createDynamoDBDocumentClient(),
    },

    // Repository implementations
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

    // Infrastructure services
    CognitoService,

    // Use cases
    RegisterMemberHandler,
  ],
})
export class MembersModule {}
