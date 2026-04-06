import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  AreasRepositoryInterface,
  AreaRecord,
} from '../../application/ports/areas.repository.interface';

interface AreaDynamoItem {
  PK: string;
  SK: string;
  area_id: string;
  name: string;
  status: string;
  capacity: number;
  slot_duration: number;
  opening_time: string;
  closing_time: string;
  cancel_window_hours: number;
  allowed_memberships: string[];
  max_duration_minutes: Record<string, number>;
  weekly_limit: Record<string, number>;
}

function toDomain(item: AreaDynamoItem): AreaRecord {
  return {
    areaId: item.area_id,
    name: item.name,
    status: item.status,
    capacity: item.capacity,
    slotDuration: item.slot_duration,
    openingTime: item.opening_time,
    closingTime: item.closing_time,
    cancelWindowHours: item.cancel_window_hours ?? 2,
    allowedMemberships: item.allowed_memberships ?? [],
    maxDurationMinutes: item.max_duration_minutes ?? {},
    weeklyLimit: item.weekly_limit ?? {},
  };
}

@Injectable()
export class AreasDynamoRepository implements AreasRepositoryInterface {
  private readonly logger = new Logger(AreasDynamoRepository.name);
  private readonly tableName: string;

  constructor(private readonly client: DynamoDBDocumentClient) {
    this.tableName = process.env.AREAS_TABLE_NAME!;
    if (!this.tableName) throw new Error('AREAS_TABLE_NAME is not set');
  }

  async findById(areaId: string): Promise<AreaRecord | null> {
    this.logger.debug(`findById: areaId=${areaId}`);

    try {
      const result = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { PK: `AREA#${areaId}`, SK: 'CONFIG' },
        }),
      );

      if (!result.Item) return null;
      return toDomain(result.Item as AreaDynamoItem);
    } catch (error) {
      const original = error instanceof Error ? error : new Error(String(error));
      throw new Error(`DynamoDB GetItem on "${this.tableName}": ${original.message}`);
    }
  }

  async findAllActive(): Promise<AreaRecord[]> {
    this.logger.debug('findAllActive');

    const items: AreaRecord[] = [];
    let lastKey: Record<string, unknown> | undefined;

    try {
      do {
        const result = await this.client.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: '#s = :active AND SK = :sk',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: {
              ':active': 'Active',
              ':sk': 'CONFIG',
            },
            ExclusiveStartKey: lastKey as Record<string, any> | undefined,
          }),
        );

        for (const item of result.Items ?? []) {
          items.push(toDomain(item as AreaDynamoItem));
        }

        lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (lastKey);

      return items;
    } catch (error) {
      const original = error instanceof Error ? error : new Error(String(error));
      throw new Error(`DynamoDB Scan on "${this.tableName}": ${original.message}`);
    }
  }
}
