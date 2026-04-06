import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  MembersRepositoryInterface,
  MemberRecord,
} from '../../application/ports/members.repository.interface';

interface MemberDynamoItem {
  PK: string;
  SK: string;
  member_id: string;
  membership_type: string;
  account_status: string;
  weekly_reservation_count?: number;
  weekly_reset_at?: string;
  cognito_user_id: string;
}

function toDomain(item: MemberDynamoItem): MemberRecord {
  return {
    pk: item.PK,
    memberId: item.member_id,
    membershipType: item.membership_type,
    accountStatus: item.account_status,
    weeklyReservationCount: item.weekly_reservation_count ?? 0,
    weeklyResetAt: item.weekly_reset_at ?? '',
    cognitoUserId: item.cognito_user_id,
  };
}

@Injectable()
export class MembersDynamoRepository implements MembersRepositoryInterface {
  private readonly logger = new Logger(MembersDynamoRepository.name);
  private readonly tableName: string;

  constructor(private readonly client: DynamoDBDocumentClient) {
    this.tableName = process.env.MEMBERS_TABLE_NAME!;
    if (!this.tableName) throw new Error('MEMBERS_TABLE_NAME is not set');
  }

  async findById(memberId: string): Promise<MemberRecord | null> {
    this.logger.debug(`findById: memberId=${memberId}`);

    try {
      const result = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { PK: `MEMBER#${memberId}`, SK: 'PROFILE' },
        }),
      );

      if (!result.Item) return null;
      return toDomain(result.Item as MemberDynamoItem);
    } catch (error) {
      const original = error instanceof Error ? error : new Error(String(error));
      throw new Error(`DynamoDB GetItem on "${this.tableName}": ${original.message}`);
    }
  }

  async findByCognitoSub(cognitoSub: string): Promise<MemberRecord | null> {
    this.logger.debug(`findByCognitoSub: cognitoSub=${cognitoSub}`);

    try {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI_CognitoSub',
          KeyConditionExpression: 'cognito_user_id = :sub',
          ExpressionAttributeValues: { ':sub': cognitoSub },
          Limit: 1,
        }),
      );

      if (!result.Items || result.Items.length === 0) return null;

      const key = result.Items[0] as { PK: string; SK: string };
      return this.findByKey(key.PK, key.SK);
    } catch (error) {
      const original = error instanceof Error ? error : new Error(String(error));
      throw new Error(`DynamoDB Query GSI_CognitoSub on "${this.tableName}": ${original.message}`);
    }
  }

  private async findByKey(PK: string, SK: string): Promise<MemberRecord | null> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { PK, SK } }),
    );
    if (!result.Item) return null;
    return toDomain(result.Item as MemberDynamoItem);
  }
}
