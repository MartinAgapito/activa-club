import { Injectable, Logger } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  AreasRepositoryInterface,
  AreaRecord,
} from '../../application/ports/areas.repository.interface';

interface AreaDynamoItem {
  pk: string;
  sk: string;
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
          Key: { pk: `AREA#${areaId}`, sk: 'CONFIG' },
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
    return this.scanByStatus('Active');
  }

  async findAll(): Promise<AreaRecord[]> {
    this.logger.debug('findAll');

    const items: AreaRecord[] = [];
    let lastKey: Record<string, unknown> | undefined;

    try {
      do {
        const result = await this.client.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'sk = :sk',
            ExpressionAttributeValues: { ':sk': 'CONFIG' },
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

  async save(area: AreaRecord): Promise<AreaRecord> {
    this.logger.debug(`save: areaId=${area.areaId}`);

    const item: AreaDynamoItem = {
      pk: `AREA#${area.areaId}`,
      sk: 'CONFIG',
      area_id: area.areaId,
      name: area.name,
      status: area.status,
      capacity: area.capacity,
      slot_duration: area.slotDuration,
      opening_time: area.openingTime,
      closing_time: area.closingTime,
      cancel_window_hours: area.cancelWindowHours,
      allowed_memberships: area.allowedMemberships,
      max_duration_minutes: area.maxDurationMinutes,
      weekly_limit: area.weeklyLimit,
    };

    try {
      await this.client.send(new PutCommand({ TableName: this.tableName, Item: item }));
      return area;
    } catch (error) {
      const original = error instanceof Error ? error : new Error(String(error));
      throw new Error(`DynamoDB PutItem on "${this.tableName}": ${original.message}`);
    }
  }

  async updateStatus(areaId: string, status: 'Active' | 'Inactive'): Promise<void> {
    this.logger.debug(`updateStatus: areaId=${areaId} status=${status}`);

    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: `AREA#${areaId}`, sk: 'CONFIG' },
          UpdateExpression: 'SET #s = :status',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':status': status },
          ConditionExpression: 'attribute_exists(pk)',
        }),
      );
    } catch (error) {
      const original = error instanceof Error ? error : new Error(String(error));
      throw new Error(`DynamoDB UpdateItem on "${this.tableName}": ${original.message}`);
    }
  }

  private async scanByStatus(status: string): Promise<AreaRecord[]> {
    const items: AreaRecord[] = [];
    let lastKey: Record<string, unknown> | undefined;

    try {
      do {
        const result = await this.client.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: '#s = :status AND sk = :sk',
            ExpressionAttributeNames: { '#s': 'status' },
            ExpressionAttributeValues: { ':status': status, ':sk': 'CONFIG' },
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
