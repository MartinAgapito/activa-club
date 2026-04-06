import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBDocumentClient, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { SlotOccupancyRepositoryInterface } from '../../domain/repositories/slot-occupancy.repository.interface';
import { SlotOccupancy } from '../../domain/value-objects/slot-occupancy.vo';

interface SlotOccupancyItem {
  pk: string;
  occupancy: number;
  capacity: number;
}

@Injectable()
export class SlotOccupancyDynamoRepository implements SlotOccupancyRepositoryInterface {
  private readonly logger = new Logger(SlotOccupancyDynamoRepository.name);
  private readonly tableName: string;

  constructor(private readonly client: DynamoDBDocumentClient) {
    this.tableName = process.env.SLOT_OCCUPANCY_TABLE_NAME!;
    if (!this.tableName) throw new Error('SLOT_OCCUPANCY_TABLE_NAME is not set');
  }

  async getSlotOccupancy(
    areaId: string,
    date: string,
    startTime: string,
    capacity: number,
  ): Promise<SlotOccupancy> {
    const map = await this.batchGetSlotOccupancies(areaId, date, [startTime], capacity);
    return map.get(startTime) ?? new SlotOccupancy(0, capacity);
  }

  async batchGetSlotOccupancies(
    areaId: string,
    date: string,
    startTimes: string[],
    capacity: number,
  ): Promise<Map<string, SlotOccupancy>> {
    this.logger.debug(
      `batchGetSlotOccupancies: areaId=${areaId} date=${date} slots=${startTimes.length}`,
    );

    const result = new Map<string, SlotOccupancy>();

    if (startTimes.length === 0) return result;

    const keys = startTimes.map((t) => ({ pk: `SLOT#${areaId}#${date}#${t}` }));

    try {
      // BatchGetItem supports max 100 keys per request
      const BATCH_SIZE = 100;
      for (let i = 0; i < keys.length; i += BATCH_SIZE) {
        const batchKeys = keys.slice(i, i + BATCH_SIZE);

        const response = await this.client.send(
          new BatchGetCommand({
            RequestItems: {
              [this.tableName]: {
                Keys: batchKeys,
              },
            },
          }),
        );

        const items =
          (response.Responses?.[this.tableName] as SlotOccupancyItem[] | undefined) ?? [];

        for (const item of items) {
          // Extract startTime from pk: SLOT#<areaId>#<date>#<startTime>
          const parts = item.pk.split('#');
          const startTime = parts[parts.length - 1];
          result.set(startTime, new SlotOccupancy(item.occupancy ?? 0, item.capacity ?? capacity));
        }
      }
    } catch (error) {
      const original = error instanceof Error ? error : new Error(String(error));
      throw new Error(`DynamoDB BatchGetItem on "${this.tableName}": ${original.message}`);
    }

    // For any startTime not found in DynamoDB, default to 0 occupancy
    for (const t of startTimes) {
      if (!result.has(t)) {
        result.set(t, new SlotOccupancy(0, capacity));
      }
    }

    return result;
  }
}
