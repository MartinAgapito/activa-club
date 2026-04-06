import { Injectable, Logger } from '@nestjs/common';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  AreaBlockRepositoryInterface,
  AreaBlockCreatePayload,
} from '../../domain/repositories/area-block.repository.interface';
import { AreaBlockEntity } from '../../domain/entities/area-block.entity';

interface AreaBlockDynamoItem {
  pk: string;
  sk: string;
  block_id: string;
  area_id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

function toDomain(item: AreaBlockDynamoItem): AreaBlockEntity {
  return new AreaBlockEntity({
    blockId: item.block_id,
    areaId: item.area_id,
    date: item.date,
    startTime: item.start_time,
    endTime: item.end_time,
    reason: item.reason,
    createdBy: item.created_by,
    createdAt: item.created_at,
    isActive: item.is_active,
  });
}

@Injectable()
export class AreaBlockDynamoRepository implements AreaBlockRepositoryInterface {
  private readonly logger = new Logger(AreaBlockDynamoRepository.name);
  private readonly tableName: string;

  constructor(private readonly client: DynamoDBDocumentClient) {
    this.tableName = process.env.AREA_BLOCKS_TABLE_NAME!;
    if (!this.tableName) throw new Error('AREA_BLOCKS_TABLE_NAME is not set');
  }

  async listByAreaAndDate(areaId: string, date: string): Promise<AreaBlockEntity[]> {
    this.logger.debug(`listByAreaAndDate: areaId=${areaId} date=${date}`);

    try {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI_AreaDateBlocks',
          KeyConditionExpression: 'area_id = :aid AND #d = :date',
          FilterExpression: 'is_active = :active',
          ExpressionAttributeNames: { '#d': 'date' },
          ExpressionAttributeValues: {
            ':aid': areaId,
            ':date': date,
            ':active': true,
          },
        }),
      );

      return (result.Items ?? []).map((i) => toDomain(i as AreaBlockDynamoItem));
    } catch (error) {
      throw this.wrapError(error, 'Query GSI_AreaDateBlocks', this.tableName);
    }
  }

  async findKeysByBlockId(blockId: string): Promise<{ pk: string; sk: string } | null> {
    this.logger.debug(`findKeysByBlockId: blockId=${blockId}`);

    try {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI_BlockId',
          KeyConditionExpression: 'block_id = :bid',
          ExpressionAttributeValues: { ':bid': blockId },
          Limit: 1,
        }),
      );

      if (!result.Items || result.Items.length === 0) return null;

      const item = result.Items[0] as { pk: string; sk: string; is_active: boolean };
      if (!item.is_active) return null; // Treat inactive as not found

      return { pk: item.pk, sk: item.sk };
    } catch (error) {
      throw this.wrapError(error, 'Query GSI_BlockId', this.tableName);
    }
  }

  async create(payload: AreaBlockCreatePayload): Promise<AreaBlockEntity> {
    this.logger.debug(`create: blockId=${payload.blockId} areaId=${payload.areaId}`);

    const now = new Date().toISOString();
    const item: AreaBlockDynamoItem = {
      pk: `BLOCK#${payload.blockId}`,
      sk: `AREA#${payload.areaId}`,
      block_id: payload.blockId,
      area_id: payload.areaId,
      date: payload.date,
      start_time: payload.startTime,
      end_time: payload.endTime,
      reason: payload.reason,
      created_by: payload.createdBy,
      created_at: now,
      is_active: true,
    };

    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(pk)',
        }),
      );

      return toDomain(item);
    } catch (error) {
      throw this.wrapError(error, 'PutItem', this.tableName);
    }
  }

  async deactivate(pk: string, sk: string): Promise<void> {
    this.logger.debug(`deactivate: pk=${pk}`);

    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk, sk },
          UpdateExpression: 'SET is_active = :false',
          ConditionExpression: 'attribute_exists(pk) AND is_active = :true',
          ExpressionAttributeValues: {
            ':false': false,
            ':true': true,
          },
        }),
      );
    } catch (error) {
      throw this.wrapError(error, 'UpdateItem (deactivate)', this.tableName);
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
