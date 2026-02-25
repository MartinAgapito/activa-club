import { Injectable, Logger } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { MemberRepositoryInterface } from '../../domain/repositories/member.repository.interface';
import { MemberEntity } from '../../domain/entities/member.entity';
import { MembershipType, isMembershipType } from '../../domain/value-objects/membership-type.vo';
import { AccountStatus, isAccountStatus } from '../../domain/value-objects/account-status.vo';

/**
 * DynamoDB item shape for MembersTable.
 * Reflects the physical storage schema (snake_case attribute names).
 */
interface MemberDynamoItem {
  PK: string;
  SK: string;
  member_id: string;
  dni: string;
  full_name: string;
  email: string;
  phone?: string;
  membership_type: string;
  account_status: string;
  cognito_user_id: string;
  created_at: string;
  updated_at: string;
  membership_expiry?: string;
}

/**
 * Maps a DynamoDB item to a MemberEntity domain object.
 */
function toDomain(item: MemberDynamoItem): MemberEntity {
  return new MemberEntity({
    memberId: item.member_id,
    dni: item.dni,
    fullName: item.full_name,
    email: item.email,
    phone: item.phone,
    membershipType: isMembershipType(item.membership_type)
      ? item.membership_type
      : MembershipType.SILVER,
    accountStatus: isAccountStatus(item.account_status)
      ? item.account_status
      : AccountStatus.INACTIVE,
    cognitoUserId: item.cognito_user_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    membershipExpiry: item.membership_expiry,
  });
}

/**
 * DynamoDB implementation of MemberRepositoryInterface.
 *
 * Operates on MembersTable using GSI_DNI and GSI_Email for uniqueness checks,
 * and PutCommand to persist new member profiles.
 */
@Injectable()
export class DynamoMemberRepository implements MemberRepositoryInterface {
  private readonly logger = new Logger(DynamoMemberRepository.name);
  private readonly tableName: string;

  constructor(private readonly client: DynamoDBDocumentClient) {
    this.tableName = process.env.MEMBERS_TABLE_NAME!;
    if (!this.tableName) {
      throw new Error('Environment variable MEMBERS_TABLE_NAME is not set');
    }
  }

  async findByDni(dni: string): Promise<MemberEntity | null> {
    this.logger.debug(`findByDni: querying GSI_DNI for dni=${dni}`);

    try {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI_DNI',
          KeyConditionExpression: 'dni = :dni',
          ExpressionAttributeValues: { ':dni': dni },
          Limit: 1,
        }),
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      // GSI_DNI has KEYS_ONLY projection — retrieve the full item via GetItem
      const key = result.Items[0] as { PK: string; SK: string };
      return this.findByKey(key.PK, key.SK);
    } catch (error) {
      throw this.wrapError(error, 'Query GSI_DNI', this.tableName);
    }
  }

  async findByEmail(email: string): Promise<MemberEntity | null> {
    this.logger.debug(`findByEmail: querying GSI_Email for email=${email}`);

    try {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI_Email',
          KeyConditionExpression: 'email = :email',
          ExpressionAttributeValues: { ':email': email },
          Limit: 1,
        }),
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      // GSI_Email has KEYS_ONLY projection — retrieve the full item via GetItem
      const key = result.Items[0] as { PK: string; SK: string };
      return this.findByKey(key.PK, key.SK);
    } catch (error) {
      throw this.wrapError(error, 'Query GSI_Email', this.tableName);
    }
  }

  async save(member: MemberEntity): Promise<void> {
    this.logger.debug(`save: putting member pk=MEMBER#${member.memberId}`);

    const item: MemberDynamoItem = {
      PK: `MEMBER#${member.memberId}`,
      SK: 'PROFILE',
      member_id: member.memberId,
      dni: member.dni,
      full_name: member.fullName,
      email: member.email,
      phone: member.phone,
      membership_type: member.membershipType,
      account_status: member.accountStatus,
      cognito_user_id: member.cognitoUserId,
      created_at: member.createdAt,
      updated_at: member.updatedAt,
      membership_expiry: member.membershipExpiry,
    };

    // Remove undefined optional fields so DynamoDB does not store null values
    if (!item.phone) delete item.phone;
    if (!item.membership_expiry) delete item.membership_expiry;

    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
    } catch (error) {
      throw this.wrapError(error, 'PutItem', this.tableName);
    }
  }

  private async findByKey(PK: string, SK: string): Promise<MemberEntity | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK, SK },
      }),
    );

    if (!result.Item) {
      return null;
    }

    return toDomain(result.Item as MemberDynamoItem);
  }

  private wrapError(error: unknown, operation: string, table: string): Error {
    const original = error instanceof Error ? error : new Error(String(error));
    const wrapped = new Error(`DynamoDB ${operation} on "${table}": ${original.message}`);
    wrapped.name = original.name;
    wrapped.stack = original.stack;
    return wrapped;
  }
}
