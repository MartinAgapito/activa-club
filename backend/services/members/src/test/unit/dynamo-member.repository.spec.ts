import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoMemberRepository } from '../../infrastructure/repositories/dynamo-member.repository';
import { MemberEntity } from '../../domain/entities/member.entity';
import { MembershipType } from '../../domain/value-objects/membership-type.vo';
import { AccountStatus } from '../../domain/value-objects/account-status.vo';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TABLE_NAME = 'MembersTable-test';

const DYNAMO_ITEM = {
  pk: 'MEMBER#01JKZP7QR8S9T0UVWX1YZ2AB3C',
  sk: 'PROFILE',
  member_id: '01JKZP7QR8S9T0UVWX1YZ2AB3C',
  dni: '20345678',
  full_name: 'Martin Garcia',
  email: 'martin.garcia@email.com',
  phone: '+5491112345678',
  membership_type: 'Gold',
  account_status: 'active',
  cognito_user_id: 'cognito-sub-uuid-1234',
  created_at: '2026-02-20T15:30:00.000Z',
  updated_at: '2026-02-20T15:30:00.000Z',
};

const MEMBER_ENTITY = new MemberEntity({
  memberId: '01JKZP7QR8S9T0UVWX1YZ2AB3C',
  dni: '20345678',
  fullName: 'Martin Garcia',
  email: 'martin.garcia@email.com',
  phone: '+5491112345678',
  membershipType: MembershipType.GOLD,
  accountStatus: AccountStatus.ACTIVE,
  cognitoUserId: 'cognito-sub-uuid-1234',
  createdAt: '2026-02-20T15:30:00.000Z',
  updatedAt: '2026-02-20T15:30:00.000Z',
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DynamoMemberRepository', () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);
  let repository: DynamoMemberRepository;

  beforeEach(() => {
    ddbMock.reset();
    process.env.MEMBERS_TABLE_NAME = TABLE_NAME;
    repository = new DynamoMemberRepository(ddbMock as unknown as DynamoDBDocumentClient);
  });

  afterAll(() => {
    delete process.env.MEMBERS_TABLE_NAME;
  });

  // ── findByDni ───────────────────────────────────────────────────────────────

  describe('findByDni', () => {
    it('returns a MemberEntity when the DNI exists', async () => {
      // First call: Query on GSI_DNI returns keys
      ddbMock.on(QueryCommand).resolves({
        Items: [{ pk: DYNAMO_ITEM.pk, sk: DYNAMO_ITEM.sk }],
        Count: 1,
      });

      // Second call: GetItem fetches the full item
      ddbMock.on(GetCommand).resolves({
        Item: DYNAMO_ITEM,
      });

      const result = await repository.findByDni('20345678');

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(MemberEntity);
      expect(result!.memberId).toBe(DYNAMO_ITEM.member_id);
      expect(result!.email).toBe(DYNAMO_ITEM.email);
      expect(result!.membershipType).toBe(MembershipType.GOLD);
      expect(result!.accountStatus).toBe(AccountStatus.ACTIVE);
    });

    it('returns null when no record matches the DNI', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [], Count: 0 });

      const result = await repository.findByDni('99999999');

      expect(result).toBeNull();
    });

    it('calls QueryCommand with GSI_DNI index and correct parameters', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [], Count: 0 });

      await repository.findByDni('20345678');

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls).toHaveLength(1);

      const input = calls[0].args[0].input;
      expect(input.TableName).toBe(TABLE_NAME);
      expect(input.IndexName).toBe('GSI_DNI');
      expect(input.KeyConditionExpression).toBe('dni = :dni');
      expect(input.ExpressionAttributeValues).toEqual({ ':dni': '20345678' });
    });
  });

  // ── findByEmail ─────────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('returns a MemberEntity when the email exists', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [{ pk: DYNAMO_ITEM.pk, sk: DYNAMO_ITEM.sk }],
        Count: 1,
      });

      ddbMock.on(GetCommand).resolves({
        Item: DYNAMO_ITEM,
      });

      const result = await repository.findByEmail('martin.garcia@email.com');

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(MemberEntity);
      expect(result!.email).toBe(DYNAMO_ITEM.email);
    });

    it('returns null when no record matches the email', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [], Count: 0 });

      const result = await repository.findByEmail('nonexistent@email.com');

      expect(result).toBeNull();
    });

    it('calls QueryCommand with GSI_Email index and correct parameters', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [], Count: 0 });

      await repository.findByEmail('test@example.com');

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls).toHaveLength(1);

      const input = calls[0].args[0].input;
      expect(input.TableName).toBe(TABLE_NAME);
      expect(input.IndexName).toBe('GSI_Email');
      expect(input.KeyConditionExpression).toBe('email = :email');
      expect(input.ExpressionAttributeValues).toEqual({ ':email': 'test@example.com' });
    });
  });

  // ── save ────────────────────────────────────────────────────────────────────

  describe('save', () => {
    it('calls PutCommand with the correct item structure', async () => {
      ddbMock.on(PutCommand).resolves({});

      await repository.save(MEMBER_ENTITY);

      const calls = ddbMock.commandCalls(PutCommand);
      expect(calls).toHaveLength(1);

      const input = calls[0].args[0].input;
      expect(input.TableName).toBe(TABLE_NAME);
      expect(input.ConditionExpression).toBe('attribute_not_exists(pk)');

      const item = input.Item as Record<string, unknown>;
      expect(item['pk']).toBe(`MEMBER#${MEMBER_ENTITY.memberId}`);
      expect(item['sk']).toBe('PROFILE');
      expect(item['member_id']).toBe(MEMBER_ENTITY.memberId);
      expect(item['dni']).toBe(MEMBER_ENTITY.dni);
      expect(item['full_name']).toBe(MEMBER_ENTITY.fullName);
      expect(item['email']).toBe(MEMBER_ENTITY.email);
      expect(item['phone']).toBe(MEMBER_ENTITY.phone);
      expect(item['membership_type']).toBe(MEMBER_ENTITY.membershipType);
      expect(item['account_status']).toBe(MEMBER_ENTITY.accountStatus);
      expect(item['cognito_user_id']).toBe(MEMBER_ENTITY.cognitoUserId);
      expect(item['created_at']).toBe(MEMBER_ENTITY.createdAt);
      expect(item['updated_at']).toBe(MEMBER_ENTITY.updatedAt);
    });

    it('does not include undefined optional fields in the PutCommand', async () => {
      const memberWithoutPhone = new MemberEntity({
        memberId: '01JKZP7QR8S9T0UVWX1YZ2AB3C',
        dni: '20345678',
        fullName: 'Martin Garcia',
        email: 'martin.garcia@email.com',
        membershipType: MembershipType.GOLD,
        accountStatus: AccountStatus.ACTIVE,
        cognitoUserId: 'cognito-sub-uuid-1234',
        createdAt: '2026-02-20T15:30:00.000Z',
        updatedAt: '2026-02-20T15:30:00.000Z',
      });

      ddbMock.on(PutCommand).resolves({});

      await repository.save(memberWithoutPhone);

      const calls = ddbMock.commandCalls(PutCommand);
      expect(calls).toHaveLength(1);

      const sentItem = calls[0].args[0].input.Item as Record<string, unknown>;
      expect(sentItem['phone']).toBeUndefined();
      expect(sentItem['membership_expiry']).toBeUndefined();
    });
  });
});
