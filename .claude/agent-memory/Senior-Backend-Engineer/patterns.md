# ActivaClub Backend - Patterns & Conventions

## Per-Service Setup Checklist
Each service under `services/<name>/` needs:
1. `package.json` (own dependencies, scripts: start:dev, start:lambda, build, test)
2. `tsconfig.json` + `tsconfig.build.json` (extends root, sets own outDir)
3. `src/main.ts` — local HTTP bootstrap (port from env)
4. `src/lambda.ts` — Lambda handler with cached bootstrap
5. `src/<name>.module.ts` — NestJS module importing domain features
6. `.env.example` — service-specific env vars
7. `README.md` — endpoint table, env table, local dev instructions

## DynamoDB Repository Pattern
```typescript
// domain/repositories/<entity>.repository.interface.ts
export interface MemberRepository {
  findById(id: string): Promise<Member | null>;
  save(member: Member): Promise<void>;
}

// infrastructure/repositories/<entity>.dynamo.repository.ts
export class MemberDynamoRepository implements MemberRepository {
  constructor(private readonly client: DynamoDBDocumentClient) {}
  // AWS SDK v3 Document Client calls only — never in use cases
}
```

## Use Case Pattern
```typescript
// application/commands/create-member.command.ts
export class CreateMemberCommand {
  constructor(private readonly repo: MemberRepository) {}
  async execute(dto: CreateMemberDto): Promise<Member> { ... }
}
```
Use cases receive repository interfaces via constructor — NEVER import DynamoDB directly.

## DynamoDB Key Convention (MembersTable)
PK: `MEMBER#<ulid>`, SK: `PROFILE`
GSI_DNI: PK = `dni`
GSI_Email: PK = `email`

## Swagger Decorator Pattern
```typescript
@ApiTags('Members')
@Controller('members')
export class MembersController {
  @ApiOperation({ summary: 'Get member by ID' })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  @ApiBearerAuth('cognito-jwt')
  @Get(':id')
  findOne(@Param('id') id: string) { ... }
}
```

## DTO Pattern
```typescript
export class CreateMemberDto {
  @ApiProperty({ example: '12345678' })
  @IsString()
  @IsNotEmpty()
  @Length(7, 10)
  dni: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}
```

## Environment Variable Names Per Service
- MEMBERS_TABLE_NAME
- RESERVATIONS_TABLE_NAME
- PAYMENTS_TABLE_NAME
- PROMOTIONS_TABLE_NAME
- GUESTS_TABLE_NAME
- AREAS_TABLE_NAME
All shared: DYNAMODB_REGION, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, AWS_REGION, ENV

## Test File Naming
- Use cases: `create-member.command.spec.ts`
- Repositories: `member.dynamo.repository.spec.ts`
- Filters/Guards: `global-exception.filter.spec.ts`, `roles.guard.spec.ts`
- Location: `test/unit/` mirroring src structure
