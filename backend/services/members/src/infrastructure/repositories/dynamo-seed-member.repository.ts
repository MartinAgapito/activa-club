import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  SeedMemberRepositoryInterface,
  SeedMemberRecord,
} from '../../domain/repositories/seed-member.repository.interface';
import { MembershipType, isMembershipType } from '../../domain/value-objects/membership-type.vo';
import { AccountStatus, isAccountStatus } from '../../domain/value-objects/account-status.vo';

/**
 * DynamoDB item shape for SeedMembersTable.
 * Hash key is DNI (plain value, no prefix).
 */
interface SeedMemberDynamoItem {
  DNI: string;
  full_name: string;
  membership_type: string;
  account_status: string;
  email?: string;
  phone?: string;
  imported_at: string;
}

/**
 * Maps a raw DynamoDB item to a SeedMemberRecord domain object.
 */
function toDomain(item: SeedMemberDynamoItem): SeedMemberRecord {
  return {
    pk: item.DNI,
    dni: item.DNI,
    fullName: item.full_name,
    membershipType: isMembershipType(item.membership_type)
      ? item.membership_type
      : MembershipType.SILVER,
    accountStatus: isAccountStatus(item.account_status)
      ? item.account_status
      : AccountStatus.INACTIVE,
    email: item.email,
    phone: item.phone,
    importedAt: item.imported_at,
  };
}

/**
 * DynamoDB implementation of SeedMemberRepositoryInterface.
 *
 * Provides read-only access to SeedMembersTable via GetItem on the pk
 * formatted as `DNI#<dni>`. No write operations are performed.
 */
@Injectable()
export class DynamoSeedMemberRepository implements SeedMemberRepositoryInterface {
  private readonly logger = new Logger(DynamoSeedMemberRepository.name);
  private readonly tableName: string;

  constructor(private readonly client: DynamoDBDocumentClient) {
    this.tableName = process.env.SEED_MEMBERS_TABLE_NAME!;
    if (!this.tableName) {
      throw new Error('Environment variable SEED_MEMBERS_TABLE_NAME is not set');
    }
  }

  async findByDni(dni: string): Promise<SeedMemberRecord | null> {
    this.logger.debug(`findByDni: GetItem DNI=${dni}`);

    try {
      const result = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { DNI: dni },
        }),
      );

      if (!result.Item) {
        return null;
      }

      return toDomain(result.Item as SeedMemberDynamoItem);
    } catch (error) {
      throw this.wrapError(error, 'GetItem', this.tableName);
    }
  }

  private wrapError(error: unknown, operation: string, table: string): Error {
    const original = error instanceof Error ? error : new Error(String(error));
    const wrapped = new Error(`DynamoDB ${operation} on "${table}": ${original.message}`);
    wrapped.name = original.name;
    wrapped.stack = original.stack;
    return wrapped;
  }
}
